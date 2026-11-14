-- ==============================================================================
-- Vathmos - Supabase PostgreSQL Schema
-- Designed for In-RAM Zero-Retention Compliance + White-Label Workspaces
-- Paste this entire script into Supabase -> SQL Editor -> New query -> Run
-- ==============================================================================

-- 1. VATHMOS WORKSPACES (Primary server-synced table for OTP login + White-Label)
-- Zero resume PII is stored here — only recruiter account profile, plan & branding.
CREATE TABLE IF NOT EXISTS public.vathmos_workspaces (
    email TEXT PRIMARY KEY,
    user_id TEXT,
    full_name TEXT,
    company_name TEXT,
    role_title TEXT DEFAULT 'Technical Recruiter',
    avatar_color TEXT DEFAULT '#6366F1',
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
    evaluations_limit INT NOT NULL DEFAULT 5,
    evaluations_used INT NOT NULL DEFAULT 0,
    interview_questions_limit INT NOT NULL DEFAULT 5,
    interview_questions_used INT NOT NULL DEFAULT 0,
    white_label JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable strict Row Level Security (only accessible via backend Secret / service_role key)
ALTER TABLE public.vathmos_workspaces ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES (extends supabase auth.users if Supabase Auth is also enabled later)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    role_title TEXT DEFAULT 'Technical Recruiter',
    white_label JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure white_label column exists if table was created earlier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS white_label JSONB DEFAULT NULL;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 3. SUBSCRIPTIONS (Tracks Stripe & Razorpay billing status)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'agency')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    payment_provider TEXT CHECK (payment_provider IN ('stripe', 'razorpay')),
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- 4. USAGE QUOTAS
CREATE TABLE IF NOT EXISTS public.usage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evaluations_used INT NOT NULL DEFAULT 0,
    evaluations_limit INT NOT NULL DEFAULT 5,
    cycle_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_quota UNIQUE (user_id)
);

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own quota" ON public.usage_quotas;
CREATE POLICY "Users can view their own quota"
    ON public.usage_quotas FOR SELECT
    USING (auth.uid() = user_id);

-- 5. EVALUATION AUDIT LOGS (Zero-Retention Compliant)
CREATE TABLE IF NOT EXISTS public.evaluation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    candidate_count INT NOT NULL DEFAULT 1,
    ensemble_models TEXT NOT NULL DEFAULT 'gemini-3.8-flash,gemini-3.1-flash-lite',
    latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.evaluation_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.evaluation_audit_logs;
CREATE POLICY "Users can view their own audit logs"
    ON public.evaluation_audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- 6. AUTOMATIC PROFILE TRIGGER ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );

    INSERT INTO public.subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');

    INSERT INTO public.usage_quotas (user_id, evaluations_used, evaluations_limit)
    VALUES (NEW.id, 0, 5);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
