-- ==============================================================================
-- BLOOD AI – SMART BLOOD MANAGEMENT SYSTEM
-- Initial Database Migration (001_initial_schema.sql)
-- Target Project: https://uycuocrqerkhycpnekdg.supabase.co
-- Compatible with Supabase PostgreSQL, PostgREST & Node.js/Express Backend
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing triggers & functions if re-running
DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS trigger_blood_requests_updated_at ON public.blood_requests;
DROP TRIGGER IF EXISTS trigger_donor_responses_updated_at ON public.donor_responses;
DROP TRIGGER IF EXISTS trigger_donor_health_profiles_updated_at ON public.donor_health_profiles;
DROP TRIGGER IF EXISTS trigger_donor_assessments_updated_at ON public.donor_assessments;
DROP TRIGGER IF EXISTS trigger_blood_inventory_updated_at ON public.blood_inventory;
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABLE 1: USERS (Donors, Hospitals, Blood Banks, Admins)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Bcrypt hash (or managed via Supabase Auth)
  role TEXT NOT NULL DEFAULT 'donor' CHECK (role IN ('donor', 'hospital', 'blood_bank', 'admin')),
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  blood_group TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  license_number TEXT,
  is_verified BOOLEAN DEFAULT true,
  reward_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- TABLE 2: BLOOD REQUESTS (Emergency & Standard Hospital Requests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_name TEXT NOT NULL,
  blood_group TEXT NOT NULL,
  units_required INTEGER NOT NULL DEFAULT 1 CHECK (units_required > 0),
  units_fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (units_fulfilled >= 0),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  patient_name TEXT,
  patient_age INTEGER,
  patient_condition TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dispatched', 'delivered', 'cancelled', 'rejected', 'donor_alert')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_blood_requests_updated_at
  BEFORE UPDATE ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- TABLE 3: DONOR RESPONSES (Acceptance / Decline tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.donor_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('accept', 'reject')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_donor_request_response UNIQUE (blood_request_id, donor_id)
);

CREATE TRIGGER trigger_donor_responses_updated_at
  BEFORE UPDATE ON public.donor_responses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- TABLE 4: DONOR HEALTH PROFILES (Questionnaire, Metrics, Eligibility)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.donor_health_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  dob DATE,
  age INTEGER,
  gender TEXT,
  blood_group TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  phone TEXT,
  has_donated_before BOOLEAN DEFAULT false,
  last_donation_date TEXT,
  previous_donation_type TEXT,
  previous_complications TEXT,
  recent_donation_notes TEXT,
  has_medical_conditions BOOLEAN DEFAULT false,
  medical_conditions_details TEXT,
  taking_medications BOOLEAN DEFAULT false,
  medications_details TEXT,
  recent_fever_illness BOOLEAN DEFAULT false,
  fever_illness_details TEXT,
  relevant_medical_history TEXT,
  report_status TEXT DEFAULT 'completed',
  hospital_assessment_status TEXT DEFAULT 'pending',
  is_eligible BOOLEAN DEFAULT true,
  screening_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_donor_health_profiles_updated_at
  BEFORE UPDATE ON public.donor_health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- TABLE 5: DONOR ASSESSMENTS (Hospital Arrival, 6-Stage Screening & Verification)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.donor_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.donor_responses(id) ON DELETE SET NULL,
  blood_request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'reached', 'screened', 'eligible', 'deferred', 'not_eligible', 'donation_started', 'donation_completed', 'donation_verified', 'verified')),
  reached_at TIMESTAMPTZ,
  screening_weight NUMERIC,
  screening_blood_pressure TEXT,
  screening_hemoglobin NUMERIC,
  screening_pulse INTEGER,
  screening_temperature NUMERIC,
  screening_notes TEXT,
  assessment_result TEXT,
  assessment_notes TEXT,
  assessed_by TEXT,
  assessed_at TIMESTAMPTZ,
  donation_started_at TIMESTAMPTZ,
  donation_completed_at TIMESTAMPTZ,
  donation_verified_at TIMESTAMPTZ,
  donation_type TEXT DEFAULT 'Whole Blood',
  units_collected NUMERIC DEFAULT 1,
  reward_points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_donor_request_assessment UNIQUE (donor_id, blood_request_id)
);

