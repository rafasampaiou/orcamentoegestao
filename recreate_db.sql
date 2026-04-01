-- ══════════════════════════════════════════════════════════════════════════════
-- SCRIPT DE RECRIAR BANCO DE DADOS - TAUÁ BUDGET PRO
-- ATENÇÃO: ISTO VAI APAGAR OS DADOS ATUAIS DE CADASTRO. 
-- Como você ainda está implementando, isso é esperado e necessário para
-- corrigir a integridade dos tipos e resolver o problema do salvar.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. DROP FORÇADO DAS TABELAS (Ignora travamentos por chaves estrangeiras)
DROP TABLE IF EXISTS public.gmd_configurations CASCADE;
DROP TABLE IF EXISTS public.budget_data CASCADE;
DROP TABLE IF EXISTS public.financial_data CASCADE;
DROP TABLE IF EXISTS public.justifications CASCADE;
DROP TABLE IF EXISTS public.labor_parameters CASCADE;
DROP TABLE IF EXISTS public.schedule_items CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;
DROP TABLE IF EXISTS public.cost_centers CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.budget_versions CASCADE;

-- 2. RECRIAR TABELAS COM ID TEXT (RESOLVE ERRO DE UUID)
CREATE TABLE public.hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.cost_centers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('CR', 'PDV')),
    directorate TEXT,
    department TEXT,
    hotel_name TEXT,
    hierarchical_code TEXT,
    company_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.accounts (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    level TEXT DEFAULT 'account',
    package TEXT,
    "packageCode" TEXT,
    "masterPackage" TEXT,
    "masterPackageCode" TEXT,
    type TEXT DEFAULT 'Fixed',
    "sortOrder" INTEGER DEFAULT 0,
    "outOfScope" BOOLEAN DEFAULT FALSE,
    "packageId" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'Gestor de Pacote',
    hotel_id TEXT,
    can_access_admin BOOLEAN DEFAULT FALSE,
    can_access_geral BOOLEAN DEFAULT FALSE,
    can_access_cadastros BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.gmd_configurations (
    id TEXT PRIMARY KEY,
    hotel_id TEXT,
    package_id TEXT,
    package_manager_id TEXT,
    cost_center_id TEXT,
    account_manager_id TEXT,
    entity_manager_ids JSONB DEFAULT '[]',
    support_user_ids JSONB DEFAULT '[]',
    linked_account_ids JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.budget_versions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER,
    is_locked BOOLEAN DEFAULT FALSE,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.budget_data (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL,
    cost_center_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, cost_center_id, year, month)
);

CREATE TABLE public.financial_data (
    id BIGSERIAL PRIMARY KEY,
    version_id TEXT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    scenario TEXT NOT NULL,
    hotel TEXT NOT NULL,
    account_name TEXT NOT NULL,
    cost_center TEXT,
    value NUMERIC DEFAULT 0,
    type TEXT,
    scope TEXT,
    department TEXT,
    package TEXT,
    master_package TEXT,
    directorate TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.labor_parameters (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    dissidio_pct NUMERIC DEFAULT 5.0,
    dissidio_month INTEGER DEFAULT 5,
    fgts_pct NUMERIC DEFAULT 8.0,
    inss_pct NUMERIC DEFAULT 20.0,
    pis_pct NUMERIC DEFAULT 1.0,
    charges_pct NUMERIC DEFAULT 32.0,
    iss_revenue_pct NUMERIC DEFAULT 5.0,
    iss_service_pct NUMERIC DEFAULT 2.0,
    pat_meal_value NUMERIC DEFAULT 15.0,
    overtime_hour_value NUMERIC DEFAULT 25.0,
    benefits_eligibility TEXT DEFAULT 'emocionador',
    benefits_others_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.schedule_items (
    id TEXT PRIMARY KEY,
    step TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.justifications (
    id TEXT PRIMARY KEY,
    gmd_config_id TEXT,
    account_id TEXT,
    account_name TEXT,
    month INTEGER,
    year INTEGER,
    real_value NUMERIC DEFAULT 0,
    budget_value NUMERIC DEFAULT 0,
    delta_value NUMERIC DEFAULT 0,
    explanation TEXT,
    status TEXT DEFAULT 'pending_explanation',
    rejection_reason TEXT,
    action_plan TEXT,
    action_plan_start_date TEXT,
    action_plan_end_date TEXT,
    recovered_value NUMERIC,
    completion_observation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RECRIAR POLÍTICAS DE ACESSO (PERMISSÕES DO SITE)
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmd_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'hotels', 'cost_centers', 'accounts', 'profiles',
        'gmd_configurations', 'budget_versions', 'budget_data',
        'financial_data', 'labor_parameters', 'schedule_items', 'justifications'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated %s" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all for authenticated %s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon read %s" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow anon read %s" ON public.%I FOR SELECT TO anon USING (true)', tbl, tbl);
    END LOOP;
END $$;
