-- SOURCE OF TRUTH: the architectural guardrails for the ledger (PLAN.md §5.1).
-- WHAT: two DB-enforced invariants — postings are append-only (no UPDATE/DELETE,
-- ever, by anyone), and every transaction's postings must sum to zero per
-- currency, checked at COMMIT time (deferred), not per-row.
-- WHY: these are architectural guardrails, not behavioral ones — no application
-- bug, compromised credential, or AI-driven write can violate them, because
-- the database itself refuses the write. A plain CHECK constraint cannot
-- express "sum across a group of rows" in Postgres, so the balance rule is a
-- deferred constraint trigger, not a CHECK column.
-- WHERE: this migration owns enforcement only. Table shape lives in
-- schema.ts / 0000_polite_harpoon.sql — do not add columns here.

-- ============================================================================
-- Guardrail 1: postings are immutable (append-only log)
-- ============================================================================
-- To correct a mistake, insert a reversing posting — never edit or delete one.
-- Implemented as a trigger (not a role-level REVOKE) so it holds regardless
-- of which Postgres role the application connects as — no separate
-- least-privilege role setup required for this guarantee to be real.

CREATE OR REPLACE FUNCTION postings_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'postings is append-only: % is not allowed. Insert a reversing posting instead of modifying transaction_id=%.',
    TG_OP,
    COALESCE(OLD.transaction_id, NEW.transaction_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER postings_no_update
  BEFORE UPDATE ON postings
  FOR EACH ROW
  EXECUTE FUNCTION postings_reject_mutation();

CREATE TRIGGER postings_no_delete
  BEFORE DELETE ON postings
  FOR EACH ROW
  EXECUTE FUNCTION postings_reject_mutation();

-- ============================================================================
-- Guardrail 2: every transaction's postings sum to zero, per currency
-- ============================================================================
-- Deferred to COMMIT so a transaction's postings can be inserted one row at
-- a time within the same DB transaction (the normal multi-row insert case)
-- without failing on intermediate, still-unbalanced states.

CREATE OR REPLACE FUNCTION postings_check_balance()
RETURNS TRIGGER AS $$
DECLARE
  affected_transaction_id uuid;
  unbalanced RECORD;
BEGIN
  affected_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT currency, SUM(amount) AS total
  INTO unbalanced
  FROM postings
  WHERE transaction_id = affected_transaction_id
  GROUP BY currency
  HAVING SUM(amount) <> 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'transaction_id=% does not balance: postings in % sum to % (must be 0).',
      affected_transaction_id, unbalanced.currency, unbalanced.total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER postings_must_balance
  AFTER INSERT OR UPDATE OR DELETE ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION postings_check_balance();