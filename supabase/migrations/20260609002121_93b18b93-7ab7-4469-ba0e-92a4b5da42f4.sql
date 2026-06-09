
-- Helper: gerar slug único a partir de um texto base
CREATE OR REPLACE FUNCTION public._unique_tenant_slug(_base text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _candidate text;
  _i int := 0;
BEGIN
  _slug := lower(regexp_replace(coalesce(nullif(trim(_base), ''), 'barbearia'), '[^a-z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  IF _slug = '' THEN _slug := 'barbearia'; END IF;
  IF length(_slug) > 32 THEN _slug := substr(_slug, 1, 32); END IF;

  _candidate := _slug;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = _candidate) LOOP
    _i := _i + 1;
    IF _i > 50 THEN
      _candidate := _slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      EXIT;
    END IF;
    _candidate := _slug || '-' || _i::text;
  END LOOP;
  RETURN _candidate;
END;
$$;
REVOKE ALL ON FUNCTION public._unique_tenant_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._unique_tenant_slug(text) TO authenticated;

-- Atualiza criação manual para usar slug único quando houver conflito
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(_name text, _slug text, _city text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tenant public.tenants;
  _final_slug text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id) VALUES (_uid)
  ON CONFLICT (id) DO NOTHING;

  _final_slug := public._unique_tenant_slug(coalesce(_slug, _name));

  INSERT INTO public.tenants (name, slug, city, subscription_plan, subscription_status)
  VALUES (_name, _final_slug, _city, 'starter', 'trial')
  RETURNING * INTO _tenant;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (_tenant.id, _uid, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  UPDATE public.profiles SET current_tenant_id = _tenant.id WHERE id = _uid;

  RETURN _tenant;
END;
$$;

-- Função auto-recuperável: garante perfil + barbearia + membership + current_tenant_id
CREATE OR REPLACE FUNCTION public.ensure_user_tenant()
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _full_name text;
  _profile public.profiles;
  _tenant public.tenants;
  _existing_membership_tenant uuid;
  _new_slug text;
  _new_name text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1))
    INTO _email, _full_name
    FROM auth.users WHERE id = _uid;

  INSERT INTO public.profiles (id, full_name)
  VALUES (_uid, _full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name)
  RETURNING * INTO _profile;

  -- Se já tem current_tenant_id válido e membership, retorna
  IF _profile.current_tenant_id IS NOT NULL THEN
    SELECT * INTO _tenant FROM public.tenants WHERE id = _profile.current_tenant_id;
    IF _tenant.id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant.id AND user_id = _uid
    ) THEN
      RETURN _tenant;
    END IF;
  END IF;

  -- Tenta achar membership existente sem current_tenant_id setado
  SELECT tm.tenant_id INTO _existing_membership_tenant
    FROM public.tenant_members tm
    WHERE tm.user_id = _uid
    ORDER BY tm.created_at ASC
    LIMIT 1;

  IF _existing_membership_tenant IS NOT NULL THEN
    UPDATE public.profiles SET current_tenant_id = _existing_membership_tenant WHERE id = _uid;
    SELECT * INTO _tenant FROM public.tenants WHERE id = _existing_membership_tenant;
    RETURN _tenant;
  END IF;

  -- Cria barbearia automaticamente
  _new_name := coalesce(nullif(trim(_full_name), ''), 'Minha Barbearia');
  IF length(_new_name) < 2 THEN _new_name := 'Minha Barbearia'; END IF;
  _new_slug := public._unique_tenant_slug(coalesce(nullif(trim(_full_name), ''), split_part(_email, '@', 1)));

  INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status)
  VALUES (_new_name, _new_slug, 'starter', 'trial')
  RETURNING * INTO _tenant;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (_tenant.id, _uid, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  UPDATE public.profiles SET current_tenant_id = _tenant.id WHERE id = _uid;

  RETURN _tenant;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_user_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_tenant() TO authenticated;