CREATE TRIGGER trigger_donor_assessments_updated_at
  BEFORE UPDATE ON public.donor_assessments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- TABLE 6: DONATION HISTORY (Verified Donations, Units & Hero Points)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.donation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blood_bank_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  hospital_name TEXT,
  blood_group TEXT NOT NULL,
  units NUMERIC DEFAULT 1,
  donation_category TEXT DEFAULT 'Whole Blood',
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  verification_status TEXT DEFAULT 'verified',
  reward_points_awarded INTEGER DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- TABLE 7: NOTIFICATIONS (System, Alert & Status Notifications)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system_alert',
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- TABLE 8: BLOOD INVENTORY (Storage, Units & Cold-Chain Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  hospital_name TEXT,
  blood_bank_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  blood_bank_name TEXT,
  blood_group TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  component_type TEXT DEFAULT 'Whole Blood (PRBC)',
  collection_date DATE,
  expiry_date DATE,
  donor_name TEXT DEFAULT 'Anonymous Donor',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'transfused', 'expired', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trigger_blood_inventory_updated_at
  BEFORE UPDATE ON public.blood_inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- PERFORMANCE & LOOKUP INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_blood_requests_hospital ON public.blood_requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_bg ON public.blood_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_responses_req ON public.donor_responses(blood_request_id);
CREATE INDEX IF NOT EXISTS idx_donor_responses_donor ON public.donor_responses(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_health_profiles_donor ON public.donor_health_profiles(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_assessments_req ON public.donor_assessments(blood_request_id);
CREATE INDEX IF NOT EXISTS idx_donor_assessments_donor ON public.donor_assessments(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_assessments_hospital ON public.donor_assessments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor ON public.donation_history(donor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_group ON public.blood_inventory(blood_group);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;

-- Grant permissions to standard Supabase roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role, anon, authenticated;

-- 1. USERS POLICIES
DROP POLICY IF EXISTS "Users can view active directory and profiles" ON public.users;
CREATE POLICY "Users can view active directory and profiles"
  ON public.users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert registration" ON public.users;
CREATE POLICY "Users can insert registration"
  ON public.users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (
    id = auth.uid()
    OR auth_user_id = auth.uid()
    OR current_user IN ('postgres', 'service_role')
    OR auth.role() = 'anon'
  );

-- 2. BLOOD REQUESTS POLICIES
DROP POLICY IF EXISTS "Anyone can read blood requests" ON public.blood_requests;
CREATE POLICY "Anyone can read blood requests"
  ON public.blood_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Hospitals and service role can create blood requests" ON public.blood_requests;
CREATE POLICY "Hospitals and service role can create blood requests"
  ON public.blood_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Hospitals can update blood requests" ON public.blood_requests;
CREATE POLICY "Hospitals can update blood requests"
  ON public.blood_requests FOR UPDATE
  USING (true);

-- 3. DONOR RESPONSES POLICIES
DROP POLICY IF EXISTS "Allow select donor responses" ON public.donor_responses;
CREATE POLICY "Allow select donor responses"
  ON public.donor_responses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert donor responses" ON public.donor_responses;
CREATE POLICY "Allow insert donor responses"
  ON public.donor_responses FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update donor responses" ON public.donor_responses;
CREATE POLICY "Allow update donor responses"
  ON public.donor_responses FOR UPDATE
  USING (true);

-- 4. DONOR HEALTH PROFILES POLICIES
DROP POLICY IF EXISTS "Allow select donor health profiles" ON public.donor_health_profiles;
CREATE POLICY "Allow select donor health profiles"
  ON public.donor_health_profiles FOR SELECT
  USING (
    donor_id = auth.uid()
    OR auth.role() = 'anon'
    OR current_user IN ('postgres', 'service_role')
    OR EXISTS (
      SELECT 1 FROM public.donor_responses dr
      JOIN public.blood_requests br ON br.id = dr.blood_request_id
      WHERE dr.donor_id = public.donor_health_profiles.donor_id
    )
  );

DROP POLICY IF EXISTS "Allow insert donor health profiles" ON public.donor_health_profiles;
CREATE POLICY "Allow insert donor health profiles"
  ON public.donor_health_profiles FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update donor health profiles" ON public.donor_health_profiles;
CREATE POLICY "Allow update donor health profiles"
  ON public.donor_health_profiles FOR UPDATE
  USING (true);

-- 5. DONOR ASSESSMENTS POLICIES
DROP POLICY IF EXISTS "Allow select donor assessments" ON public.donor_assessments;
CREATE POLICY "Allow select donor assessments"
  ON public.donor_assessments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert donor assessments" ON public.donor_assessments;
CREATE POLICY "Allow insert donor assessments"
  ON public.donor_assessments FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update donor assessments" ON public.donor_assessments;
CREATE POLICY "Allow update donor assessments"
  ON public.donor_assessments FOR UPDATE
  USING (true);

-- 6. DONATION HISTORY POLICIES
DROP POLICY IF EXISTS "Allow select donation history" ON public.donation_history;
CREATE POLICY "Allow select donation history"
  ON public.donation_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert donation history" ON public.donation_history;
CREATE POLICY "Allow insert donation history"
  ON public.donation_history FOR INSERT
  WITH CHECK (true);

-- 7. NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Allow select notifications" ON public.notifications;
CREATE POLICY "Allow select notifications"
  ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.role() = 'anon'
    OR current_user IN ('postgres', 'service_role')
  );

DROP POLICY IF EXISTS "Allow insert notifications" ON public.notifications;
CREATE POLICY "Allow insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update notifications" ON public.notifications;
CREATE POLICY "Allow update notifications"
  ON public.notifications FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.role() = 'anon'
    OR current_user IN ('postgres', 'service_role')
  );

-- 8. BLOOD INVENTORY POLICIES
DROP POLICY IF EXISTS "Allow select blood inventory" ON public.blood_inventory;
CREATE POLICY "Allow select blood inventory"
  ON public.blood_inventory FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert blood inventory" ON public.blood_inventory;
CREATE POLICY "Allow insert blood inventory"
  ON public.blood_inventory FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update blood inventory" ON public.blood_inventory;
CREATE POLICY "Allow update blood inventory"
  ON public.blood_inventory FOR UPDATE
  USING (true);

-- ==============================================================================
-- END OF MIGRATION 001_initial_schema.sql
-- ==============================================================================
