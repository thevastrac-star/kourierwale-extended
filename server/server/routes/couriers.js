const express = require('express');
const router = express.Router();
const { Courier, ShippingRate, CourierPreference } = require('../models/index');
const { protect, adminOnly, logActivity } = require('../middleware/auth');

// ─── COURIERS ─────────────────────────────────────────────────────────────────

// GET /api/couriers  – list active couriers (all users)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role !== 'admin' ? { isActive: true } : {};
    const couriers = await Courier.find(filter).select('-apiConfig');
    res.json({ success: true, couriers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/couriers/:id  – detail with API config (admin only)
router.get('/:id', protect, adminOnly, async (req, res) => {
  const courier = await Courier.findById(req.params.id);
  if (!courier) return res.status(404).json({ success: false, message: 'Courier not found' });
  res.json({ success: true, courier });
});

// POST /api/couriers  – admin add courier
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, code, supportsCOD, apiConfig, logoUrl } = req.body;
    const courier = await Courier.create({ name, code, supportsCOD, apiConfig, logoUrl });
    await logActivity(req.user._id, 'admin', 'COURIER_CREATE', 'Courier', courier._id, { name }, req.ip);
    res.status(201).json({ success: true, courier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/couriers/:id  – admin update
router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const courier = await Courier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!courier) return res.status(404).json({ success: false, message: 'Courier not found' });
    await logActivity(req.user._id, 'admin', 'COURIER_UPDATE', 'Courier', courier._id, req.body, req.ip);
    res.json({ success: true, courier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/couriers/:id/toggle  – enable/disable
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const courier = await Courier.findById(req.params.id);
    if (!courier) return res.status(404).json({ success: false, message: 'Not found' });
    courier.isActive = !courier.isActive;
    await courier.save();
    await logActivity(req.user._id, 'admin', `COURIER_${courier.isActive ? 'ENABLE' : 'DISABLE'}`,
      'Courier', courier._id, {}, req.ip);
    res.json({ success: true, isActive: courier.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/couriers/:id/api-config  – save API keys/config
router.patch('/:id/api-config', protect, adminOnly, async (req, res) => {
  try {
    const courier = await Courier.findById(req.params.id);
    if (!courier) return res.status(404).json({ success: false, message: 'Not found' });
    courier.apiConfig = { ...courier.apiConfig, ...req.body };
    await courier.save();
    await logActivity(req.user._id, 'admin', 'COURIER_API_CONFIG', 'Courier', courier._id, {}, req.ip);
    res.json({ success: true, message: 'API config saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SHIPPING RATES ───────────────────────────────────────────────────────────

// GET /api/couriers/rates/all  – list all rates
router.get('/rates/all', protect, adminOnly, async (req, res) => {
  const rates = await ShippingRate.find().populate('courier', 'name code');
  res.json({ success: true, rates });
});

// GET /api/couriers/:courierId/rates
router.get('/:courierId/rates', protect, async (req, res) => {
  const rates = await ShippingRate.find({ courier: req.params.courierId, isActive: true });
  res.json({ success: true, rates });
});

// POST /api/couriers/rates  – admin add rate
router.post('/rates/create', protect, adminOnly, async (req, res) => {
  try {
    const { courier, zone, minWeight, maxWeight, baseRate, ratePerKg, codCharge, fuelSurcharge } = req.body;
    const rate = await ShippingRate.create({ courier, zone, minWeight, maxWeight, baseRate, ratePerKg, codCharge, fuelSurcharge });
    await logActivity(req.user._id, 'admin', 'RATE_CREATE', 'ShippingRate', rate._id, { courier, baseRate }, req.ip);
    res.status(201).json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/couriers/rates/:id  – admin edit rate
router.patch('/rates/:id', protect, adminOnly, async (req, res) => {
  try {
    const rate = await ShippingRate.findById(req.params.id);
    if (!rate) return res.status(404).json({ success: false, message: 'Rate not found' });

    // Store history
    rate.history.push({ rate: rate.baseRate, changedAt: new Date(), changedBy: req.user._id });
    Object.assign(rate, req.body);
    await rate.save();

    await logActivity(req.user._id, 'admin', 'RATE_UPDATE', 'ShippingRate', rate._id, req.body, req.ip);
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── COURIER PREFERENCE (client priority) ────────────────────────────────────

// GET /api/couriers/preference/mine
router.get('/preference/mine', protect, async (req, res) => {
  const pref = await CourierPreference.findOne({ user: req.user._id }).populate('priorities.courier', 'name code logoUrl');
  res.json({ success: true, preference: pref });
});

// POST /api/couriers/preference/save
router.post('/preference/save', protect, async (req, res) => {
  try {
    const { priorities } = req.body; // [{ priority: 1, courier: id }, ...]
    let pref = await CourierPreference.findOne({ user: req.user._id });
    if (pref) {
      pref.priorities = priorities;
      pref.updatedAt = new Date();
      await pref.save();
    } else {
      pref = await CourierPreference.create({ user: req.user._id, priorities });
    }
    res.json({ success: true, preference: pref });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
