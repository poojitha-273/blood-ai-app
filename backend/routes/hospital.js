const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { hasValidCoords, calculateDistanceKm, forwardGeocode } = require('../services/geoService');
const { sendNotificationEmail, notifyUserWithResend } = require('../services/emailService');

const router = express.Router();

// Get hospital dashboard stats
router.get('/dashboard', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { data: requests } = await supabase
      .from('blood_requests')
      .select('*')
      .eq('hospital_id', req.user.id);

    const stats = {
      total_requests: (requests || []).length,
      pending: (requests || []).filter(r => r.status === 'pending').length,
      approved: (requests || []).filter(r => r.status === 'approved').length,
      dispatched: (requests || []).filter(r => r.status === 'dispatched').length,
      delivered: (requests || []).filter(r => r.status === 'delivered').length,
      critical_requests: (requests || []).filter(r => r.priority === 'critical').length,
      recent_requests: (requests || []).slice(0, 5)
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get nearby blood banks
router.get('/nearby-blood-banks', authenticateToken, async (req, res) => {
  try {
    const { data: bloodBanks, error } = await supabase
      .from('users')
      .select('id, name, phone, address, city, state, latitude, longitude')
      .eq('role', 'blood_bank');

    if (error) throw error;

    // Get inventory for each blood bank
    const banksWithStock = await Promise.all(
      (bloodBanks || []).map(async (bb) => {
        const { data: inventory } = await supabase
          .from('blood_inventory')
          .select('blood_group, units')
          .eq('blood_bank_id', bb.id)
          .eq('status', 'available');

        return {
          ...bb,
          stock: inventory || [],
          total_units: (inventory || []).reduce((sum, i) => sum + (i.units || 0), 0)
        };
      })
    );

    res.json(banksWithStock);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch nearby blood banks' });
  }
});

// Get ONLY registered donors who have signed up in the Donor Portal (with real saved GPS / city coords)
router.get('/registered-donors', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const refLat = Number(req.query.lat);
    const refLng = Number(req.query.lng);
    const hasRef = hasValidCoords(refLat, refLng);
    const bloodGroupFilter = String(req.query.bloodGroup || '').trim().toUpperCase();

    const { data: rows, error } = await supabase
      .from('users')
      .select('id, name, email, phone, address, city, state, blood_group, latitude, longitude, reward_points, is_verified, created_at')
      .eq('role', 'donor')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter out any test/demo records and deduplicate by email
    const genuineRows = [];
    const seenEmails = new Set();
    for (const d of (rows || [])) {
      const email = (d.email || '').toLowerCase().trim();
      const name = (d.name || '').trim();
      if (
        email.endsWith('@test.com') ||
        email.includes('@workflow.test') ||
        email.includes('test_') ||
        name.startsWith('Verified Donor 1') ||
        name.toLowerCase().includes('workflow test') ||
        name.toLowerCase().startsWith('test donor')
      ) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      genuineRows.push(d);
    }

    const resolved = await Promise.all(
      genuineRows.map(async (d) => {
        let lat = hasValidCoords(d.latitude, d.longitude) ? Number(d.latitude) : null;
        let lng = hasValidCoords(d.latitude, d.longitude) ? Number(d.longitude) : null;
        let locationSource = lat !== null ? 'gps' : 'none';

        if (lat === null) {
          const geoQuery =
            [d.address, d.city, d.state].filter(Boolean).join(', ') ||
            [d.city, d.state].filter(Boolean).join(', ');
          if (geoQuery.length >= 2) {
            try {
              const hits = await forwardGeocode(geoQuery, 1, 2500);
              if (hits.length > 0 && hasValidCoords(hits[0].lat, hits[0].lng)) {
                lat = hits[0].lat;
                lng = hits[0].lng;
                locationSource = 'address';
              }
            } catch {
              // Skip if geocoding times out; never fabricate offsets
            }
          }
        }

        const hasLocation = hasValidCoords(lat, lng);
        const distanceKm =
          hasRef && hasLocation
            ? Number(calculateDistanceKm({ lat: refLat, lng: refLng }, { lat, lng }).toFixed(2))
            : null;

        return {
          id: d.id,
          name: d.name || 'Registered Donor',
          email: d.email,
          phone: d.phone || '',
          address: d.address || '',
          city: d.city || '',
          state: d.state || '',
          blood_group: d.blood_group || 'O+',
          latitude: hasLocation ? lat : null,
          longitude: hasLocation ? lng : null,
          hasLocation,
          locationSource,
          reward_points: d.reward_points || 0,
          is_verified: Boolean(d.is_verified),
          created_at: d.created_at,
          distanceKm,
        };
      })
    );

    const filtered = bloodGroupFilter
      ? resolved.filter((d) => (d.blood_group || '').toUpperCase() === bloodGroupFilter)
      : resolved;

    if (hasRef) {
      filtered.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
    }

    const withLocationCount = filtered.filter((d) => d.hasLocation).length;

    res.json({
      totalRegistered: filtered.length,
      withLocationCount,
      withoutLocationCount: filtered.length - withLocationCount,
      donors: filtered,
    });
  } catch (error) {
    console.error('Registered donors fetch error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch registered donors' });
  }
});

