-- Ensure generic audit logging is enabled and populated for core tables.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS operation TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changed_by TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);

CREATE OR REPLACE FUNCTION public.capture_audit_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record JSONB;
  v_record_id TEXT;
  v_changed_by TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_record := TO_JSONB(NEW);
    v_record_id := v_record ->> 'id';
  ELSIF TG_OP = 'UPDATE' THEN
    v_record := TO_JSONB(NEW);
    v_record_id := COALESCE(v_record ->> 'id', TO_JSONB(OLD) ->> 'id');
  ELSE
    v_record := TO_JSONB(OLD);
    v_record_id := v_record ->> 'id';
  END IF;

  v_changed_by := COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF(v_record ->> 'updated_by', ''),
    NULLIF(v_record ->> 'created_by', ''),
    NULLIF(v_record ->> 'generated_by', ''),
    current_user
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      table_name,
      operation,
      record_id,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      v_record_id,
      TO_JSONB(NEW),
      v_changed_by,
      NOW()
    );

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TO_JSONB(OLD) IS DISTINCT FROM TO_JSONB(NEW) THEN
      INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_data,
        new_data,
        changed_by,
        changed_at
      ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        v_record_id,
        TO_JSONB(OLD),
        TO_JSONB(NEW),
        v_changed_by,
        NOW()
      );
    END IF;

    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs (
      table_name,
      operation,
      record_id,
      old_data,
      changed_by,
      changed_at
    ) VALUES (
      TG_TABLE_NAME,
      TG_OP,
      v_record_id,
      TO_JSONB(OLD),
      v_changed_by,
      NOW()
    );

    RETURN OLD;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the original write because of audit logging failures.
    RAISE WARNING '[audit_logs] Failed to capture %.% change: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;

    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public."Projects"') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_projects ON public."Projects"';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_projects AFTER INSERT OR UPDATE OR DELETE ON public."Projects" FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.project_index') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_project_index ON public.project_index';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_project_index AFTER INSERT OR UPDATE OR DELETE ON public.project_index FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.generated_documents') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_generated_documents ON public.generated_documents';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_generated_documents AFTER INSERT OR UPDATE OR DELETE ON public.generated_documents FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.beneficiaries') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_beneficiaries ON public.beneficiaries';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_beneficiaries AFTER INSERT OR UPDATE OR DELETE ON public.beneficiaries FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.beneficiary_payments') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_beneficiary_payments ON public.beneficiary_payments';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_beneficiary_payments AFTER INSERT OR UPDATE OR DELETE ON public.beneficiary_payments FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public."EmployeePayments"') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_employee_payments ON public."EmployeePayments"';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_employee_payments AFTER INSERT OR UPDATE OR DELETE ON public."EmployeePayments" FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.project_history') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_project_history ON public.project_history';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_project_history AFTER INSERT OR UPDATE OR DELETE ON public.project_history FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;

DO $$
BEGIN
  IF TO_REGCLASS('public.budget_history') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_logs_budget_history ON public.budget_history';
    EXECUTE 'CREATE TRIGGER trg_audit_logs_budget_history AFTER INSERT OR UPDATE OR DELETE ON public.budget_history FOR EACH ROW EXECUTE FUNCTION public.capture_audit_logs()';
  END IF;
END
$$;
