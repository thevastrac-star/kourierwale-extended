const mongoose = require('mongoose');

// ─── WALLET TRANSACTION ──────────────────────────────────────────────────────
const WalletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  balance: { type: Number },          // balance after transaction
  description: { type: String },
  reference: { type: String },        // order ID or recharge ID
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // admin who did it
  createdAt: { type: Date, default: Date.now }
});
const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);

// ─── WALLET RECHARGE ─────────────────────────────────────────────────────────
const WalletRechargeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentGateway: { type: String, default: 'manual' },
  transactionId: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const WalletRecharge = mongoose.model('WalletRecharge', WalletRechargeSchema);

// ─── COURIER ─────────────────────────────────────────────────────────────────
const CourierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
  isActive: { type: Boolean, default: true },
  logoUrl: { type: String },
  apiConfig: {
    baseUrl: { type: String },
    apiKey: { type: String },
    apiSecret: { type: String },
    username: { type: String },
    password: { type: String },
    extraConfig: { type: mongoose.Schema.Types.Mixed }
  },
  supportsCOD: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Courier = mongoose.model('Courier', CourierSchema);

// ─── SHIPPING RATE ────────────────────────────────────────────────────────────
const ShippingRateSchema = new mongoose.Schema({
  courier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', required: true },
  zone: { type: String },               // e.g. "within_city", "metro", "national"
  minWeight: { type: Number, default: 0 },
  maxWeight: { type: Number },
  baseRate: { type: Number, required: true },
  ratePerKg: { type: Number, default: 0 },
  codCharge: { type: Number, default: 0 },
  fuelSurcharge: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  history: [{
    rate: { type: Number },
    changedAt: { type: Date },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  createdAt: { type: Date, default: Date.now }
});
const ShippingRate = mongoose.model('ShippingRate', ShippingRateSchema);

// ─── COURIER PREFERENCE (user priority) ──────────────────────────────────────
const CourierPreferenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  priorities: [{
    priority: { type: Number },         // 1,2,3
    courier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' }
  }],
  updatedAt: { type: Date, default: Date.now }
});
const CourierPreference = mongoose.model('CourierPreference', CourierPreferenceSchema);

// ─── WAREHOUSE ────────────────────────────────────────────────────────────────
const WarehouseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  contactName: { type: String },
  phone: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Warehouse = mongoose.model('Warehouse', WarehouseSchema);

// ─── SUPPORT TICKET ───────────────────────────────────────────────────────────
const TicketReplySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorRole: { type: String, enum: ['admin', 'client'] },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const SupportTicketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  category: { type: String, enum: ['billing', 'shipment', 'technical', 'other'], default: 'other' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  replies: [TicketReplySchema],
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
SupportTicketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketId = 'TKT' + String(count + 1).padStart(5, '0');
  }
  this.updatedAt = new Date();
  next();
});
const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema);

// ─── NDR ──────────────────────────────────────────────────────────────────────
const NDRSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  awbNumber: { type: String },
  reason: { type: String },
  attempts: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'reattempt_requested', 'reattempt_scheduled', 'rto_initiated', 'resolved'], default: 'pending' },
  clientNote: { type: String },
  adminNote: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const NDR = mongoose.model('NDR', NDRSchema);

// ─── COD RECONCILIATION ───────────────────────────────────────────────────────
const CodReconciliationSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  awbNumber: { type: String },
  expectedAmount: { type: Number },
  receivedAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'settled', 'disputed'], default: 'pending' },
  settlementDate: { type: Date },
  remarks: { type: String },
  history: [{
    action: String,
    amount: Number,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const CodReconciliation = mongoose.model('CodReconciliation', CodReconciliationSchema);

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────
const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['order_created', 'shipped', 'delivered', 'ndr', 'rto', 'wallet_credit', 'wallet_debit', 'kyc_update', 'ticket_reply'] },
  channel: { type: String, enum: ['whatsapp', 'email', 'in_app'], default: 'in_app' },
  title: { type: String },
  message: { type: String },
  reference: { type: String },
  isRead: { type: Boolean, default: false },
  isSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', NotificationSchema);

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
const ActivityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: { type: String },
  action: { type: String },
  entity: { type: String },
  entityId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const SettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
  category: { type: String, enum: ['payment_gateway', 'courier_api', 'general', 'notifications'], default: 'general' },
  label: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});
const Settings = mongoose.model('Settings', SettingsSchema);

// ─── BULK UPLOAD ──────────────────────────────────────────────────────────────
const BulkUploadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String },
  totalRows: { type: Number, default: 0 },
  successRows: { type: Number, default: 0 },
  failedRows: { type: Number, default: 0 },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  errors: [{ row: Number, error: String }],
  createdAt: { type: Date, default: Date.now }
});
const BulkUpload = mongoose.model('BulkUpload', BulkUploadSchema);

module.exports = {
  WalletTransaction,
  WalletRecharge,
  Courier,
  ShippingRate,
  CourierPreference,
  Warehouse,
  SupportTicket,
  NDR,
  CodReconciliation,
  Notification,
  ActivityLog,
  Settings,
  BulkUpload
};
