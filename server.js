```js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── Daraja credentials (set these in Render env vars) ──
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || '';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const CALLBACK_URL = process.env.CALLBACK_URL || '';

const BASE_URL = MPESA_ENV === 'production'
 ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// In-memory store: phone -> balance (demo ledger)
const balances = {};
const getBal = (phone) => balances[phone] || 0;
const addBal = (phone, amt) => { balances[phone] = getBal(phone) + amt; };

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'prime-option-backend', env: MPESA_ENV });
});

// ── Get balance ──
app.get('/api/balance/:phone', (req, res) => {
  res.json({ phone: req.params.phone, balance: getBal(req.params.phone) });
});

// ── Daraja: OAuth token ──
async function getToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const r = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return r.data.access_token;
}

// ── Daraja: STK Push ──
app.post('/api/deposit', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone ||!amount) return res.status(400).json({ error: 'phone and amount required' });

    // Format phone: 07xx -> 2547xx
    let msisdn = String(phone).replace(/\D/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('7')) msisdn = '254' + msisdn;
