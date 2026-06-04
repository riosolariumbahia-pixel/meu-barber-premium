
-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_starts ON public.appointments(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_barber_starts ON public.appointments(tenant_id, barber_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON public.appointments(tenant_id, status);

-- Conflict check
CREATE OR REPLACE FUNCTION public.check_appointment_conflict(
  _tenant_id uuid, _barber_id uuid, _starts_at timestamptz, _ends_at timestamptz, _exclude_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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
$$;
GRANT EXECUTE ON FUNCTION public.check_appointment_conflict(uuid,uuid,timestamptz,timestamptz,uuid) TO authenticated, service_role;

-- KPIs aggregator
CREATE OR REPLACE FUNCTION public.agenda_kpis_for_tenant(_tenant_id uuid, _day date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _day_start timestamptz := (_day::timestamp AT TIME ZONE 'America/Sao_Paulo');
  _day_end   timestamptz := ((_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  _month_start timestamptz := (date_trunc('month', _day)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  _month_end   timestamptz := ((date_trunc('month', _day) + interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo');
  _result jsonb;
BEGIN
  WITH day_data AS (
    SELECT status, price FROM public.appointments
    WHERE tenant_id = _tenant_id AND starts_at >= _day_start AND starts_at < _day_end
  ),
  month_data AS (
    SELECT status, price, client_id, customer_phone FROM public.appointments
    WHERE tenant_id = _tenant_id AND starts_at >= _month_start AND starts_at < _month_end
  )
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM day_data),
      'confirmed', (SELECT COUNT(*) FROM day_data WHERE status='confirmed'),
      'completed', (SELECT COUNT(*) FROM day_data WHERE status='completed'),
      'cancelled', (SELECT COUNT(*) FROM day_data WHERE status IN ('cancelled','noshow')),
      'revenue_forecast', COALESCE((SELECT SUM(price) FROM day_data WHERE status NOT IN ('cancelled','noshow')), 0),
      'revenue_done', COALESCE((SELECT SUM(price) FROM day_data WHERE status='completed'), 0)
    ),
    'month', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM month_data),
      'completed', (SELECT COUNT(*) FROM month_data WHERE status='completed'),
      'revenue_forecast', COALESCE((SELECT SUM(price) FROM month_data WHERE status NOT IN ('cancelled','noshow')), 0),
      'revenue_done', COALESCE((SELECT SUM(price) FROM month_data WHERE status='completed'), 0),
      'avg_ticket', COALESCE((SELECT AVG(price) FROM month_data WHERE status='completed'), 0),
      'unique_clients', (SELECT COUNT(DISTINCT COALESCE(client_id::text, customer_phone)) FROM month_data)
    )
  ) INTO _result;
  RETURN _result;
END $$;
GRANT EXECUTE ON FUNCTION public.agenda_kpis_for_tenant(uuid, date) TO authenticated, service_role;