// Get all donor responses and clinical assessment workflows for this hospital's requests
router.get('/donor-responses', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    // 1. Get all requests created by this hospital
    const { data: myRequests } = await supabase
      .from('blood_requests')
      .select('*')
      .eq('hospital_id', req.user.id);

    const requestMap = new Map();
    (myRequests || []).forEach(r => requestMap.set(r.id, r));

    if (requestMap.size === 0) {
      return res.json([]);
    }

    const requestIds = Array.from(requestMap.keys());

    // 2. Fetch donor responses for these requests
    const { data: responses, error } = await supabase
      .from('donor_responses')
      .select('*')
      .in('blood_request_id', requestIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter to accepted responses and deduplicate by (donor_id + blood_request_id)
    // Ensures ONE card per unique donor-request combination
    const uniqueResponsesMap = new Map();
    for (const r of (responses || [])) {
      if (r.action !== 'accept') continue;
      const key = `${r.donor_id}_${r.blood_request_id}`;
      if (!uniqueResponsesMap.has(key)) {
        uniqueResponsesMap.set(key, r);
      }
    }
    const deduplicatedResponses = Array.from(uniqueResponsesMap.values());

    // 3. Fetch assessment stages for these blood requests
    const responseIds = deduplicatedResponses.map(r => r.id);
    const { data: assessments } = await supabase
      .from('donor_assessments')
      .select('*')
      .in('blood_request_id', requestIds);

    const assessmentMap = new Map();
    (assessments || []).forEach(a => {
      if (a.response_id) assessmentMap.set(a.response_id, a);
      if (a.donor_id && a.blood_request_id) {
        const pairKey = `${a.donor_id}_${a.blood_request_id}`;
        const existing = assessmentMap.get(pairKey);
        if (!existing) {
          assessmentMap.set(pairKey, a);
        } else {
          const stageOrder = ['accepted', 'reached', 'screened', 'eligible', 'deferred', 'not_eligible', 'donation_started', 'donation_completed', 'donation_verified', 'verified'];
          if (stageOrder.indexOf(a.status) > stageOrder.indexOf(existing.status)) {
            assessmentMap.set(pairKey, a);
          }
        }
      }
    });

    // 4. Fetch real donor users & health profiles
    const donorIds = Array.from(new Set(deduplicatedResponses.map(r => r.donor_id)));
    const { data: donorUsers } = await supabase
      .from('users')
      .select('id, name, email, phone, blood_group, city, state, reward_points')
      .in('id', donorIds);
    const donorUserMap = new Map();
    (donorUsers || []).forEach(u => donorUserMap.set(u.id, u));

    const { data: healthProfiles } = await supabase
      .from('donor_health_profiles')
      .select('*')
      .in('donor_id', donorIds);
    const hpMap = new Map();
    (healthProfiles || []).forEach(hp => hpMap.set(hp.donor_id, hp));

    // Merge into rich, unambiguous assessment cards with real donor identity
    const enriched = deduplicatedResponses.map(r => {
      const bReq = requestMap.get(r.blood_request_id) || {};
      const dUser = donorUserMap.get(r.donor_id) || {};
      const hp = hpMap.get(r.donor_id) || null;
      const assess = assessmentMap.get(r.id) || 
                     assessmentMap.get(`${r.donor_id}_${r.blood_request_id}`) || {
                       status: 'accepted'
                     };

      const donorName = dUser.name || r.donor_name || 'Blood Donor';
      const donorPhone = dUser.phone || '';
      const donorEmail = dUser.email || '';
      const donorBloodGroup = dUser.blood_group || hp?.blood_group || bReq.blood_group || 'O+';
      const rawStage = assess.status || 'accepted';
      const currentStage = rawStage === 'donation_verified' ? 'verified' : rawStage;

      return {
        id: r.id,
        response_id: r.id,
        blood_request_id: r.blood_request_id,
        donor_id: r.donor_id,
        donor_name: donorName,
        donor_phone: donorPhone,
        donor_email: donorEmail,
        donor_blood_group: donorBloodGroup,
        action: r.action,
        created_at: r.created_at,
        current_status: currentStage,
        current_stage: currentStage,
        assessment: { ...assess, status: currentStage },
        health_profile: hp,
        request: {
          id: bReq.id || r.blood_request_id,
          request_id: bReq.request_id || 'REQ',
          blood_group: bReq.blood_group || donorBloodGroup,
          units_required: bReq.units_required || 1,
          units_fulfilled: bReq.units_fulfilled || 0,
          priority: bReq.priority || 'urgent',
          patient_name: bReq.patient_name || 'Emergency Patient',
          patient_condition: bReq.patient_condition || 'Clinical Need',
          status: bReq.status || 'pending'
        },
        // Nested legacy objects for backwards compatibility
        donor: {
          id: r.donor_id,
          name: donorName,
          email: donorEmail,
          phone: donorPhone,
          blood_group: donorBloodGroup,
          city: dUser.city || '',
          state: dUser.state || '',
        },
        blood_requests: {
          id: bReq.id || r.blood_request_id,
          request_id: bReq.request_id || 'REQ',
          blood_group: bReq.blood_group || donorBloodGroup,
          units_required: bReq.units_required || 1,
          units_fulfilled: bReq.units_fulfilled || 0,
          priority: bReq.priority || 'urgent',
          patient_name: bReq.patient_name || 'Emergency Patient',
          patient_condition: bReq.patient_condition || 'Clinical Need',
          status: bReq.status || 'pending'
        }
      };
    }).filter(item => {
      const name = (item.donor_name || '').toLowerCase();
      const email = (item.donor_email || '').toLowerCase();
      return !name.includes('workflow test') && !email.includes('@workflow.test') && !email.endsWith('@test.com');
    });

    res.json(enriched);
  } catch (err) {
    console.error('Fetch hospital donor responses error:', err);
    res.status(500).json({ error: 'Failed to fetch donor responses' });
  }
});

