-- LifeLink Smart Blood Bank Management System
-- Complete PostgreSQL / Supabase schema & seed data.
-- Run this script in the Supabase Dashboard SQL Editor.

-- 1. Enable Extensions (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table (Hospitals, Blood Banks, Donors)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('hospital', 'blood_bank', 'donor')),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  blood_group VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  license_number VARCHAR(100),
  is_verified BOOLEAN DEFAULT TRUE,
  reward_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Blood Requests Table
CREATE TABLE IF NOT EXISTS public.blood_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id VARCHAR(50) UNIQUE NOT NULL,
  hospital_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  hospital_name VARCHAR(255),
  blood_group VARCHAR(10) NOT NULL,
  units_required INTEGER NOT NULL,
  units_fulfilled INTEGER DEFAULT 0,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  patient_name VARCHAR(255),
  patient_age INTEGER,
  patient_condition TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dispatched', 'delivered', 'cancelled', 'rejected', 'donor_alert')),
  assigned_blood_bank_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_blood_bank_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Blood Inventory Table
CREATE TABLE IF NOT EXISTS public.blood_inventory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  blood_bank_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  blood_bank_name VARCHAR(255),
  blood_group VARCHAR(10) NOT NULL,
  component_type VARCHAR(100) DEFAULT 'Whole Blood',
  units INTEGER NOT NULL DEFAULT 0,
  collection_date DATE,
  expiry_date DATE,
  donor_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'expired', 'discarded', 'expiring_soon')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Donation History Table
CREATE TABLE IF NOT EXISTS public.donation_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  donor_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  blood_bank_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  blood_group VARCHAR(10),
  units INTEGER DEFAULT 1,
  donation_date DATE,
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Donor Responses Table
CREATE TABLE IF NOT EXISTS public.donor_responses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  blood_request_id TEXT NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  donor_name VARCHAR(255),
  action VARCHAR(20) NOT NULL CHECK (action IN ('accept', 'reject')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  reference_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Idempotent migrations for databases created with an earlier schema
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.blood_requests ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.blood_inventory ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.blood_inventory ADD COLUMN IF NOT EXISTS component_type VARCHAR(100) DEFAULT 'Whole Blood';
ALTER TABLE public.donation_history ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.donor_responses ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.notifications ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.donation_history ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);
ALTER TABLE public.donation_history ADD COLUMN IF NOT EXISTS donation_category VARCHAR(100) DEFAULT 'Whole Blood';
ALTER TABLE public.donation_history ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE public.donation_history ADD COLUMN IF NOT EXISTS reward_points_awarded INTEGER DEFAULT 0;

-- Donor Health Profiles Table
CREATE TABLE IF NOT EXISTS public.donor_health_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  donor_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  dob DATE,
  age INTEGER,
  gender VARCHAR(50),
  blood_group VARCHAR(10),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  phone VARCHAR(50),
  has_donated_before BOOLEAN DEFAULT FALSE,
  last_donation_date DATE,
  previous_donation_type VARCHAR(100),
  previous_complications TEXT,
  recent_donation_notes TEXT,
  has_medical_conditions BOOLEAN DEFAULT FALSE,
  medical_conditions_details TEXT,
  taking_medications BOOLEAN DEFAULT FALSE,
  medications_details TEXT,
  recent_fever_illness BOOLEAN DEFAULT FALSE,
  fever_illness_details TEXT,
  relevant_medical_history TEXT,
  report_status VARCHAR(50) DEFAULT 'submitted',
  hospital_assessment_status VARCHAR(50) DEFAULT 'awaiting_assessment',
  is_eligible BOOLEAN,
  screening_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donor Assessments & Screening Workflow Table
CREATE TABLE IF NOT EXISTS public.donor_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  response_id TEXT REFERENCES public.donor_responses(id) ON DELETE CASCADE,
  blood_request_id TEXT REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'accepted',
  reached_at TIMESTAMPTZ,
  screening_weight NUMERIC,
  screening_blood_pressure VARCHAR(50),
  screening_hemoglobin NUMERIC,
  screening_pulse INTEGER,
  screening_temperature NUMERIC,
  screening_notes TEXT,
  assessment_result VARCHAR(50),
  assessment_notes TEXT,
  assessed_by VARCHAR(255),
  assessed_at TIMESTAMPTZ,
  donation_started_at TIMESTAMPTZ,
  donation_completed_at TIMESTAMPTZ,
  donation_verified_at TIMESTAMPTZ,
  donation_type VARCHAR(100) DEFAULT 'Whole Blood',
  units_collected INTEGER DEFAULT 1,
  reward_points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.blood_requests DROP CONSTRAINT IF EXISTS blood_requests_status_check;
