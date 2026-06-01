
-- Restrict SECURITY DEFINER functions execution
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, UUID, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;

-- Tighten tenant create policy: must include auth.uid() not null
DROP POLICY "authenticated can create tenants" ON public.tenants;
CREATE POLICY "authenticated can create tenants" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