// Get consented donor health report for hospital staff
router.get('/donor-health-report/:donorId', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { donorId } = req.params;

    const { data: donorUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', donorId)
      .single();

    if (!donorUser) {
      return res.status(404).json({ error: 'Donor record not found' });
    }

    const { data: hp } = await supabase
      .from('donor_health_profiles')
      .select('*')
      .eq('donor_id', donorId)
      .single();

    const { data: donations } = await supabase
      .from('donation_history')
      .select('*')
      .eq('donor_id', donorId)
      .order('donation_date', { ascending: false });

    const report = {
      donor_id: donorId,
      full_name: hp?.full_name || donorUser.name,
      email: donorUser.email,
      phone: hp?.phone || donorUser.phone || 'Not provided',
      blood_group: hp?.blood_group || donorUser.blood_group,
      age: hp?.age,
      gender: hp?.gender,
      height_cm: hp?.height_cm,
      weight_kg: hp?.weight_kg,
      last_donation_date: (donations && donations.length > 0) ? donations[0].donation_date : (hp?.last_donation_date || 'No previous donation'),
      has_donated_before: hp?.has_donated_before ?? (donations && donations.length > 0),
      previous_donation_type: hp?.previous_donation_type || (donations && donations[0]?.donation_category) || 'Whole Blood',
      medical_history: {
        has_conditions: hp?.has_medical_conditions || false,
        conditions_details: hp?.medical_conditions_details || 'None reported',
        taking_medications: hp?.taking_medications || false,
        medications_details: hp?.medications_details || 'None reported',
        recent_fever_illness: hp?.recent_fever_illness || false,
        fever_details: hp?.fever_illness_details || 'None reported',
        relevant_history: hp?.relevant_medical_history || 'None reported',
      },
      submission_date: hp?.updated_at || hp?.created_at || donorUser.created_at,
      report_status: hp?.report_status || 'submitted',
      hospital_assessment_status: hp?.hospital_assessment_status || 'awaiting_assessment'
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donor health report' });
  }
});

