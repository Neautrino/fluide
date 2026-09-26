-- SOURCE OF TRUTH: ledger guardrails on postings (append-only money, sum to zero).
-- Invariant: money columns never change, no DELETE; each transaction sums to 0 per currency at COMMIT. Enforced by: postings_no_update, postings_no_delete, postings_must_balance (below).
-- See: PLAN.md §5.1 — why guardrails live in the DB, not the app

-- ============================================================================
-- Guardrail 1: postings are append-only except category_id/tags
-- ============================================================================
-- To correct a money-movement mistake, insert a reversing posting — never
-- edit or delete one. Implemented as a trigger (not a role-level REVOKE) so
-- it holds regardless of which Postgres role the application connects as —
-- no separate least-privilege role setup required for this guarantee to be
-- real.

CREATE OR REPLACE FUNCTION postings_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.transaction_id IS NOT DISTINCT FROM OLD.transaction_id
     AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.currency IS NOT DISTINCT FROM OLD.currency
     AND NEW.counterparty_raw IS NOT DISTINCT FROM OLD.counterparty_raw
     AND NEW.counterparty_resolved IS NOT DISTINCT FROM OLD.counterparty_resolved
  THEN
    RETURN NEW; -- only category_id and/or tags changed — allowed
  END IF;

  RAISE EXCEPTION
    'postings money-movement fields are append-only: % is not allowed. Insert a reversing posting instead of modifying transaction_id=%.',
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
