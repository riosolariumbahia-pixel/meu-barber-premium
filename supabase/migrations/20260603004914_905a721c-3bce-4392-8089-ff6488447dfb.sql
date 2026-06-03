
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  _name text,
  _slug text,
  _city text
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant public.tenants;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ensure profile exists
  INSERT INTO public.profiles (id) VALUES (_uid)
  ON CONFLICT (id) DO NOTHING;

  -- create tenant
  INSERT INTO public.tenants (name, slug, city, subscription_plan, subscription_status)
  VALUES (_name, _slug, _city, 'starter', 'trial')
  RETURNING * INTO _tenant;

  -- owner membership
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (_tenant.id, _uid, 'owner');

  -- set as current tenant
  UPDATE public.profiles SET current_tenant_id = _tenant.id WHERE id = _uid;

  RETURN _tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_with_owner(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(text, text, text) TO authenticated;
