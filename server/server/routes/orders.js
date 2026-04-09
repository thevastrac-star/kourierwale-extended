const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const Order = require('../models/Order');
const { WalletTransaction, Notification, ActivityLog, NDR, BulkUpload } = require('../models/index');
const { protect, adminOnly, logActivity } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const { fetchPincodeData } = require('../utils/pincode');
const { toCSV } = require('../utils/csv');

const upload = multer({ dest: 'uploads/bulk/' });

// ─── PINCODE AUTO-FETCH ───────────────────────────────────────────────────────
// GET /api/orders/pincode/:pincode
router.get('/pincode/:pincode', protect, async (req, res) => {
  const data = await fetchPincodeData(req.params.pincode);
  res.json(data);
});

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────
// POST /api/orders
router.post('/', protect, async (req, res) => {
  try {
    const { recipient, package: pkg, paymentMode, codAmount, pickupWarehouse, source } = req.body;

    // Phone format validation
    if (!/^[6-9]\d{9}$/.test(recipient.phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }

    // Duplicate order check (same phone + pincode in last 24h)
    const dupKey = `${recipient.phone}_${recipient.pincode}`;
    const since = new Date(Date.now() - 86400000);
    const duplicate = await Order.findOne({
      user: req.user._id,
      duplicateCheckKey: dupKey,
      createdAt: { $gte: since }
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'Duplicate order detected for this phone + pincode in last 24 hours', duplicateOrderId: duplicate.orderId });
    }

    // Max orders per day check
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCount = await Order.countDocuments({ user: req.user._id, createdAt: { $gte: todayStart } });
    const userLimits = (await User.findById(req.user._id).select('limits')).limits;
    if (todayCount >= userLimits.maxOrdersPerDay) {
      return res.status(400).json({ success: false, message: `Daily order limit (${userLimits.maxOrdersPerDay}) reached` });
    }

    // COD limit check
    if (paymentMode === 'cod' && codAmount > userLimits.codLimit) {
      return res.status(400).json({ success: false, message: `COD amount exceeds your limit of ₹${userLimits.codLimit}` });
    }

    const order = await Order.create({
      user: req.user._id,
      recipient, package: pkg, paymentMode,
      codAmount: paymentMode === 'cod' ? codAmount : 0,
      pickupWarehouse, source: source || 'manual',
      duplicateCheckKey: dupKey,
      status: 'draft'
    });

    const user = await User.findById(req.user._id);
    await createNotification(req.user._id, 'order_created', 'Order Created',
      `Order ${order.orderId} placed successfully`, order._id, user.whatsappNotifications);

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders  – list (client = own, admin = all)
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.user = req.user._id;
    else if (req.query.userId) filter.user = req.query.userId;

    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.from) filter.createdAt = { $gte: new Date(req.query.from) };
    if (req.query.to) filter.createdAt = { ...(filter.createdAt || {}), $lte: new Date(req.query.to) };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('assignedCourier', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, total, page, limit, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('assignedCourier', 'name code');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role !== 'admin' && String(order.user._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/orders/:id/status  – admin update status
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, awbNumber, trackingUrl, assignedCourier, shippingCharge } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status || order.status;
    if (awbNumber) order.awbNumber = awbNumber;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    if (assignedCourier) order.assignedCourier = assignedCourier;
    if (shippingCharge !== undefined) order.shippingCharge = shippingCharge;
    await order.save();

    // Deduct wallet on shipping
    if (status === 'shipped' && shippingCharge > 0) {
      const user = await User.findById(order.user);
      user.walletBalance -= shippingCharge;
      await user.save();
      await WalletTransaction.create({
        user: order.user, type: 'debit', amount: shippingCharge,
        balance: user.walletBalance, description: `Shipping charge for ${order.orderId}`,
        reference: order.orderId, performedBy: req.user._id
      });
    }

    // NDR creation if status = ndr
    if (status === 'ndr') {
      await NDR.create({
        order: order._id, user: order.user,
        awbNumber: order.awbNumber, reason: req.body.ndrReason || 'Not delivered'
      });
    }

    const owner = await User.findById(order.user);
    await createNotification(order.user, status,
      `Order ${status.toUpperCase()}`, `Your order ${order.orderId} is now ${status}`,
      order._id, owner.whatsappNotifications);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/orders/:id/convert-shipment  – client converts integration order to shipment
router.patch('/:id/convert-shipment', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = 'processing';
    await order.save();
    res.json({ success: true, message: 'Order converted to shipment', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── BULK UPLOAD ──────────────────────────────────────────────────────────────
// POST /api/orders/bulk-upload
router.post('/bulk-upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const bulkRecord = await BulkUpload.create({
      user: req.user._id,
      fileName: req.file.originalname,
      status: 'processing'
    });

    // Parse CSV in background (simplified – reads first 5 cols as order fields)
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let success = 0, failed = 0, errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim().replace(/^"|"$/g, ''); });

      try {
        if (!row.phone || !row.pincode || !row.name || !row.address) throw new Error('Missing required fields');
        if (!/^[6-9]\d{9}$/.test(row.phone)) throw new Error('Invalid phone');

        await Order.create({
          user: req.user._id,
          recipient: { name: row.name, phone: row.phone, address: row.address, pincode: row.pincode, city: row.city, state: row.state },
          package: { weight: parseFloat(row.weight) || 0.5, value: parseFloat(row.value) || 0, description: row.description },
          paymentMode: row.payment_mode || 'prepaid',
          codAmount: parseFloat(row.cod_amount) || 0,
          source: 'bulk_upload',
          duplicateCheckKey: `${row.phone}_${row.pincode}`
        });
        success++;
      } catch (e) {
        failed++;
        errors.push({ row: i, error: e.message });
      }
    }

    bulkRecord.totalRows = lines.length - 1;
    bulkRecord.successRows = success;
    bulkRecord.failedRows = failed;
    bulkRecord.errors = errors;
    bulkRecord.status = 'completed';
    await bulkRecord.save();

    res.json({ success: true, message: `Uploaded ${success} orders, ${failed} failed`, bulkRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/export/csv  – CSV export
router.get('/export/csv', protect, async (req, res) => {
  try {
    const filter = req.user.role !== 'admin' ? { user: req.user._id } : {};
    if (req.query.userId) filter.user = req.query.userId;
    const orders = await Order.find(filter).lean();
    const fields = ['orderId', 'status', 'paymentMode', 'codAmount', 'shippingCharge', 'awbNumber', 'createdAt',
      'recipient.name', 'recipient.phone', 'recipient.pincode', 'recipient.city', 'recipient.state'];
    const csv = toCSV(orders, fields);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
