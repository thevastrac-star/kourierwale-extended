# Kourierwale – Extended Logistics Platform

Full-stack logistics admin + client panel with all advanced features.

---

## 🗂 Project Structure

```
kourierwale_extended/
├── login.html                  ← Shared login page
├── render.yaml                 ← Render.com deployment config
├── admin/
│   └── index.html              ← Admin Panel (single-page app)
├── client/
│   └── index.html              ← Client Panel (single-page app)
└── server/
    ├── server.js               ← Express entry point
    ├── .env.example            ← Environment template
    ├── package.json
    ├── config/
    │   └── seed.js             ← Database seeder
    ├── middleware/
    │   └── auth.js             ← JWT + role guards + activity logger
    ├── models/
    │   ├── User.js             ← Extended user (wallet, KYC, fraud, integrations)
    │   ├── Order.js            ← Extended order (NDR, COD, duplicate check)
    │   └── index.js            ← All other models
    ├── routes/
    │   ├── auth.js             ← Login, register, impersonation
    │   ├── wallet.js           ← Wallet CRUD + admin controls + CSV export
    │   ├── kyc.js              ← KYC submit + admin review
    │   ├── orders.js           ← Full order lifecycle + bulk upload + pincode
    │   ├── couriers.js         ← Courier management + rate management
    │   ├── ndr.js              ← NDR management
    │   ├── cod.js              ← COD reconciliation
    │   ├── tickets.js          ← Support ticket system
    │   ├── warehouses.js       ← Warehouse management
    │   ├── users.js            ← User management + fraud controls
    │   ├── settings.js         ← System settings
    │   ├── analytics.js        ← Dashboard stats
    │   └── notifications.js    ← Notifications
    └── utils/
        ├── notifications.js    ← WhatsApp placeholder + in-app
        ├── pincode.js          ← India Post API auto-fetch
        └── csv.js              ← CSV export helper
```

---

## 🚀 Quick Start (Local)

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env — fill in MONGO_URI and JWT_SECRET
```

### 3. Seed the database
```bash
npm run seed
```

### 4. Start the server
```bash
npm run dev        # with nodemon (auto-reload)
# or
npm start          # production
```

### 5. Open the panels
- Login: `login.html` (open directly in browser)
- Admin: `admin/index.html`
- Client: `client/index.html`

---

## ☁️ Deploy to Render

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your repo — Render will auto-detect `render.yaml`
4. In Render Dashboard → Environment → add:
   - `MONGO_URI` → your MongoDB Atlas connection string
   - `JWT_SECRET` → any random string (32+ chars)
   - `BACKEND_URL` → `https://your-app-name.onrender.com`
5. Deploy — the keep-alive pinger will prevent the free tier from sleeping

---

## ✅ Feature Checklist

### Admin Panel
- [x] **Dashboard** — total orders, RTO, NDR, COD pending, users, recharges, tickets
- [x] **User Management** — list, block/unblock, flag, set limits
- [x] **Wallet Control** — view balance, credit/debit, full history per user
- [x] **Recharge Monitor** — all recharges with filters + totals
- [x] **KYC Verification** — view docs, approve/reject with reason
- [x] **Impersonation** — generate login token for any user (logged)
- [x] **Order Management** — list all orders, update status, assign AWB
- [x] **NDR Management** — view NDR cases, update status manually
- [x] **COD Reconciliation** — expected vs received, update per order
- [x] **Courier Management** — add/edit/enable/disable couriers + API config placeholders
- [x] **Rate Management** — set/edit rates per courier (weight, zone)
- [x] **Support Tickets** — view all, reply, change status
- [x] **Settings Panel** — payment gateway + courier API + notifications placeholders
- [x] **Activity Logs** — every sensitive action logged
- [x] **CSV Exports** — orders, users, wallet history

### Client Panel
- [x] **Dashboard** — wallet balance, today's orders, pending NDR, notifications
- [x] **Create Order** — full form with pincode auto-fetch, COD toggle, duplicate prevention
- [x] **Order List** — all orders + CSV export + convert to shipment
- [x] **Bulk Upload** — CSV template + upload
- [x] **NDR** — view NDR orders + reattempt button
- [x] **Wallet** — balance, recharge UI, transaction history + CSV export
- [x] **Billing** — shipping charges + wallet deductions
- [x] **Warehouse Management** — create/edit/delete warehouses
- [x] **KYC** — upload documents, view status
- [x] **Support Tickets** — create, view, reply
- [x] **Integrations** — Shopify + WooCommerce connect UI + credentials storage
- [x] **Order Sync** — synced orders appear in orders tab (UI structure)
- [x] **Courier Preferences** — set 1st/2nd/3rd courier priority
- [x] **WhatsApp Notifications** — toggle + number setup (placeholder)
- [x] **Settings** — profile, limits view

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | — | Login |
| POST | /api/auth/register | — | Register |
| POST | /api/auth/impersonate/:id | Admin | Impersonate user |
| GET | /api/wallet/balance | Client | Own balance |
| POST | /api/wallet/admin/adjust | Admin | Credit/debit wallet |
| GET | /api/wallet/admin/recharges | Admin | All recharges |
| POST | /api/kyc/submit | Client | Submit KYC docs |
| POST | /api/kyc/admin/review/:id | Admin | Approve/reject KYC |
| GET | /api/orders/pincode/:pin | Any | City+State lookup |
| POST | /api/orders | Client | Create order |
| GET | /api/orders | Any | List orders |
| POST | /api/orders/bulk-upload | Client | Bulk CSV upload |
| GET | /api/ndr | Any | NDR cases |
| POST | /api/ndr/:id/reattempt | Client | Request reattempt |
| GET | /api/cod | Admin | COD reconciliation |
| POST | /api/cod/:id/update | Admin | Update COD status |
| GET | /api/couriers | Any | List couriers |
| POST | /api/couriers | Admin | Add courier |
| GET | /api/couriers/rates | Any | List rates |
| POST | /api/tickets | Client | Create ticket |
| POST | /api/tickets/:id/reply | Any | Reply to ticket |
| GET | /api/warehouses | Client | Own warehouses |
| POST | /api/users/:id/block | Admin | Block user |
| GET | /api/analytics/dashboard | Admin | Dashboard stats |
| GET | /api/settings | Admin | Get settings |
| POST | /api/settings | Admin | Save settings |
| GET | /api/notifications | Any | User notifications |

---

## 📝 Notes

- **Payment gateway**: UI + config storage only. No real money movement. Wire up Razorpay/PayU using stored keys.
- **WhatsApp**: Placeholder structure in place. Integrate WATI/Interakt using the `WHATSAPP_API_URL` + `WHATSAPP_API_KEY` env vars.
- **Courier APIs**: UI + API key storage only. Add real integration in `routes/couriers.js`.
- **Order sync** (Shopify/WooCommerce): UI + credentials storage only. Add webhook handlers when ready.
- **Keep-alive**: Server pings `/health` every 7 minutes to prevent Render free tier sleep. Set `BACKEND_URL` env var.
