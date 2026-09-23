-- SOURCE OF TRUTH: relaxes the append-only guardrail for posting metadata (S1-2).
-- WHAT: postings_reject_mutation() now allows UPDATE only when category_id
-- and/or tags are the sole changed columns; DELETE and any UPDATE touching
-- transaction_id/account_id/amount/currency/counterparty_* still rejected.
-- WHY: categorization needs to attach metadata to a posting after insert.
-- Money-movement columns must stay immutable to protect the sum-to-zero
-- guardrail; category is metadata about a posting, not a money-movement
-- claim, so it is carved out explicitly rather than relaxing the trigger
-- wholesale.
-- WHERE: replaces the function from 0001_ledger_guardrails.sql. Triggers
-- themselves (postings_no_update/postings_no_delete) are unchanged.

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
