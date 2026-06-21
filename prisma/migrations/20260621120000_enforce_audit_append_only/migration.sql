-- Audit history is append-only. Corrections are represented by a new operation,
-- never by rewriting or deleting an existing accountability record.
CREATE OR REPLACE FUNCTION reject_audit_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit history is append-only';
END;
$$;

CREATE TRIGGER audit_entries_append_only
BEFORE UPDATE OR DELETE ON "audit_entries"
FOR EACH ROW EXECUTE FUNCTION reject_audit_history_mutation();

CREATE TRIGGER operation_batches_append_only
BEFORE UPDATE OR DELETE ON "operation_batches"
FOR EACH ROW EXECUTE FUNCTION reject_audit_history_mutation();
