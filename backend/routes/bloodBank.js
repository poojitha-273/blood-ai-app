const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
  hasValidCoords,
  calculateDistanceKm,
  fetchIndiaRealtimeBloodBanks,
  fetchERaktKoshStates,
  fetchERaktKoshDistricts,
  fetchERaktKoshDirectory,
} = require('../services/geoService');

const router = express.Router();

// Get blood bank dashboard stats
router.get('/dashboard', authenticateToken, authorizeRole('blood_bank'), async (req, res) => {
  try {
    const { data: inventory } = await supabase
      .from('blood_inventory')
      .select('*')
      .eq('blood_bank_id', req.user.id);

    const { data: requests } = await supabase
      .from('blood_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const totalUnits = (inventory || []).filter(i => i.status === 'available').reduce((sum, i) => sum + (i.units || 0), 0);
    const expiringSoon = (inventory || []).filter(i => {
      const diff = (new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && diff > 0 && i.status === 'available';
    }).length;
    const expired = (inventory || []).filter(i => new Date(i.expiry_date) < new Date() && i.status === 'available').length;

    res.json({
      total_units: totalUnits,
      total_blood_groups: [...new Set((inventory || []).map(i => i.blood_group))].length,
      expiring_soon: expiringSoon,
      expired,
      pending_requests: (requests || []).filter(r => r.status === 'pending').length,
      total_requests: (requests || []).length,
      inventory: inventory || [],
      recent_requests: (requests || []).slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Donor eligibility check (FDA-based)
router.post('/check-eligibility', authenticateToken, async (req, res) => {
  try {
    const { age, weight, lastDonation, hasTattoo, hasTravel, hasMedication, hasInfection, isPregnant, hemoglobinLevel } = req.body;

    const criteria = [];
    let eligible = true;

    if (age < 17 || age > 65) { criteria.push({ check: 'Age', status: 'fail', message: 'Must be between 17-65 years' }); eligible = false; }
    else criteria.push({ check: 'Age', status: 'pass', message: 'Age requirement met' });

    if (weight < 50) { criteria.push({ check: 'Weight', status: 'fail', message: 'Must weigh at least 50 kg' }); eligible = false; }
    else criteria.push({ check: 'Weight', status: 'pass', message: 'Weight requirement met' });

    if (lastDonation) {
      const daysSinceLast = (new Date() - new Date(lastDonation)) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 56) { criteria.push({ check: 'Last Donation', status: 'fail', message: 'Must wait 56 days between donations' }); eligible = false; }
      else criteria.push({ check: 'Last Donation', status: 'pass', message: 'Sufficient time since last donation' });
    }

    if (hasTattoo) { criteria.push({ check: 'Recent Tattoo', status: 'warn', message: 'Must wait 3 months after tattoo' }); }
    if (hasTravel) { criteria.push({ check: 'Recent Travel', status: 'warn', message: 'May need to wait depending on destination' }); }
    if (hasMedication) { criteria.push({ check: 'Medication', status: 'warn', message: 'Some medications require deferral' }); }
    if (hasInfection) { criteria.push({ check: 'Active Infection', status: 'fail', message: 'Cannot donate with active infection' }); eligible = false; }
    if (isPregnant) { criteria.push({ check: 'Pregnancy', status: 'fail', message: 'Cannot donate while pregnant' }); eligible = false; }

    if (hemoglobinLevel && hemoglobinLevel < 12.5) { criteria.push({ check: 'Hemoglobin', status: 'fail', message: 'Hemoglobin must be at least 12.5 g/dL' }); eligible = false; }
    else if (hemoglobinLevel) criteria.push({ check: 'Hemoglobin', status: 'pass', message: 'Hemoglobin level sufficient' });

    res.json({ eligible, criteria, checkedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Eligibility check failed' });
  }
});

// Real-time all-India Blood Banks feed (e-RaktKosh Govt of India + LifeLink Network)
router.get('/india-realtime', authenticateToken, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const liveOnly = req.query.liveOnly === 'true';
    const query = String(req.query.q || '').trim().toLowerCase();
    const refLat = Number(req.query.lat);
    const refLng = Number(req.query.lng);
    const hasRef = hasValidCoords(refLat, refLng);

    const payload = await fetchIndiaRealtimeBloodBanks(forceRefresh);
    let banks = payload.banks;

    if (liveOnly) {
      banks = banks.filter((b) => b.liveOnline);
    }
    if (query) {
      banks = banks.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          (b.city && b.city.toLowerCase().includes(query)) ||
          (b.state && b.state.toLowerCase().includes(query)) ||
          (b.address && b.address.toLowerCase().includes(query))
      );
    }
    if (hasRef) {
      const origin = { lat: refLat, lng: refLng };
      banks = banks
        .map((b) => ({
          ...b,
          distanceKm: Number(calculateDistanceKm(origin, { lat: b.lat, lng: b.lng }).toFixed(2)),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json({
      source: payload.source,
      fetchedAt: payload.fetchedAt,
      totalCount: payload.totalCount,
      liveOnlineCount: payload.liveOnlineCount,
      filteredCount: banks.length,
      banks,
    });
  } catch (error) {
    console.error('India realtime blood banks error:', error?.message || error);
    res.status(502).json({ error: 'Failed to load real-time India blood banks directory' });
  }
});

// e-RaktKosh India States list
router.get('/eraktkosh-states', authenticateToken, async (_req, res) => {
  try {
    res.json(await fetchERaktKoshStates());
  } catch (error) {
    res.status(502).json({ error: 'Failed to load India states list' });
  }
});

// e-RaktKosh Districts by stateCode
router.get('/eraktkosh-districts', authenticateToken, async (req, res) => {
  try {
    const stateCode = String(req.query.stateCode || '').trim();
    if (!stateCode) return res.json([]);
    res.json(await fetchERaktKoshDistricts(stateCode));
  } catch (error) {
    res.status(502).json({ error: 'Failed to load districts list' });
  }
});

// e-RaktKosh State/District directory (includes phone, email, address, Govt/Charitable/Private category)
router.get('/eraktkosh-directory', authenticateToken, async (req, res) => {
  try {
    const stateCode = String(req.query.stateCode || '').trim();
    const districtCode = String(req.query.districtCode || '-1').trim() || '-1';
    if (!stateCode) return res.status(400).json({ error: 'stateCode query param required' });
    res.json(await fetchERaktKoshDirectory(stateCode, districtCode));
  } catch (error) {
    res.status(502).json({ error: 'Failed to load e-RaktKosh state directory' });
  }
});

module.exports = router;
