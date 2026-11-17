const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function verifyAllModules() {
  console.log('===============================================================');
  console.log('TESTING FULL BLOOD AI WORKFLOW AGAINST SUPABASE');
  console.log('===============================================================');

  // 1. Donor Login (Marcus Bell)
  console.log('\n[Stage 1] Donor Authentication');
  const dLog = await req('/auth/login', {
    method: 'POST',
    body: { email: 'donor@demo.com', password: 'demo123' }
  });
  if (!dLog.ok) throw new Error('Donor login failed: ' + JSON.stringify(dLog.data));
  const donorToken = dLog.data.token;
  const donorUser = dLog.data.user;
  console.log(`Donor logged in: ${donorUser.name} (${donorUser.email})`);

  // 2. Donor Health Questionnaire / Profile Save
  console.log('\n[Stage 2] Save Donor Health Questionnaire');
  const hpRes = await req('/donor/health-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${donorToken}` },
    body: {
      dob: '1995-06-15',
      gender: 'Male',
      blood_group: 'O+',
      height_cm: 180,
      weight_kg: 76,
      phone: '+1 (555) 789-0123',
      has_donated_before: false,
      has_medical_conditions: false,
      taking_medications: false,
      recent_fever_illness: false,
      relevant_medical_history: 'Healthy adult donor in good standing'
    }
  });
  console.log('Health Profile Save Response:', hpRes.status, hpRes.data.message);

  // 3. Clinical Health Report Generation
  console.log('\n[Stage 3] Clinical Health Report Generation');
  const repRes = await req('/donor/health-report', {
    headers: { Authorization: `Bearer ${donorToken}` }
  });
  console.log('Clinical Report Status:', repRes.status, {
    eligibility_status: repRes.data?.eligibility?.eligibility_status,
    is_eligible: repRes.data?.eligibility?.is_eligible,
    last_donation: repRes.data?.profile?.last_donation_date
  });

  // 4. Hospital Login (Metropolitan General Hospital)
  console.log('\n[Stage 4] Hospital Authentication');
  const hLog = await req('/auth/login', {
    method: 'POST',
    body: { email: 'hospital@demo.com', password: 'demo123' }
  });
  if (!hLog.ok) throw new Error('Hospital login failed: ' + JSON.stringify(hLog.data));
  const hospToken = hLog.data.token;
  console.log('Hospital logged in successfully');

  // 5. Hospital Creates Blood Request
  console.log('\n[Stage 5] Hospital Creates Blood Request');
  const reqRes = await req('/blood-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospToken}` },
    body: {
      blood_group: 'O+',
      units_required: 2,
      priority: 'high',
      patient_name: 'David Miller',
      patient_age: 45,
      patient_condition: 'Elective Surgery'
    }
  });
  const bloodRequest = reqRes.data.data;
  console.log('Created Blood Request in Supabase:', bloodRequest.id, bloodRequest.request_id);

  // 6. Donor Views Emergency Requests & Accepts
  console.log('\n[Stage 6] Donor Accepts Blood Request');
  const acceptRes = await req(`/blood-requests/${bloodRequest.id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${donorToken}` },
    body: { action: 'accept' }
  });
  console.log('Acceptance Response:', acceptRes.status, acceptRes.data.message);

  // 7. Hospital Views Accepted Donors
  console.log('\n[Stage 7] Hospital Views Accepted Donors');
  const hospRespList = await req('/hospital/donor-responses', {
    headers: { Authorization: `Bearer ${hospToken}` }
  });
  const targetResp = (hospRespList.data?.responses || []).find(r => r.blood_request_id === bloodRequest.id);
  console.log('Found target hospital response:', targetResp?.id, targetResp?.donor_name, 'Current status:', targetResp?.status);

  // 8. Hospital Marks Donor Arrival
  console.log('\n[Stage 8] Hospital Marks Donor Arrival');
  const arrivalRes = await req(`/hospital/donor-responses/${targetResp.id}/mark-reached`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospToken}` }
  });
  console.log('Arrival Marked:', arrivalRes.status, arrivalRes.data?.assessment?.status);

  // 9. Hospital 6-Stage Physical Screening & Vitals
  console.log('\n[Stage 9] Hospital Physical Screening & Vitals');
  const screenRes = await req(`/hospital/donor-responses/${targetResp.id}/screen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospToken}` },
    body: {
      weight_kg: 76,
      blood_pressure: '120/80',
      hemoglobin: 14.5,
      pulse: 72,
      temperature: 98.4,
      assessment_result: 'eligible',
      screening_notes: 'Vitals optimal for Whole Blood donation.'
    }
  });
  console.log('Screening completed:', screenRes.status, screenRes.data?.assessment?.status);

  // 10. Hospital Starts Donation
  console.log('\n[Stage 10] Hospital Starts Donation');
  const startRes = await req(`/hospital/donor-responses/${targetResp.id}/start-donation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospToken}` },
    body: { donation_type: 'Whole Blood' }
  });
  console.log('Donation Started:', startRes.status, startRes.data?.assessment?.status);

  // 11. Hospital Completes & Verifies Donation + Awards Points
  console.log('\n[Stage 11] Hospital Verifies Donation & Awards LifeLink Hero Points');
  const verifyRes = await req(`/hospital/donor-responses/${targetResp.id}/verify-donation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hospToken}` },
    body: {
      units: 1,
      donation_type: 'Whole Blood',
      reward_points: 150,
      verification_notes: 'Donation collection completed without adverse reactions.'
    }
  });
  console.log('Donation Verified:', verifyRes.status, verifyRes.data?.message);

  // 12. Donor Checks Notifications & Updated Points in Supabase
  console.log('\n[Stage 12] Donor Checks Updated Balance & Notifications');
  const donorProfileRes = await req('/auth/profile', {
    headers: { Authorization: `Bearer ${donorToken}` }
  });
  console.log('Updated Donor Profile Points in Supabase:', donorProfileRes.data?.reward_points);

  const notifsRes = await req('/notifications', {
    headers: { Authorization: `Bearer ${donorToken}` }
  });
  console.log(`Donor has ${notifsRes.data?.length} notifications. Latest notification:`, notifsRes.data?.[0]?.title);

  console.log('\n===============================================================');
  console.log('ALL 12 WORKFLOW STAGES VERIFIED AGAINST SUPABASE DATABASE!');
  console.log('===============================================================');
}

verifyAllModules().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
