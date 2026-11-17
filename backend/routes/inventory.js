const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { notifyUserWithResend } = require('../services/emailService');

const router = express.Router();

// Get inventory for a hospital
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('blood_inventory').select('*').order('created_at', { ascending: false });

    if (req.user.role === 'hospital') {
      // Return hospital's own inventory records or shared stock
      query = query.or(`hospital_id.eq.${req.user.id},blood_bank_id.eq.${req.user.id}`);
    }

    let { data, error } = await query;
    if (error) throw error;

    // If hospital currently has no custom records, return all general available cold-chain stock
    if ((!data || data.length === 0) && req.user.role === 'hospital') {
      const fallback = await supabase.from('blood_inventory').select('*').order('created_at', { ascending: false });
      if (!fallback.error && fallback.data && fallback.data.length > 0) {
        data = fallback.data;
      }
    }

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add blood inventory (Hospital directly manages blood stock)
router.post('/', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { blood_group, units, collection_date, expiry_date, donor_name, status, component_type } = req.body;

    const { data, error } = await supabase
      .from('blood_inventory')
      .insert({
        hospital_id: req.user.id,
        hospital_name: req.user.name,
        blood_bank_id: req.user.id,
        blood_bank_name: req.user.name,
        blood_group,
        units,
        collection_date,
        expiry_date,
        donor_name: donor_name || 'Anonymous Donor',
        status: status || 'available',
        component_type: component_type || 'Whole Blood (PRBC)',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    if (data) {
      const unitsNum = Number(data.units ?? 0);
      const expiryDate = data.expiry_date ? new Date(data.expiry_date) : null;
      const daysUntilExpiry = expiryDate
        ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      if ((daysUntilExpiry !== null && daysUntilExpiry <= 7) || unitsNum <= 3) {
        const alertTitle =
          daysUntilExpiry !== null && daysUntilExpiry <= 7
            ? `Expiry Alert: ${data.blood_group} batch expires in ${Math.max(daysUntilExpiry, 0)} day(s)`
            : `Low Stock Alert: ${data.blood_group} has only ${unitsNum} unit(s) remaining`;
        const alertMessage = `Hospital blood inventory notice for ${data.blood_group} (${data.component_type || 'Whole Blood'}, ${unitsNum} unit(s)${data.expiry_date ? `, expires ${String(data.expiry_date).slice(0, 10)}` : ''}).`;

        notifyUserWithResend({
          supabase,
          user: req.user,
          title: alertTitle,
          message: alertMessage,
          type: 'inventory_alert',
          referenceId: data.id,
          actionUrl: '/hospital/inventory',
          metadata: {
            'Blood Group': data.blood_group,
            Units: unitsNum,
            Expiry: data.expiry_date ? String(data.expiry_date).slice(0, 10) : 'N/A',
          },
        }).catch(() => {});
      }
    }

    res.status(201).json({ message: 'Inventory added', data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add inventory' });
  }
});

// Update inventory
router.patch('/:id', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { units, status, expiry_date } = req.body;
    const updateData = { updated_at: new Date().toISOString() };
    if (units !== undefined) updateData.units = units;
    if (status) updateData.status = status;
    if (expiry_date) updateData.expiry_date = expiry_date;

    const { data, error } = await supabase
      .from('blood_inventory')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Inventory updated', data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Delete inventory
router.delete('/:id', authenticateToken, authorizeRole('hospital'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('blood_inventory')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Inventory deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete inventory' });
  }
});

// Get stock summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('blood_inventory')
      .select('blood_group, units, status, expiry_date')
      .eq('status', 'available');

    if (error) throw error;

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const summary = bloodGroups.map(bg => {
      const items = (data || []).filter(i => i.blood_group === bg);
      const totalUnits = items.reduce((sum, i) => sum + (i.units || 0), 0);
      const expiringSoon = items.filter(i => {
        const expiry = new Date(i.expiry_date);
        const now = new Date();
        const diff = (expiry - now) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff > 0;
      }).length;

      return { blood_group: bg, total_units: totalUnits, expiring_soon: expiringSoon };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stock summary' });
  }
});

// AI Stock recommendations
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const { data: inventory } = await supabase
      .from('blood_inventory')
      .select('blood_group, units, expiry_date, status')
      .eq('status', 'available');

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const optimalStock = { 'O+': 30, 'A+': 25, 'B+': 20, 'AB+': 10, 'O-': 15, 'A-': 10, 'B-': 8, 'AB-': 5 };

    const recommendations = bloodGroups.map(bg => {
      const items = (inventory || []).filter(i => i.blood_group === bg);
      const currentStock = items.reduce((sum, i) => sum + (i.units || 0), 0);
      const optimal = optimalStock[bg];
      const deficit = optimal - currentStock;
      const expiringSoon = items.filter(i => {
        const diff = (new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff > 0;
      }).reduce((sum, i) => sum + i.units, 0);

      let recommendation = 'Stock levels adequate';
      let urgency = 'low';
      if (currentStock === 0) { recommendation = 'CRITICAL: No stock available. Immediate collection needed.'; urgency = 'critical'; }
      else if (currentStock < optimal * 0.3) { recommendation = 'LOW STOCK: Urgent blood drive recommended.'; urgency = 'high'; }
      else if (currentStock < optimal * 0.6) { recommendation = 'Below optimal. Schedule blood collection.'; urgency = 'medium'; }
      else if (expiringSoon > currentStock * 0.3) { recommendation = 'High expiry rate. Prioritize usage of older stock.'; urgency = 'medium'; }

      return {
        blood_group: bg,
        current_stock: currentStock,
        optimal_stock: optimal,
        deficit: Math.max(0, deficit),
        expiring_soon: expiringSoon,
        recommendation,
        urgency
      };
    });

    res.json({
      recommendations,
      model: 'Rule-based Recommendation Engine (Demo)',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;
