
-- 1) Realtime: garantir REPLICA IDENTITY FULL e publicar tabelas necessárias
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_blocks REPLICA IDENTITY FULL;
ALTER TABLE public.barbers REPLICA IDENTITY FULL;
ALTER TABLE public.services REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='appointments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='appointment_blocks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_blocks';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='barbers') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.barbers';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='services') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.services';
  END IF;
END $$;

-- 2) Tabela pública e segura de eventos da agenda (sem PII)
CREATE TABLE IF NOT EXISTS public.public_agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pae_tenant_time ON public.public_agenda_events(tenant_id, occurred_at DESC);

GRANT SELECT ON public.public_agenda_events TO anon;
GRANT SELECT ON public.public_agenda_events TO authenticated;
GRANT ALL ON public.public_agenda_events TO service_role;

ALTER TABLE public.public_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read agenda events" ON public.public_agenda_events;
CREATE POLICY "Anyone can read agenda events"
  ON public.public_agenda_events FOR SELECT
  USING (true);

ALTER TABLE public.public_agenda_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='public_agenda_events') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.public_agenda_events';
  END IF;
END $$;

-- 3) Gatilhos que emitem eventos quando agendamentos/bloqueios mudam
CREATE OR REPLACE FUNCTION public.emit_agenda_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _kind text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := (to_jsonb(OLD)->>'tenant_id')::uuid;
  ELSE
    _tenant := (to_jsonb(NEW)->>'tenant_id')::uuid;
  END IF;
  _kind := TG_TABLE_NAME || ':' || lower(TG_OP);
  IF _tenant IS NOT NULL THEN
    INSERT INTO public.public_agenda_events(tenant_id, kind) VALUES (_tenant, _kind);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_appointments_agenda_event ON public.appointments;
CREATE TRIGGER trg_appointments_agenda_event
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.emit_agenda_event();

DROP TRIGGER IF EXISTS trg_blocks_agenda_event ON public.appointment_blocks;
CREATE TRIGGER trg_blocks_agenda_event
AFTER INSERT OR UPDATE OR DELETE ON public.appointment_blocks
FOR EACH ROW EXECUTE FUNCTION public.emit_agenda_event();

-- 4) Conflito agora considera bloqueios também
CREATE OR REPLACE FUNCTION public.check_appointment_conflict(_tenant_id uuid, _barber_id uuid, _starts_at timestamptz, _ends_at timestamptz, _exclude_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE tenant_id = _tenant_id
      AND barber_id IS NOT NULL AND barber_id = _barber_id
      AND status NOT IN ('cancelled','noshow','completed')
      AND (_exclude_id IS NULL OR id <> _exclude_id)
      AND tstzrange(starts_at, COALESCE(ends_at, starts_at + interval '30 min'), '[)') &&
          tstzrange(_starts_at, COALESCE(_ends_at, _starts_at + interval '30 min'), '[)')
  )
  OR EXISTS (
    SELECT 1 FROM public.appointment_blocks
    WHERE tenant_id = _tenant_id
      AND (barber_id IS NULL OR _barber_id IS NULL OR barber_id = _barber_id)
      AND tstzrange(starts_at, ends_at, '[)') &&
          tstzrange(_starts_at, COALESCE(_ends_at, _starts_at + interval '30 min'), '[)')
  )
$$;

-- 5) Grants explícitos nas tabelas usadas pelo app
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
