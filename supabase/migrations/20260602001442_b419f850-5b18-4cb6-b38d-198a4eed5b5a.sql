
-- Tenant config extra
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS cashback_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_per_real numeric NOT NULL DEFAULT 0.1;

-- Cash flow ↔ appointment idempotency
ALTER TABLE public.cash_flow
  ADD COLUMN IF NOT EXISTS source_appointment_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS cash_flow_unique_appt
  ON public.cash_flow(source_appointment_id)
  WHERE source_appointment_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS appointments_tenant_start_idx ON public.appointments(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_tenant_barber_start_idx ON public.appointments(tenant_id, barber_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_tenant_status_idx ON public.appointments(tenant_id, status);
CREATE INDEX IF NOT EXISTS cash_flow_tenant_occurred_idx ON public.cash_flow(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS clients_tenant_name_idx ON public.clients(tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS clients_tenant_phone_idx ON public.clients(tenant_id, phone);
CREATE INDEX IF NOT EXISTS services_tenant_active_idx ON public.services(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS barbers_tenant_active_idx ON public.barbers(tenant_id, is_active);

-- Trigger: when appointment becomes completed, create cash_flow income + compute commission
CREATE OR REPLACE FUNCTION public.on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _commission numeric := 0;
  _ctype commission_type;
  _cvalue numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Compute commission for barber
    IF NEW.barber_id IS NOT NULL THEN
      SELECT commission_type, commission_value INTO _ctype, _cvalue
      FROM public.barbers WHERE id = NEW.barber_id;
      IF _ctype = 'percent' THEN
        _commission := round((NEW.price * _cvalue / 100)::numeric, 2);
      ELSIF _ctype = 'fixed' THEN
        _commission := _cvalue;
      END IF;
      NEW.commission_paid := _commission;
    END IF;

    -- Insert income (idempotent via unique index on source_appointment_id)
    INSERT INTO public.cash_flow(tenant_id, type, amount, description, category, occurred_at, source_appointment_id)
    VALUES (
      NEW.tenant_id,
      'income',
      NEW.price,
      COALESCE(NEW.service_name, 'Atendimento') || ' — ' || COALESCE(NEW.customer_name,''),
      'atendimento',
      COALESCE(NEW.ends_at, NEW.starts_at, now()),
      NEW.id
    )
    ON CONFLICT (source_appointment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointment_completed ON public.appointments;
CREATE TRIGGER trg_appointment_completed
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_completed();

-- Ensure cash_flow has cash_flow_type enum or text default. Add transaction type 'income'/'expense' enforced via check if not enum.
-- (existing column is USER-DEFINED enum cash_flow_type; assume 'income' value present)