// Stage 2: Mark donor as reached
router.post('/donor-responses/:responseId/reached', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { responseId } = req.params;

    const { data: resp } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('id', responseId)
      .single();

    if (!resp) return res.status(404).json({ error: 'Response not found' });

    // Check existing assessment record by response_id OR by (donor_id + blood_request_id)
    let existingAssess = null;
    const { data: byResp } = await supabase
      .from('donor_assessments')
      .select('id')
      .eq('response_id', responseId)
      .single();

    if (byResp) {
      existingAssess = byResp;
    } else if (resp.donor_id && resp.blood_request_id) {
      const { data: byPair } = await supabase
        .from('donor_assessments')
        .select('id')
        .eq('donor_id', resp.donor_id)
        .eq('blood_request_id', resp.blood_request_id)
        .single();
      if (byPair) existingAssess = byPair;
    }

    const reachedTime = new Date().toISOString();
    let assessRecord;

    if (existingAssess) {
      const { data } = await supabase
        .from('donor_assessments')
        .update({
          response_id: responseId,
          status: 'reached',
          reached_at: reachedTime,
          updated_at: reachedTime
        })
        .eq('id', existingAssess.id)
        .select()
        .single();
      assessRecord = data;
    } else {
      const { data } = await supabase
        .from('donor_assessments')
        .insert({
          response_id: responseId,
          blood_request_id: resp.blood_request_id,
          donor_id: resp.donor_id,
          hospital_id: req.user.id,
          status: 'reached',
          reached_at: reachedTime,
          created_at: reachedTime,
          updated_at: reachedTime
        })
        .select()
        .single();
      assessRecord = data;
    }

    // Notify donor that hospital confirmed their arrival
    if (resp.donor_id) {
      const notifMsg = `Hospital Arrival Confirmed - You have been checked in at ${req.user.name}. Please proceed to the physical screening station.`;
      await supabase.from('notifications').insert({
        user_id: resp.donor_id,
        title: 'Donor Arrival Confirmed',
        message: notifMsg,
        type: 'donor_reached',
        reference_id: resp.blood_request_id,
        is_read: false,
        created_at: new Date().toISOString()
      });

      const { data: donorUser } = await supabase.from('users').select('email, name').eq('id', resp.donor_id).single();
      if (donorUser?.email) {
        sendNotificationEmail({
          toEmail: donorUser.email,
          recipientName: donorUser.name,
          title: 'Hospital Arrival Confirmed',
          message: notifMsg,
          category: 'donor_reached',
          actionUrl: '/donor/emergency'
        }).catch(() => {});
      }
    }

    res.json({ message: 'Donor marked as reached hospital', assessment: assessRecord });
  } catch (err) {
    console.error('Mark reached error:', err);
    res.status(500).json({ error: 'Failed to update donor arrival status' });
  }
});

