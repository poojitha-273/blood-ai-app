const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

let supabaseUrl = process.env.SUPABASE_URL || 'https://mkmkwvvousvrpghwaldt.supabase.co';
// Ensure URL does not have trailing /rest/v1 or /
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let realClient = null;
try {
  realClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log(`Connected to Supabase project at ${supabaseUrl}`);
} catch (err) {
  console.warn('Could not initialize Supabase client:', err.message);
}

// In-Memory Database for instant fallback if tables are not yet created in Supabase
const salt = bcrypt.genSaltSync(10);
const demoPasswordHash = bcrypt.hashSync('demo123', salt);

const memoryDb = {
  users: [
    {
      id: 'hosp-01',
      name: 'Metropolitan General Hospital',
      email: 'hospital@demo.com',
      password: demoPasswordHash,
      role: 'hospital',
      phone: '+1 (555) 234-5678',
      address: '450 Mercy Parkway',
      city: 'New York',
      state: 'NY',
      blood_group: null,
      latitude: 40.7580,
      longitude: -73.9855,
      is_verified: true,
      reward_points: 0,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
      id: 'donor-01',
      name: 'Marcus Bell',
      email: 'donor@demo.com',
      password: demoPasswordHash,
      role: 'donor',
      phone: '+1 (555) 789-0123',
      address: '142 W 57th St',
      city: 'New York',
      state: 'NY',
      blood_group: 'O+',
      latitude: 40.7648,
      longitude: -73.9808,
      is_verified: true,
      reward_points: 750,
      created_at: new Date(Date.now() - 90 * 86400000).toISOString()
    },
    {
      id: 'donor-02',
      name: 'Sarah Connor',
      email: 'sarah@demo.com',
      password: demoPasswordHash,
      role: 'donor',
      phone: '+1 (555) 890-1234',
      address: '220 E 42nd St',
      city: 'New York',
      state: 'NY',
      blood_group: 'O-',
      latitude: 40.7505,
      longitude: -73.9734,
      is_verified: true,
      reward_points: 920,
      created_at: new Date(Date.now() - 120 * 86400000).toISOString()
    }
  ],

  blood_inventory: [
    { id: 'inv-1', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'O+', units: 48, collection_date: '2026-10-25', expiry_date: '2026-12-06', donor_name: 'Marcus Bell', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-2', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'O-', units: 24, collection_date: '2026-10-20', expiry_date: '2026-12-01', donor_name: 'Sarah Connor', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-3', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'A+', units: 42, collection_date: '2026-10-18', expiry_date: '2026-11-29', donor_name: 'David Kim', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-4', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'B+', units: 30, collection_date: '2026-10-12', expiry_date: '2026-11-23', donor_name: 'Anita Roy', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-5', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'AB+', units: 18, collection_date: '2026-10-15', expiry_date: '2026-11-26', donor_name: 'Elena Rostova', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-6', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'A-', units: 14, collection_date: '2026-10-08', expiry_date: '2026-11-19', donor_name: 'James Wright', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-7', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'B-', units: 10, collection_date: '2026-10-05', expiry_date: '2026-11-16', donor_name: 'Emily Watson', status: 'available', created_at: new Date().toISOString() },
    { id: 'inv-8', hospital_id: 'hosp-01', hospital_name: 'Metropolitan General Hospital', blood_bank_id: 'hosp-01', blood_bank_name: 'Metropolitan General Hospital', blood_group: 'AB-', units: 4, collection_date: '2026-10-02', expiry_date: '2026-11-13', donor_name: 'Robert Chen', status: 'available', created_at: new Date().toISOString() },
  ],

  blood_requests: [
    {
      id: 'req-01',
      request_id: 'REQ-9842',
      hospital_id: 'hosp-01',
      hospital_name: 'Metropolitan General Hospital',
      blood_group: 'O-',
      units_required: 4,
      units_fulfilled: 4,
      priority: 'critical',
      patient_name: 'David Miller',
      patient_age: 48,
      patient_condition: 'Polytrauma / Severe Hemorrhage',
      status: 'dispatched',
      assigned_blood_bank_id: 'bb-01',
      assigned_blood_bank_name: 'Central Red Cross Blood Bank',
      created_at: new Date(Date.now() - 15 * 60000).toISOString()
    },
    {
      id: 'req-02',
      request_id: 'REQ-9839',
      hospital_id: 'hosp-01',
      hospital_name: 'Metropolitan General Hospital',
      blood_group: 'A+',
      units_required: 2,
      units_fulfilled: 2,
      priority: 'high',
      patient_name: 'Elena Rostova',
      patient_age: 34,
      patient_condition: 'Postpartum Hemorrhage',
      status: 'approved',
      assigned_blood_bank_id: 'bb-01',
      assigned_blood_bank_name: 'Central Red Cross Blood Bank',
      created_at: new Date(Date.now() - 90 * 60000).toISOString()
    },
    {
      id: 'req-03',
      request_id: 'REQ-9835',
      hospital_id: 'hosp-01',
      hospital_name: 'Metropolitan General Hospital',
      blood_group: 'B+',
      units_required: 3,
      units_fulfilled: 0,
      priority: 'critical',
      patient_name: 'Robert Chen',
      patient_age: 62,
      patient_condition: 'Cardiovascular Aortic Repair',
      status: 'pending',
      created_at: new Date(Date.now() - 140 * 60000).toISOString()
    },
    {
      id: 'req-04',
      request_id: 'REQ-9828',
      hospital_id: 'hosp-01',
      hospital_name: 'Metropolitan General Hospital',
      blood_group: 'AB-',
      units_required: 1,
      units_fulfilled: 1,
      priority: 'medium',
      patient_name: 'Sarah Jenkins',
      patient_age: 27,
      patient_condition: 'Severe Aplastic Anemia',
      status: 'delivered',
      assigned_blood_bank_id: 'bb-01',
      assigned_blood_bank_name: 'Central Red Cross Blood Bank',
      created_at: new Date(Date.now() - 360 * 60000).toISOString()
    }
  ],

  donation_history: [
    { id: 'don-hist-1', donor_id: 'donor-01', blood_bank_id: 'bb-01', blood_group: 'O+', units: 1, donation_date: '2026-08-14', location: 'Central Red Cross Blood Bank', notes: 'Whole blood (PRBC)' },
    { id: 'don-hist-2', donor_id: 'donor-01', blood_bank_id: 'bb-01', blood_group: 'O+', units: 1, donation_date: '2026-05-20', location: 'Metropolitan Life Blood Depot', notes: 'Whole blood (PRBC)' },
    { id: 'don-hist-3', donor_id: 'donor-01', blood_bank_id: 'bb-01', blood_group: 'O+', units: 1, donation_date: '2026-02-11', location: 'City Memorial Blood Drive', notes: 'Whole blood (PRBC)' },
  ],

  donor_responses: [],
  donor_health_profiles: [],
  donor_assessments: [],

  notifications: [
    { id: 'notif-1', user_id: 'hosp-01', title: 'Blood Dispatched from Central Bank', message: '4 Units of O- have been loaded into cold-chain vehicle TRK-881. ETA 11 mins.', type: 'dispatch', reference_id: 'req-01', is_read: false, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: 'notif-2', user_id: 'bb-01', title: 'New Emergency Blood Request', message: 'Metropolitan General Hospital needs 4 units of O- blood. Priority: critical', type: 'blood_request', reference_id: 'req-01', is_read: false, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 'notif-3', user_id: 'donor-01', title: 'Emergency Blood Donation Alert!', message: 'Urgent need for O+ blood at Metropolitan General Hospital. 2 units needed.', type: 'emergency_alert', reference_id: 'req-02', is_read: false, created_at: new Date(Date.now() - 25 * 60000).toISOString() }
  ]
};

