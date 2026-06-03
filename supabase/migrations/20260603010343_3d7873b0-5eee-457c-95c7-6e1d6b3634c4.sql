
-- 1. Coluna para marcar lembrete enviado
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_window
  ON public.appointments (starts_at)
  WHERE reminder_sent_at IS NULL;

-- 2. Tabela de lembretes gerados
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  wa_link text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_tenant
  ON public.appointment_reminders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appt
  ON public.appointment_reminders (appointment_id);

GRANT SELECT, INSERT, UPDATE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read reminders"
  ON public.appointment_reminders FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant members write reminders"
  ON public.appointment_reminders FOR ALL
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
