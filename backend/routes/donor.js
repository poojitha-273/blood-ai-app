const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Helper: Donation interval according to medical guidelines
function getDonationIntervalDays(donationType) {
  const dt = String(donationType || '').toLowerCase();
  if (dt.includes('platelet') || dt.includes('apheresis')) return 7;
  if (dt.includes('plasma')) return 28;
  if (dt.includes('double') || dt.includes('2rbc') || dt.includes('red cell')) return 112;
  return 56; // Standard Whole Blood: 56 days (8 weeks)
}

// Get donor dashboard stats
router.get('/dashboard', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    const { data: donations } = await supabase
      .from('donation_history')
      .select('*')
      .eq('donor_id', req.user.id)
      .order('donation_date', { ascending: false });

    const { data: responses } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('donor_id', req.user.id)
      .order('created_at', { ascending: false });

    const { data: emergencyRequests } = await supabase
      .from('blood_requests')
      .select('*')
      .in('status', ['pending', 'donor_alert'])
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: healthProfile } = await supabase
      .from('donor_health_profiles')
      .select('*')
      .eq('donor_id', req.user.id)
      .single();

    const { data: assessments } = await supabase
      .from('donor_assessments')
      .select('*')
      .eq('donor_id', req.user.id)
      .order('created_at', { ascending: false });

    // Calculate last donation date & next eligible date
    let lastDonationDate = null;
    let previousDonationType = 'Whole Blood';

    if (donations && donations.length > 0 && donations[0].donation_date) {
      lastDonationDate = donations[0].donation_date;
      previousDonationType = donations[0].donation_category || 'Whole Blood';
    } else if (healthProfile && healthProfile.last_donation_date) {
      lastDonationDate = healthProfile.last_donation_date;
      previousDonationType = healthProfile.previous_donation_type || 'Whole Blood';
    }

    let nextEligibleDate = null;
    let isEligible = false;
    let eligibilityStatus = 'Health Profile Incomplete';
    let eligibilityReason = 'Please complete your health profile questionnaire';

    const intervalDays = getDonationIntervalDays(previousDonationType);

    if (lastDonationDate) {
      const lastTime = new Date(lastDonationDate).getTime();
      nextEligibleDate = new Date(lastTime + intervalDays * 24 * 60 * 60 * 1000).toISOString();
      const isPastInterval = Date.now() >= new Date(nextEligibleDate).getTime();

      if (!isPastInterval) {
        eligibilityStatus = 'Temporarily Deferred';
        eligibilityReason = `Mandatory rest interval active (${intervalDays} days for ${previousDonationType}). Next eligible on ${new Date(nextEligibleDate).toLocaleDateString()}.`;
      } else if (!healthProfile || !healthProfile.weight_kg) {
        eligibilityStatus = 'Health Profile Incomplete';
        eligibilityReason = 'Please complete your health profile & medical questionnaire.';
      } else if (healthProfile.recent_fever_illness) {
        eligibilityStatus = 'Temporarily Deferred';
        eligibilityReason = 'Recent illness or fever reported in past 28 days.';
      } else {
        eligibilityStatus = 'Eligible After Hospital Assessment';
        eligibilityReason = 'Rest interval satisfied. Final medical eligibility is determined by hospital clinical staff.';
        isEligible = true;
      }
    } else {
      if (!healthProfile || !healthProfile.weight_kg) {
        eligibilityStatus = 'Health Profile Incomplete';
        eligibilityReason = 'Please complete your health profile questionnaire.';
      } else if (healthProfile.recent_fever_illness) {
        eligibilityStatus = 'Temporarily Deferred';
        eligibilityReason = 'Recent illness or fever reported in past 28 days.';
      } else {
        eligibilityStatus = 'Eligible After Hospital Assessment';
        eligibilityReason = 'No prior donations on record. Final medical eligibility is determined by hospital clinical staff.';
        isEligible = true;
      }
    }

    // Calculate badges based on verified donations
    const verifiedDonations = (donations || []).filter(d => !d.verification_status || d.verification_status === 'verified');
    const verifiedAssessments = (assessments || []).filter(a => a.status === 'donation_verified');
    const totalDonations = Math.max(verifiedDonations.length, verifiedAssessments.length);
    const badges = [];
    if (totalDonations >= 1) badges.push({ name: 'First Drop Hero', icon: '🩸', description: 'First verified donation completed' });
    if (totalDonations >= 5) badges.push({ name: 'Regular Responder', icon: '⭐', description: '5 verified donations completed' });
    if (totalDonations >= 10) badges.push({ name: 'Life Saver Champion', icon: '🏆', description: '10 verified donations completed' });
    if (totalDonations >= 25) badges.push({ name: 'Blood Champion', icon: '👑', description: '25 verified donations completed' });
    if (user?.blood_group === 'O-' && totalDonations >= 1) badges.push({ name: 'Universal Angel', icon: '👑', description: 'Universal blood group verified donor' });
    if (totalDonations >= 1) badges.push({ name: 'Emergency STAT Hero', icon: '🚨', description: 'Completed and verified emergency response' });

    // Attach latest assessment status to responses
    const enrichedResponses = (responses || []).map(r => {
      const matchAssess = (assessments || []).find(a => a.response_id === r.id || a.blood_request_id === r.blood_request_id);
      return {
        ...r,
        assessment: matchAssess || null,
        current_stage: matchAssess?.status || r.action || 'accepted'
      };
    });

    res.json({
      profile: user,
      health_profile: healthProfile || null,
      total_donations: totalDonations,
      reward_points: user?.reward_points || 0,
      badges,
      last_donation_date: lastDonationDate,
      next_eligible_date: nextEligibleDate,
      donation_interval_days: intervalDays,
      is_eligible: isEligible,
      eligibility_status: eligibilityStatus,
      eligibility_reason: eligibilityReason,
      donation_history: donations || [],
      responses: enrichedResponses,
      emergency_requests: emergencyRequests || []
    });
  } catch (error) {
    console.error('Fetch donor dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch donor dashboard' });
  }
});

