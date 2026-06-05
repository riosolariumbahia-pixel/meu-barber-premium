
CREATE TABLE IF NOT EXISTS public.appointment_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  block_type TEXT NOT NULL DEFAULT 'busy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocks TO authenticated;
GRANT ALL ON public.appointment_blocks TO service_role;

ALTER TABLE public.appointment_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read blocks" ON public.appointment_blocks
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members manage blocks" ON public.appointment_blocks
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_blocks_tenant_time ON public.appointment_blocks (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_blocks_barber ON public.appointment_blocks (barber_id);

CREATE TRIGGER touch_blocks_updated_at BEFORE UPDATE ON public.appointment_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
