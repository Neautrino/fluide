-- SOURCE OF TRUTH: the "no unaudited category change" guardrail on postings.
-- Invariant: a category_id change commits only with a same-transaction audit_log row for that posting and category. Enforced by: postings_category_change_audited (below).
-- See: ADR 004 — why deleting an in-use category is refused too

CREATE OR REPLACE FUNCTION postings_category_change_requires_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category_id IS DISTINCT FROM OLD.category_id AND NOT EXISTS (
    SELECT 1
    FROM audit_log a
    WHERE a.posting_id = NEW.id
      AND a.tx_id = txid_current()
      AND a.category_id IS NOT DISTINCT FROM NEW.category_id
  ) THEN
    RAISE EXCEPTION
      'posting % category_id changed to % without a matching audit_log row in the same transaction. Write the audit entry (apps/server/src/audit.ts) inside the same db.transaction.',
      NEW.id, COALESCE(NEW.category_id::text, 'NULL');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER postings_category_change_audited
  AFTER UPDATE OF category_id ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION postings_category_change_requires_audit();