// Stage 3 & 4: Physical Screening & Medical Eligibility Decision
router.post('/donor-responses/:responseId/screening', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { responseId } = req.params;
    const {
      screening_weight, screening_blood_pressure, screening_hemoglobin,
      screening_pulse, screening_temperature, screening_notes,
      assessment_result, decision, assessment_notes, assessed_by
    } = req.body;

    const finalResult = assessment_result || decision || 'eligible';

    if (!['eligible', 'deferred', 'not_eligible'].includes(finalResult)) {
      return res.status(400).json({ error: 'Assessment result must be eligible, deferred, or not_eligible' });
    }

    const { data: resp } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('id', responseId)
      .single();

    if (!resp) return res.status(404).json({ error: 'Response record not found' });

    const nowIso = new Date().toISOString();
    const finalStatus = finalResult === 'eligible' ? 'eligible' : finalResult === 'deferred' ? 'deferred' : 'not_eligible';

    const assessmentPayload = {
      status: finalStatus,
      screening_weight: screening_weight ? Number(screening_weight) : null,
      screening_blood_pressure: screening_blood_pressure || null,
      screening_hemoglobin: screening_hemoglobin ? Number(screening_hemoglobin) : null,
      screening_pulse: screening_pulse ? Number(screening_pulse) : null,
      screening_temperature: screening_temperature ? Number(screening_temperature) : null,
      screening_notes: screening_notes || null,
      assessment_result: finalResult,
      assessment_notes: assessment_notes || null,
      assessed_by: assessed_by || req.user.name || 'Hospital Clinical Staff',
      assessed_at: nowIso,
      updated_at: nowIso
    };

    let existingAssess = null;
    const { data: byResp } = await supabase
      .from('donor_assessments')
      .select('id')
      .eq('response_id', responseId)
      .single();

    if (byResp) {
      existingAssess = byResp;
    } else if (resp.donor_id && resp.blood_request_id) {
      const { data: byPair } = await supabase
        .from('donor_assessments')
        .select('id')
        .eq('donor_id', resp.donor_id)
        .eq('blood_request_id', resp.blood_request_id)
        .single();
      if (byPair) existingAssess = byPair;
    }

    let savedAssess;
    if (existingAssess) {
      const { data } = await supabase
        .from('donor_assessments')
        .update({
          response_id: responseId,
          ...assessmentPayload
        })
        .eq('id', existingAssess.id)
        .select()
        .single();
      savedAssess = data;
    } else {
      const { data } = await supabase
        .from('donor_assessments')
        .insert({
          response_id: responseId,
          blood_request_id: resp.blood_request_id,
          donor_id: resp.donor_id,
          hospital_id: req.user.id,
          created_at: nowIso,
          ...assessmentPayload
        })
        .select()
        .single();
      savedAssess = data;
    }

    // Update donor health profile assessment status
    if (resp.donor_id) {
      await supabase
        .from('donor_health_profiles')
        .update({
          hospital_assessment_status: assessment_result,
          is_eligible: assessment_result === 'eligible',
          updated_at: nowIso
        })
        .eq('donor_id', resp.donor_id);

      // Notify donor
      const isElig = assessment_result === 'eligible';
      const notifTitle = isElig ? 'Medical Screening Passed – Eligible to Donate' : 'Screening Assessment – Donation Deferred';
      const notifMsg = isElig
        ? `You have been medically assessed and approved by ${req.user.name}. You may proceed with the donation procedure.`
        : `Your donation assessment at ${req.user.name} has been ${assessment_result}: ${assessment_notes || 'Temporary deferral criteria met'}.`;

      await supabase.from('notifications').insert({
        user_id: resp.donor_id,
        title: notifTitle,
        message: notifMsg,
        type: isElig ? 'screening_eligible' : 'screening_deferred',
        reference_id: resp.blood_request_id,
        is_read: false,
        created_at: nowIso
      });

      const { data: donorUser } = await supabase.from('users').select('email, name').eq('id', resp.donor_id).single();
      if (donorUser?.email) {
        sendNotificationEmail({
          toEmail: donorUser.email,
          recipientName: donorUser.name,
          title: notifTitle,
          message: notifMsg,
          category: isElig ? 'screening_eligible' : 'screening_deferred',
          actionUrl: '/donor/emergency'
        }).catch(() => {});
      }
    }

    res.json({ message: `Physical screening and assessment recorded (${finalStatus})`, assessment: savedAssess });
  } catch (err) {
    console.error('Screening recording error:', err);
    res.status(500).json({ error: 'Failed to record clinical screening' });
  }
});

