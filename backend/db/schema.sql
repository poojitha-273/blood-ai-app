-- Users table (hospitals, blood banks, donors)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('hospital', 'blood_bank', 'donor')),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  blood_group VARCHAR(5),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  license_number VARCHAR(100),
  is_verified BOOLEAN DEFAULT FALSE,
  reward_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blood requests table
CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id VARCHAR(50) UNIQUE NOT NULL,
  hospital_id UUID REFERENCES users(id),
  hospital_name VARCHAR(255),
  blood_group VARCHAR(5) NOT NULL,
  units_required INTEGER NOT NULL,
  units_fulfilled INTEGER DEFAULT 0,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium')),
  patient_name VARCHAR(255),
  patient_age INTEGER,
  patient_condition TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dispatched', 'delivered', 'cancelled', 'donor_alert')),
  assigned_blood_bank_id UUID REFERENCES users(id),
  assigned_blood_bank_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blood inventory table
CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blood_bank_id UUID REFERENCES users(id),
  blood_bank_name VARCHAR(255),
  blood_group VARCHAR(5) NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  collection_date DATE,
  expiry_date DATE,
  donor_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'expired', 'discarded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donation history
CREATE TABLE IF NOT EXISTS donation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID REFERENCES users(id),
  blood_bank_id UUID REFERENCES users(id),
  blood_group VARCHAR(5),
  units INTEGER DEFAULT 1,
  donation_date DATE,
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donor responses to blood requests
CREATE TABLE IF NOT EXISTS donor_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blood_request_id UUID REFERENCES blood_requests(id),
  donor_id UUID REFERENCES users(id),
  donor_name VARCHAR(255),
  action VARCHAR(20) CHECK (action IN ('accept', 'reject')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_blood_group ON users(blood_group);
CREATE INDEX idx_blood_requests_hospital ON blood_requests(hospital_id);
CREATE INDEX idx_blood_requests_status ON blood_requests(status);
CREATE INDEX idx_blood_inventory_bank ON blood_inventory(blood_bank_id);
CREATE INDEX idx_blood_inventory_group ON blood_inventory(blood_group);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_donor_responses_request ON donor_responses(blood_request_id);