// Resilient wrapper: tries Supabase first; if table not found (PGRST205), falls back to memoryDb
class ResilientQueryBuilder {
  constructor(table) {
    this.table = table;
    this.realQuery = realClient ? realClient.from(table) : null;
    this.filters = [];
    this.limitCount = null;
    this.orderBy = null;
    this.isSingle = false;
    this.insertData = null;
    this.updateData = null;
    this.deleteAction = false;
    this.selectFields = '*';
  }

  select(fields = '*') {
    this.selectFields = fields;
    if (this.realQuery) this.realQuery = this.realQuery.select(fields);
    return this;
  }

  insert(data) {
    this.insertData = data;
    if (this.realQuery) this.realQuery = this.realQuery.insert(data);
    return this;
  }

  update(data) {
    this.updateData = data;
    if (this.realQuery) this.realQuery = this.realQuery.update(data);
    return this;
  }

  delete() {
    this.deleteAction = true;
    if (this.realQuery) this.realQuery = this.realQuery.delete();
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    if (this.realQuery) this.realQuery = this.realQuery.eq(field, value);
    return this;
  }

  in(field, values) {
    this.filters.push({ type: 'in', field, values });
    if (this.realQuery) this.realQuery = this.realQuery.in(field, values);
    return this;
  }

  neq(field, value) {
    this.filters.push({ type: 'neq', field, value });
    if (this.realQuery) this.realQuery = this.realQuery.neq(field, value);
    return this;
  }