// Stage 5: Donation Process (Start / Complete)
router.post('/donor-responses/:responseId/donation', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { responseId } = req.params;
    const { action, donation_type = 'Whole Blood', units_collected = 1 } = req.body; // 'start' or 'complete'

    const { data: resp } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('id', responseId)
      .single();

    if (!resp) return res.status(404).json({ error: 'Response record not found' });

    const nowIso = new Date().toISOString();
    const updatePayload = { updated_at: nowIso };

    if (action === 'start') {
      updatePayload.status = 'donation_started';
      updatePayload.donation_started_at = nowIso;
      updatePayload.donation_type = donation_type;
    } else if (action === 'complete') {
      updatePayload.status = 'donation_completed';
      updatePayload.donation_completed_at = nowIso;
      updatePayload.donation_type = donation_type;
      updatePayload.units_collected = Number(units_collected) || 1;
    } else {
      return res.status(400).json({ error: 'Action must be start or complete' });
    }

    let existingAssess = null;
    const { data: byResp } = await supabase
      .from('donor_assessments')
      .select('id')
      .eq('response_id', responseId)
      .single();

    if (byResp) {
      existingAssess = byResp;
    } else if (resp.donor_id && resp.blood_request_id) {
      const { data: byPair } = await supabase
        .from('donor_assessments')
        .select('id')
        .eq('donor_id', resp.donor_id)
        .eq('blood_request_id', resp.blood_request_id)
        .single();
      if (byPair) existingAssess = byPair;
    }

    let savedAssess;
    if (existingAssess) {
      const { data } = await supabase
        .from('donor_assessments')
        .update({
          response_id: responseId,
          ...updatePayload
        })
        .eq('id', existingAssess.id)
        .select()
        .single();
      savedAssess = data;
    } else {
      const { data } = await supabase
        .from('donor_assessments')
        .insert({
          response_id: responseId,
          blood_request_id: resp.blood_request_id,
          donor_id: resp.donor_id,
          hospital_id: req.user.id,
          created_at: nowIso,
          ...updatePayload
        })
        .select()
        .single();
      savedAssess = data;
    }

    // Notify donor
    if (resp.donor_id) {
      const isStart = action === 'start';
      const notifTitle = isStart ? 'Donation Procedure Started' : 'Donation Procedure Completed';
      const notifMsg = isStart
        ? `Blood collection has officially started at ${req.user.name}. Relax and stay hydrated!`
        : `Your ${donation_type} donation has been completed at ${req.user.name}. Clinical staff will now conduct final verification.`;

      await supabase.from('notifications').insert({
        user_id: resp.donor_id,
        title: notifTitle,
        message: notifMsg,
        type: isStart ? 'donation_started' : 'donation_completed',
        reference_id: resp.blood_request_id,
        is_read: false,
        created_at: nowIso
      });
    }

    res.json({ message: `Donation procedure updated to ${updatePayload.status}`, assessment: savedAssess });
  } catch (err) {
    console.error('Donation process error:', err);
    res.status(500).json({ error: 'Failed to update donation status' });
  }
});