// Update donor profile
router.patch('/profile', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { name, phone, address, city, state, blood_group } = req.body;
    const updateData = { updated_at: new Date().toISOString() };
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (blood_group) updateData.blood_group = blood_group;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Profile updated', data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get donation history
router.get('/donations', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donation_history')
      .select('*')
      .eq('donor_id', req.user.id)
      .order('donation_date', { ascending: false });

    if (error) throw error;

    // Deduplicate any repeated entries for the same donation event
    const uniqueDonations = [];
    const seen = new Set();
    for (const d of (data || [])) {
      const key = `${d.donation_date}_${d.location || d.hospital_name || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueDonations.push(d);
    }

    res.json(uniqueDonations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donation history' });
  }
});

// Get donor's own responses
router.get('/responses', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('donor_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donor responses' });
  }
});

// Get donor's health profile
router.get('/health-profile', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('donor_health_profiles')
      .select('*')
      .eq('donor_id', req.user.id)
      .single();

    // Also get user record for fallback personal info
    const { data: user } = await supabase
      .from('users')
      .select('name, email, phone, blood_group')
      .eq('id', req.user.id)
      .single();

    const profileData = data || {
      full_name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      blood_group: user?.blood_group || '',
      report_status: 'draft',
      hospital_assessment_status: 'awaiting_assessment'
    };

    res.json(profileData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch health profile' });
  }
});

// Save / Update donor health profile & questionnaire
router.post('/health-profile', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const {
      full_name, dob, age, gender, blood_group, height_cm, weight_kg, phone,
      has_donated_before, last_donation_date, previous_donation_type,
      previous_complications, recent_donation_notes,
      has_medical_conditions, medical_conditions_details,
      taking_medications, medications_details,
      recent_fever_illness, fever_illness_details,
      relevant_medical_history
    } = req.body;

    // Check if profile exists
    const { data: existing } = await supabase
      .from('donor_health_profiles')
      .select('id')
      .eq('donor_id', req.user.id)
      .single();

    const profilePayload = {
      donor_id: req.user.id,
      full_name: full_name || req.user.name,
      dob: dob || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      blood_group: blood_group || null,
      height_cm: height_cm ? Number(height_cm) : null,
      weight_kg: weight_kg ? Number(weight_kg) : null,
      phone: phone || null,
      has_donated_before: Boolean(has_donated_before),
      last_donation_date: last_donation_date || null,
      previous_donation_type: previous_donation_type || 'Whole Blood',
      previous_complications: previous_complications || null,
      recent_donation_notes: recent_donation_notes || null,
      has_medical_conditions: Boolean(has_medical_conditions),
      medical_conditions_details: medical_conditions_details || null,
      taking_medications: Boolean(taking_medications),
      medications_details: medications_details || null,
      recent_fever_illness: Boolean(recent_fever_illness),
      fever_illness_details: fever_illness_details || null,
      relevant_medical_history: relevant_medical_history || null,
      report_status: 'submitted',
      hospital_assessment_status: 'awaiting_assessment',
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('donor_health_profiles')
        .update(profilePayload)
        .eq('donor_id', req.user.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      profilePayload.created_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('donor_health_profiles')
        .insert(profilePayload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    // Sync blood_group and name to users table
    const userUpdates = {};
    if (blood_group) userUpdates.blood_group = blood_group;
    if (full_name) userUpdates.name = full_name;
    if (phone) userUpdates.phone = phone;
    if (Object.keys(userUpdates).length > 0) {
      await supabase.from('users').update(userUpdates).eq('id', req.user.id);
    }

    res.json({ message: 'Health profile saved successfully', profile: result });
  } catch (error) {
    console.error('Save health profile error:', error);
    res.status(500).json({ error: 'Failed to save health profile' });
  }
});

// Generate and get structured donor health report
router.get('/health-report', authenticateToken, authorizeRole('donor'), async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    const { data: hp } = await supabase
      .from('donor_health_profiles')
      .select('*')
      .eq('donor_id', req.user.id)
      .single();

    const { data: donations } = await supabase
      .from('donation_history')
      .select('*')
      .eq('donor_id', req.user.id)
      .order('donation_date', { ascending: false });

    const lastDonation = (donations && donations.length > 0) ? donations[0].donation_date : (hp?.last_donation_date || 'None on record');

    const report = {
      donor_id: req.user.id,
      full_name: hp?.full_name || user?.name || 'Registered Donor',
      email: user?.email,
      phone: hp?.phone || user?.phone || 'Not provided',
      blood_group: hp?.blood_group || user?.blood_group || 'Not recorded',
      age: hp?.age || null,
      gender: hp?.gender || 'Not specified',
      height_cm: hp?.height_cm || null,
      weight_kg: hp?.weight_kg || null,
      last_donation_date: lastDonation,
      has_donated_before: hp?.has_donated_before ?? (donations && donations.length > 0),
      previous_donation_type: hp?.previous_donation_type || (donations && donations[0]?.donation_category) || 'Whole Blood',
      medical_history: {
        has_conditions: hp?.has_medical_conditions || false,
        conditions_details: hp?.medical_conditions_details || 'None reported',
        taking_medications: hp?.taking_medications || false,
        medications_details: hp?.medications_details || 'None reported',
        recent_fever_illness: hp?.recent_fever_illness || false,
        fever_details: hp?.fever_illness_details || 'None reported',
        relevant_history: hp?.relevant_medical_history || 'No prior surgeries/complications reported',
      },
      submission_date: hp?.updated_at || hp?.created_at || user?.created_at,
      report_status: hp?.report_status || 'submitted',
      hospital_assessment_status: hp?.hospital_assessment_status || 'awaiting_assessment',
      consent_notice: 'The donor has consented to share this health report with authorized medical staff for donation eligibility evaluation.'
    };

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate health report' });
  }
});

module.exports = router;