  gte(field, value) {
    this.filters.push({ type: 'gte', field, value });
    if (this.realQuery) this.realQuery = this.realQuery.gte(field, value);
    return this;
  }

  lte(field, value) {
    this.filters.push({ type: 'lte', field, value });
    if (this.realQuery) this.realQuery = this.realQuery.lte(field, value);
    return this;
  }

  or(expr) {
    this.filters.push({ type: 'or', expr });
    if (this.realQuery) this.realQuery = this.realQuery.or(expr);
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderBy = { field, ascending };
    if (this.realQuery) this.realQuery = this.realQuery.order(field, { ascending });
    return this;
  }

  limit(count) {
    this.limitCount = count;
    if (this.realQuery) this.realQuery = this.realQuery.limit(count);
    return this;
  }

  single() {
    this.isSingle = true;
    if (this.realQuery) this.realQuery = this.realQuery.single();
    return this;
  }

  executeMemory() {
    if (!memoryDb[this.table]) memoryDb[this.table] = [];
    const collection = memoryDb[this.table];

    if (this.deleteAction) {
      memoryDb[this.table] = collection.filter(item => {
        return !this.filters.every(f => (f.type === 'eq' ? item[f.field] === f.value : true));
      });
      return { data: null, error: null };
    }

    if (this.insertData) {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const inserted = items.map(item => {
        const row = {
          id: item.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          created_at: new Date().toISOString(),
          ...item
        };
        collection.unshift(row);
        return row;
      });
      return { data: this.isSingle ? inserted[0] : inserted, error: null };
    }

    if (this.updateData) {
      const updated = [];
      for (let i = 0; i < collection.length; i++) {
        const item = collection[i];
        const match = this.filters.every(f => (f.type === 'eq' ? item[f.field] === f.value : true));
        if (match) {
          collection[i] = { ...item, ...this.updateData };
          updated.push(collection[i]);
        }
      }
      return { data: this.isSingle ? updated[0] : updated, error: null };
    }

    let results = collection.filter(item => {
      return this.filters.every(f => {
        if (f.type === 'eq') return item[f.field] === f.value;
        if (f.type === 'neq') return item[f.field] !== f.value;
        if (f.type === 'in') return Array.isArray(f.values) && f.values.includes(item[f.field]);
        if (f.type === 'gte') return item[f.field] >= f.value;
        if (f.type === 'lte') return item[f.field] <= f.value;
        return true;
      });
    });

    if (this.orderBy) {
      results.sort((a, b) => {
        const valA = a[this.orderBy.field];
        const valB = b[this.orderBy.field];
        if (valA < valB) return this.orderBy.ascending ? -1 : 1;
        if (valA > valB) return this.orderBy.ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount) {
      results = results.slice(0, this.limitCount);
    }

    return {
      data: this.isSingle ? (results[0] || null) : results,
      error: null
    };
  }

  async execute() {
    if (this.realQuery) {
      try {
        const res = await this.realQuery;
        // If table doesn't exist yet in Supabase (PGRST205) or column missing (42703/PGRST204), seamlessly use memory fallback
        if (res.error && (res.error.code === 'PGRST205' || res.error.code === '42703' || res.error.code === 'PGRST204')) {
          return this.executeMemory();
        }
        return res;
      } catch (err) {
        return this.executeMemory();
      }
    }
    return this.executeMemory();
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }
}

const supabaseWrapper = {
  from: (table) => new ResilientQueryBuilder(table),
  rawClient: realClient
};

module.exports = supabaseWrapper;
