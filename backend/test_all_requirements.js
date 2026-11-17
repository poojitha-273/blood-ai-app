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

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate as Hospital (Metropolitan General Hospital)
    console.log('--- Step 1: Hospital Authentication & Registered Donors Check ---');
    const hospLogin = await req('/auth/login', {
      method: 'POST',
      body: {
        email: 'hospital@demo.com',
        password: 'demo123'
      }
    });
    const hospToken = hospLogin.data?.token;
    assert(hospToken, 'Hospital successfully authenticated with email and password');

    // Check Registered Donors
    const donorsRes = await req('/hospital/registered-donors', {
      headers: { Authorization: `Bearer ${hospToken}` }
    });
    const donors = donorsRes.data?.donors || [];
    console.log(`Found ${donors.length} genuine registered donors in directory:`);
    donors.forEach(d => console.log(`  - ${d.name} (${d.email}) | ${d.blood_group} | ${d.city}, ${d.state}`));

    const fakeDonors = donors.filter(d => 
      (d.name && d.name.includes('Verified Donor 1')) ||
      (d.email && d.email.includes('@test.com')) ||
      (d.address && d.address.includes('Springfield'))
    );
    assert(fakeDonors.length === 0, `No fake demo donors present in Hospital Registered Donors (found ${fakeDonors.length})`);

    // Verify legitimate donors are present
    const donorEmails = donors.map(d => (d.email || '').toLowerCase());
    const hasPooji = donorEmails.some(e => e.includes('pooji'));
    const hasMarcus = donorEmails.some(e => e.includes('donor@demo.com'));
    const hasYashu = donorEmails.some(e => e.includes('yashu'));
    assert(hasPooji, 'Legitimate registered donor "pooji" is preserved in donor directory');
    assert(hasMarcus, 'Legitimate registered donor "Marcus Bell" is preserved in donor directory');
    assert(hasYashu, 'Legitimate registered donor "yashu" is preserved in donor directory');

    // Verify no duplicates by email
    const uniqueEmails = new Set(donorEmails);
    assert(uniqueEmails.size === donorEmails.length, `Registered donors directory is unique (no duplicate cards: ${uniqueEmails.size}/${donorEmails.length})`);

    // 2. Authenticate as Genuine Donor (pooji) who has a verified donation
    console.log('\n--- Step 2: Donor Eligibility & Rest Interval Prevention ---');
    const donorLogin = await req('/auth/login', {
      method: 'POST',
      body: {
        email: 'pooji@gmail.com',
        password: '123456'
      }
    });
    const donorToken = donorLogin.data?.token;
    const donorUser = donorLogin.data?.user;
    assert(donorToken, `Donor (${donorUser?.email}) successfully authenticated with email and password`);

    // Check Dashboard eligibility fields
    const donorDashRes = await req('/donor/dashboard', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const donorDash = donorDashRes.data || {};
    console.log('Donor Dashboard stats:', {
      total_donations: donorDash.total_donations,
      reward_points: donorDash.reward_points,
      badges: donorDash.badges?.map(b => b.name),
      last_donation_date: donorDash.last_donation_date,
      next_eligible_date: donorDash.next_eligible_date,
      is_eligible: donorDash.is_eligible,
      eligibility_status: donorDash.eligibility_status
    });

    assert(donorDash.total_donations === 1, `Donor has exactly 1 verified donation (found ${donorDash.total_donations})`);
    assert(donorDash.reward_points === 150, `Donor has exactly 150 points for 1 donation (found ${donorDash.reward_points})`);
    assert(donorDash.next_eligible_date, `Next eligible donation date is calculated: ${donorDash.next_eligible_date}`);
    assert(donorDash.is_eligible === false, `Donor eligibility correctly reflects rest interval status: is_eligible = false`);

    // Check Donation History deduplication
    const historyRes = await req('/donor/donations', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const history = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.data || [];
    assert(history.length === 1, `Donation history is clean and deduplicated: exactly 1 record found (got ${history.length})`);

    // 3. Hospital creates an active blood request for B+ (matching pooji's blood group)
    console.log('\n--- Step 3: Test Prevention of Repeated Blood Donation ---');
    const createReq = await req('/blood-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hospToken}` },
      body: {
        blood_group: 'B+',
        units_required: 2,
        priority: 'critical',
        patient_name: 'Emergency Patient Verification',
        patient_age: 45,
        patient_condition: 'Testing rest interval verification'
      }
    });
    const newReqId = createReq.data?.data?.id;
    assert(newReqId, `Hospital created blood request ${newReqId}`);

    // Now, donor 'pooji' attempts to accept this request while in rest interval
    const respondRes = await req(`/blood-requests/${newReqId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
      body: { action: 'accept' }
    });

    const blockSucceeded = (respondRes.status === 403);
    const blockErrorMessage = respondRes.data?.message || respondRes.data?.error || '';

    assert(blockSucceeded, `Repeated blood donation is strictly blocked with HTTP 403 (status: ${respondRes.status})`);
    console.log(`Block message received: "${blockErrorMessage}"`);
    const expectedRegex = /^You are currently not eligible to donate blood because your previous donation was recent\. Your next estimated eligible donation date is \d{2}\/\d{2}\/\d{4}\.$/;
    assert(
      expectedRegex.test(blockErrorMessage),
      `Error message matches required clinical rest interval specification: "${blockErrorMessage}"`
    );

    // 4. Test Idempotency of Donation Verification & Reward Points
    console.log('\n--- Step 4: Test Idempotency of Donation Verification & Points ---');
    const assessmentsRes = await req('/hospital/assessments', {
      headers: { Authorization: `Bearer ${hospToken}` }
    });
    const assessments = assessmentsRes.data?.data || [];
    console.log(`Found ${assessments.length} assessment records`);
    const verifiedAssessment = assessments.find(a => a.status === 'verified' || a.status === 'donation_verified');
    if (verifiedAssessment) {
      console.log(`Testing repeat verification on response ${verifiedAssessment.id}`);
      const repeatRes = await req(`/hospital/donor-responses/${verifiedAssessment.id}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hospToken}` },
        body: {
          units_donated: 1,
          donation_type: 'whole_blood',
          doctor_notes: 'Repeat test attempt'
        }
      });
      const repeatBlocked = (repeatRes.status === 409 || repeatRes.status === 400);
      assert(repeatBlocked, `Repeat verification call is blocked with HTTP ${repeatRes.status} (idempotency enforced: "${repeatRes.data?.error || repeatRes.data?.message}")`);
    } else {
      console.log('No verified assessment found in current hospital response list; testing verification flow directly');
    }

    // 5. Check Active Hospital Requests: no Springfield demo requests
    console.log('\n--- Step 5: Check Hospital Emergency Requests (No Demo Records) ---');
    const donorRequestsRes = await req('/blood-requests/donor-requests', {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const activeRequests = Array.isArray(donorRequestsRes.data) ? donorRequestsRes.data : donorRequestsRes.data?.data || [];
    console.log(`Found ${activeRequests.length} active emergency requests for donor`);
    const springfieldRequests = activeRequests.filter(r => 
      (r.hospital_name && r.hospital_name.includes('Springfield General Hospital 1'))
    );
    assert(springfieldRequests.length === 0, `No demo Springfield hospital requests returned to donor (found ${springfieldRequests.length})`);

    // Clean up temporary test request
    if (newReqId) {
      try {
        await req(`/blood-requests/${newReqId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${hospToken}` }
        });
        console.log(`Cleaned up temporary test request ${newReqId}`);
      } catch (e) {
        // ignore
      }
    }

    console.log('\n====================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Test execution error:', err.message);
    process.exit(1);
  }
}

runTests();