// Stage 6: Final Verification & Points Awarding
router.post('/donor-responses/:responseId/verify', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { responseId } = req.params;
    const { units_verified, donation_type = 'Whole Blood', points_to_award = 150, notes } = req.body;

    const { data: resp } = await supabase
      .from('donor_responses')
      .select('*, blood_requests(*)')
      .eq('id', responseId)
      .single();

    if (!resp) return res.status(404).json({ error: 'Response record not found' });

    // IDEMPOTENCY CHECK: Prevent duplicate verification and duplicate points
    let existingAssess = null;
    const { data: byResp } = await supabase
      .from('donor_assessments')
      .select('*')
      .eq('response_id', responseId)
      .single();

    if (byResp) {
      existingAssess = byResp;
    } else if (resp.donor_id && resp.blood_request_id) {
      const { data: byPair } = await supabase
        .from('donor_assessments')
        .select('*')
        .eq('donor_id', resp.donor_id)
        .eq('blood_request_id', resp.blood_request_id)
        .single();
      if (byPair) existingAssess = byPair;
    }

    if (existingAssess && (existingAssess.status === 'donation_verified' || existingAssess.status === 'verified')) {
      return res.status(409).json({
        error: 'This donation has already been verified. Duplicate verification and duplicate reward points are prevented.',
        assessment: existingAssess
      });
    }

    const units = Number(units_verified) || 1;
    const points = Number(points_to_award) || 150;
    const nowIso = new Date().toISOString();
    const todayDate = new Date().toISOString().split('T')[0];

    // 1. Update assessment record to donation_verified
    let verifiedAssess;
    if (existingAssess) {
      const { data } = await supabase
        .from('donor_assessments')
        .update({
          response_id: responseId,
          status: 'donation_verified',
          donation_verified_at: nowIso,
          reward_points_awarded: points,
          units_collected: units,
          updated_at: nowIso
        })
        .eq('id', existingAssess.id)
        .select()
        .single();
      verifiedAssess = data;
    } else {
      const { data } = await supabase
        .from('donor_assessments')
        .insert({
          response_id: responseId,
          blood_request_id: resp.blood_request_id,
          donor_id: resp.donor_id,
          hospital_id: req.user.id,
          status: 'donation_verified',
          donation_verified_at: nowIso,
          reward_points_awarded: points,
          units_collected: units,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select()
        .single();
      verifiedAssess = data;
    }

    // 2. Create verified record in donation_history (prevent duplicate)
    const bloodGroup = resp.blood_requests?.blood_group || 'O+';
    const { data: existingHistory } = await supabase
      .from('donation_history')
      .select('id')
      .eq('donor_id', resp.donor_id)
      .eq('donation_date', todayDate)
      .eq('location', req.user.name)
      .single();

    if (!existingHistory) {
      try {
        await supabase
          .from('donation_history')
          .insert({
            donor_id: resp.donor_id,
            blood_group: bloodGroup,
            units: units,
            donation_date: todayDate,
            location: req.user.name,
            notes: `[Verified] ${donation_type} - ${notes || 'Emergency donation'}`
          });
      } catch (insertErr) {
        console.warn('donation_history insert note:', insertErr);
      }
    }

    // 3. Award reward points and update last donation date on donor user record
    const { data: donorUser } = await supabase
      .from('users')
      .select('id, name, email, reward_points')
      .eq('id', resp.donor_id)
      .single();

    const newPoints = (donorUser?.reward_points || 0) + points;

    await supabase
      .from('users')
      .update({
        reward_points: newPoints,
        updated_at: nowIso
      })
      .eq('id', resp.donor_id);

    // 4. Update health profile last_donation_date
    await supabase
      .from('donor_health_profiles')
      .update({
        last_donation_date: todayDate,
        previous_donation_type: donation_type,
        has_donated_before: true,
        hospital_assessment_status: 'donation_verified',
        updated_at: nowIso
      })
      .eq('donor_id', resp.donor_id);

    // 5. Update fulfilled units on blood_requests
    if (resp.blood_request_id && resp.blood_requests) {
      const curFulfilled = Number(resp.blood_requests.units_fulfilled || 0);
      const newFulfilled = curFulfilled + units;
      const newStatus = newFulfilled >= Number(resp.blood_requests.units_required) ? 'delivered' : resp.blood_requests.status;
      await supabase
        .from('blood_requests')
        .update({
          units_fulfilled: newFulfilled,
          status: newStatus,
          updated_at: nowIso
        })
        .eq('id', resp.blood_request_id);
    }

    // 6. Notify donor with celebration & points earned
    const congratsMsg = `🎉 Your blood donation at ${req.user.name} has been verified! +${points} LifeLink Hero Points have been added to your balance. Thank you for saving lives!`;
    await supabase.from('notifications').insert({
      user_id: resp.donor_id,
      title: 'Donation Verified – Points Awarded!',
      message: congratsMsg,
      type: 'donation_verified',
      reference_id: resp.blood_request_id,
      is_read: false,
      created_at: nowIso
    });

    if (donorUser?.email) {
      sendNotificationEmail({
        toEmail: donorUser.email,
        recipientName: donorUser.name,
        title: 'Donation Verified – Reward Points Awarded',
        message: congratsMsg,
        category: 'donation_verified',
        actionUrl: '/donor/rewards'
      }).catch(() => {});
    }

    res.json({
      message: `Donation verified successfully! ${units} unit(s) recorded and +${points} points awarded.`,
      assessment: verifiedAssess,
      reward_points: newPoints
    });
  } catch (err) {
    console.error('Final donation verification error:', err);
    res.status(500).json({ error: 'Failed to complete final donation verification' });
  }
});

module.exports = router;