ALTER TABLE public.blood_requests
  ADD CONSTRAINT blood_requests_status_check
  CHECK (status IN ('pending', 'approved', 'dispatched', 'delivered', 'cancelled', 'rejected', 'donor_alert'));

-- 9. Performance Indexes for API filters & map queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_blood_group ON public.users(role, blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_requests_hospital ON public.blood_requests(hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_bank_status ON public.blood_inventory(blood_bank_id, status);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor ON public.donation_history(donor_id, donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_donor_responses_donor ON public.donor_responses(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donor_responses_request ON public.donor_responses(blood_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- 10. Seed Default Demo Accounts (password for all demo accounts: "demo123")
INSERT INTO public.users (id, name, email, password, role, phone, address, city, state, blood_group, latitude, longitude, license_number, is_verified, reward_points)
VALUES
  ('hosp-01', 'Metropolitan General Hospital', 'hospital@demo.com', '$2b$10$1OBYwrFCGf8dm1ytVtMlD.X6DlCA3vGYGcKANNQLu/iSNcJN5tblC', 'hospital', '+1 (555) 234-5678', '450 Mercy Parkway', 'New York', 'NY', NULL, 40.75800000, -73.98550000, NULL, TRUE, 0),
  ('bb-01', 'Central Red Cross Blood Bank', 'bloodbank@demo.com', '$2b$10$1OBYwrFCGf8dm1ytVtMlD.X6DlCA3vGYGcKANNQLu/iSNcJN5tblC', 'blood_bank', '+1 (555) 345-6789', '123 Main St', 'New York', 'NY', NULL, 40.74840000, -73.98570000, 'FDA-BB-NY-8912', TRUE, 0),
  ('bb-02', 'Metropolitan Life Blood Depot', 'depot@demo.com', '$2b$10$1OBYwrFCGf8dm1ytVtMlD.X6DlCA3vGYGcKANNQLu/iSNcJN5tblC', 'blood_bank', '+1 (555) 456-7890', '782 Lexington Ave', 'New York', 'NY', NULL, 40.76240000, -73.96780000, 'FDA-BB-NY-4421', TRUE, 0),
  ('donor-01', 'Marcus Bell', 'donor@demo.com', '$2b$10$1OBYwrFCGf8dm1ytVtMlD.X6DlCA3vGYGcKANNQLu/iSNcJN5tblC', 'donor', '+1 (555) 789-0123', '142 W 57th St', 'New York', 'NY', 'O+', 40.76480000, -73.98080000, NULL, TRUE, 750),
  ('donor-02', 'Sarah Connor', 'sarah@demo.com', '$2b$10$1OBYwrFCGf8dm1ytVtMlD.X6DlCA3vGYGcKANNQLu/iSNcJN5tblC', 'donor', '+1 (555) 890-1234', '220 E 42nd St', 'New York', 'NY', 'O-', 40.75050000, -73.97340000, NULL, TRUE, 920)
ON CONFLICT (id) DO NOTHING;

-- 11. Seed Blood Inventory
INSERT INTO public.blood_inventory (id, blood_bank_id, blood_bank_name, blood_group, component_type, units, collection_date, expiry_date, donor_name, status)
VALUES
  ('inv-1', 'bb-01', 'Central Red Cross Blood Bank', 'O+', 'Whole Blood', 48, CURRENT_DATE - 15, CURRENT_DATE + 27, 'Marcus Bell', 'available'),
  ('inv-2', 'bb-01', 'Central Red Cross Blood Bank', 'O-', 'Whole Blood', 24, CURRENT_DATE - 20, CURRENT_DATE + 22, 'Sarah Connor', 'available'),
  ('inv-3', 'bb-01', 'Central Red Cross Blood Bank', 'A+', 'Whole Blood', 42, CURRENT_DATE - 10, CURRENT_DATE + 32, 'David Kim', 'available'),
  ('inv-4', 'bb-01', 'Central Red Cross Blood Bank', 'B+', 'Whole Blood', 30, CURRENT_DATE - 18, CURRENT_DATE + 24, 'Anita Roy', 'available'),
  ('inv-5', 'bb-01', 'Central Red Cross Blood Bank', 'AB+', 'Whole Blood', 18, CURRENT_DATE - 5, CURRENT_DATE + 37, 'Elena Rostova', 'available'),
  ('inv-6', 'bb-01', 'Central Red Cross Blood Bank', 'A-', 'Whole Blood', 14, CURRENT_DATE - 25, CURRENT_DATE + 17, 'James Wright', 'available'),
  ('inv-7', 'bb-01', 'Central Red Cross Blood Bank', 'B-', 'Whole Blood', 10, CURRENT_DATE - 30, CURRENT_DATE + 12, 'Emily Watson', 'available'),
  ('inv-8', 'bb-01', 'Central Red Cross Blood Bank', 'AB-', 'Whole Blood', 4, CURRENT_DATE - 35, CURRENT_DATE + 7, 'Robert Chen', 'available')
ON CONFLICT (id) DO NOTHING;

-- 12. Seed Blood Requests
INSERT INTO public.blood_requests (id, request_id, hospital_id, hospital_name, blood_group, units_required, units_fulfilled, priority, patient_name, patient_age, patient_condition, status, assigned_blood_bank_id, assigned_blood_bank_name)
VALUES
  ('req-01', 'REQ-9842', 'hosp-01', 'Metropolitan General Hospital', 'O-', 4, 4, 'critical', 'David Miller', 48, 'Polytrauma / Severe Hemorrhage', 'dispatched', 'bb-01', 'Central Red Cross Blood Bank'),
  ('req-02', 'REQ-9839', 'hosp-01', 'Metropolitan General Hospital', 'A+', 2, 2, 'high', 'Elena Rostova', 34, 'Postpartum Hemorrhage', 'approved', 'bb-01', 'Central Red Cross Blood Bank'),
  ('req-03', 'REQ-9835', 'hosp-01', 'Metropolitan General Hospital', 'B+', 3, 0, 'critical', 'Robert Chen', 62, 'Cardiovascular Aortic Repair', 'pending', NULL, NULL),
  ('req-04', 'REQ-9828', 'hosp-01', 'Metropolitan General Hospital', 'AB-', 1, 1, 'medium', 'Sarah Jenkins', 27, 'Severe Aplastic Anemia', 'delivered', 'bb-01', 'Central Red Cross Blood Bank')
ON CONFLICT (id) DO NOTHING;

-- 13. Seed Donation History
INSERT INTO public.donation_history (id, donor_id, blood_bank_id, blood_group, units, donation_date, location, notes)
VALUES
  ('don-hist-1', 'donor-01', 'bb-01', 'O+', 1, CURRENT_DATE - 90, 'Central Red Cross Blood Bank', 'Whole blood (PRBC)'),
  ('don-hist-2', 'donor-01', 'bb-02', 'O+', 1, CURRENT_DATE - 176, 'Metropolitan Life Blood Depot', 'Whole blood (PRBC)'),
  ('don-hist-3', 'donor-01', 'bb-01', 'O+', 1, CURRENT_DATE - 274, 'City Memorial Blood Drive', 'Whole blood (PRBC)')
ON CONFLICT (id) DO NOTHING;

-- 14. Seed Notifications
INSERT INTO public.notifications (id, user_id, title, message, type, reference_id, is_read)
VALUES
  ('notif-1', 'hosp-01', 'Blood Dispatched from Central Bank', '4 Units of O- have been loaded into cold-chain vehicle TRK-881. ETA 11 mins.', 'dispatch', 'req-01', FALSE),
  ('notif-2', 'bb-01', 'New Emergency Blood Request', 'Metropolitan General Hospital needs 4 units of O- blood. Priority: critical', 'blood_request', 'req-01', FALSE),
  ('notif-3', 'donor-01', 'Emergency Blood Donation Alert!', 'Urgent need for O+ blood at Metropolitan General Hospital. 2 units needed.', 'emergency_alert', 'req-02', FALSE)
ON CONFLICT (id) DO NOTHING;
