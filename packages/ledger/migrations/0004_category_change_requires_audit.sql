-- SOURCE OF TRUTH: the "no unaudited categorization" guardrail (S1-6, PLAN.md §5.1).
-- WHAT: a deferred constraint trigger on postings. At COMMIT, every change
-- to a posting's category_id must be matched by an audit_log row for that
-- posting, with the same category_id, written in the same DB transaction
-- (audit_log.tx_id = txid_current()). Otherwise the whole transaction is
-- rolled back.
-- WHY: before this, "every categorization is audited" held only because
-- every code path remembered to call writeAuditLog(). That is a behavioral
-- guardrail -- a future route, script or bug could skip it silently. This
-- makes an unaudited category change impossible to commit, the same way
-- 0001 makes an unbalanced transaction impossible. It is deferred (checked
-- at COMMIT, not per statement) so the normal "update posting, then insert
-- audit row" order inside one transaction works; a write outside an
-- explicit transaction commits immediately and therefore fails.
-- Consequence worth knowing: deleting a category that postings use would
-- null their category_id via the FK's ON DELETE SET NULL with no audit row,
-- so that delete is refused too -- intended, a category change must never
-- be silent.
-- WHERE: owns enforcement only. The audit_log.tx_id column lives in
-- schema.ts / 0003; the writer lives in apps/server/src/audit.ts.

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
