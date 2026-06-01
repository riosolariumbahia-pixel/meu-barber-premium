
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'barber', 'client');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'pro', 'premium');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','serving','completed','cancelled','noshow');
CREATE TYPE public.service_category AS ENUM ('corte','barba','sobrancelha','pigmentacao','combo','outro');
CREATE TYPE public.commission_type AS ENUM ('percent','fixed');
CREATE TYPE public.cashflow_type AS ENUM ('income','expense');
CREATE TYPE public.vip_tier AS ENUM ('bronze','silver','gold','black');

-- =========================================================
-- TENANTS (barbearias)
-- =========================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT,
  logo_color TEXT DEFAULT 'amber',
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'starter',
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  current_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TENANT MEMBERS (user_id <-> tenant_id)
-- =========================================================
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON public.tenant_members(tenant_id);

-- =========================================================
-- USER ROLES (global system roles, separate from membership)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- =========================================================
-- TENANT / MEMBER / PROFILE / ROLE POLICIES
-- =========================================================
CREATE POLICY "members can view their tenants" ON public.tenants
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), id));
CREATE POLICY "owners can update their tenant" ON public.tenants
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), id, 'owner'));
CREATE POLICY "authenticated can create tenants" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "users see own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "members view their memberships" ON public.tenant_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "owners manage members" ON public.tenant_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'owner'));
CREATE POLICY "self insert first membership" ON public.tenant_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_tenant ON public.audit_logs(tenant_id, created_at DESC);

CREATE POLICY "tenant members view audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (
    tenant_id IS NOT NULL AND public.has_role(auth.uid(), tenant_id, 'owner')
  );

CREATE OR REPLACE FUNCTION public.log_audit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant UUID;
  _rec_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := (to_jsonb(OLD)->>'tenant_id')::UUID;
    _rec_id := to_jsonb(OLD)->>'id';
  ELSE
    _tenant := (to_jsonb(NEW)->>'tenant_id')::UUID;
    _rec_id := to_jsonb(NEW)->>'id';
  END IF;

  INSERT INTO public.audit_logs(tenant_id, user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    _tenant,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    _rec_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

-- =========================================================
-- DOMAIN TABLES (todas com tenant_id + RLS)
-- =========================================================

-- BARBERS
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT,
  specialty TEXT,
  avatar_url TEXT,
  commission_type public.commission_type NOT NULL DEFAULT 'percent',
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 50,
  hours TEXT DEFAULT '09:00-18:00',
  rating NUMERIC(3,2) DEFAULT 5.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_barbers_tenant ON public.barbers(tenant_id);

-- SERVICES
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.service_category NOT NULL DEFAULT 'corte',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_services_tenant ON public.services(tenant_id);

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  birth_date DATE,
  fidelity_points INT NOT NULL DEFAULT 0,
  cashback_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  vip_tier public.vip_tier NOT NULL DEFAULT 'bronze',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  service_name TEXT NOT NULL,
  barber_name TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  payment_method TEXT DEFAULT 'presencial',
  commission_paid NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appt_tenant_date ON public.appointments(tenant_id, starts_at);

-- CASH FLOW
CREATE TABLE public.cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.cashflow_type NOT NULL,
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flow TO authenticated;
GRANT ALL ON public.cash_flow TO service_role;
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cash_tenant_date ON public.cash_flow(tenant_id, occurred_at DESC);

-- =========================================================
-- DOMAIN RLS (uniforme: membro do tenant pode CRUD)
-- =========================================================
CREATE POLICY "tenant members read barbers" ON public.barbers
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant members write barbers" ON public.barbers
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant members read services" ON public.services
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant members write services" ON public.services
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant members read clients" ON public.clients
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant members write clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant members read appts" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant members write appts" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant members read cash" ON public.cash_flow
  FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant members write cash" ON public.cash_flow
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- =========================================================
-- AUDIT TRIGGERS
-- =========================================================
CREATE TRIGGER audit_barbers      AFTER INSERT OR UPDATE OR DELETE ON public.barbers      FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_services     AFTER INSERT OR UPDATE OR DELETE ON public.services     FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_clients      AFTER INSERT OR UPDATE OR DELETE ON public.clients      FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_cash_flow    AFTER INSERT OR UPDATE OR DELETE ON public.cash_flow    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_tenants_u      BEFORE UPDATE ON public.tenants      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_profiles_u     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_barbers_u      BEFORE UPDATE ON public.barbers      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_services_u     BEFORE UPDATE ON public.services     FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_clients_u      BEFORE UPDATE ON public.clients      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_appointments_u BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- NEW USER -> PROFILE TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
