// server/index.js
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import searchHandler from './api/search.js';

const app = express();
app.use(express.json());

// ---------- Config ----------
const PORT = process.env.PORT || 4000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CHANNEL3_API_BASE =
  (process.env.CHANNEL3_API_BASE && process.env.CHANNEL3_API_BASE.trim()) ||
  'https://api.trychannel3.com/v0';
const CHANNEL3_API_KEY = (process.env.CHANNEL3_API_KEY || '').trim();

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim(); // for emails
const ALERT_FROM = process.env.ALERT_FROM || 'alerts@yourdomain.com';

// ---------- Health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---------- Click redirect + log ----------
/**
 * Tracks an outbound click then redirects to the affiliate deeplink.
 * Example: /api/go/PRODUCT_ID?url=https://...&rank=1&query=...
 */
app.get('/api/go/:productId', async (req, res) => {
  try {
    const product_id = req.params.productId;
    const url = req.query.url || '';
    const rank = Number(req.query.rank || '0');
    const query = (req.query.query || '').toString();
    if (!url) return res.status(400).json({ ok: false, error: 'missing url' });

    try {
      await supabase.from('clicks').insert({
        product_id,
        query,
        rank,
        ua: req.headers['user-agent'] || '',
        referrer: req.get('referer') || '',
        outbound_url: url,
      });
    } catch (e) {
      console.warn('click log failed:', e.message);
    }
    return res.redirect(url);
  } catch (e) {
    console.error('go handler error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Watchlist (price drop alerts) ----------
/**
 * Body: { email, product_id, threshold?, last_price? }
 * Upsert a watch row.
 */
app.post('/api/watch/add', async (req, res) => {
  try {
    const { email, product_id, threshold, last_price } = req.body || {};
    if (!email || !product_id) {
      return res.status(400).json({ ok: false, error: 'missing email/product_id' });
    }
    await supabase.from('watches').upsert({
      email,
      product_id,
      threshold: threshold ?? null,
      last_price: last_price ?? null,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('watch add failed', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Remove a watch row: /api/watch/remove?email=...&product_id=... */
app.delete('/api/watch/remove', async (req, res) => {
  try {
    const { email, product_id } = req.query;
    if (!email || !product_id) {
      return res.status(400).json({ ok: false, error: 'missing email/product_id' });
    }
    await supabase.from('watches').delete().eq('email', email).eq('product_id', product_id);
    res.json({ ok: true });
  } catch (e) {
    console.error('watch remove failed', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Price-drop cron ----------
// Helper: fetch product detail from Channel3
async function fetchProductDetail(productId) {
  // Try product detail endpoint first
  let url = `${CHANNEL3_API_BASE}/products/${encodeURIComponent(productId)}`;
  let r = await fetch(url, { headers: { 'x-api-key': CHANNEL3_API_KEY } });
  if (r.ok) return r.json();

  // Fallback: some deployments may use singular path
  url = `${CHANNEL3_API_BASE}/product/${encodeURIComponent(productId)}`;
  r = await fetch(url, { headers: { 'x-api-key': CHANNEL3_API_KEY } });
  if (r.ok) return r.json();

  // Last fallback: search and pick by ID
  const s = await fetch(`${CHANNEL3_API_BASE}/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CHANNEL3_API_KEY,
    },
    body: JSON.stringify({ query: productId, limit: 1 }),
  });
  if (!s.ok) throw new Error(`CH3 detail failed: ${s.status}`);
  const arr = await s.json();
  return Array.isArray(arr) ? arr[0] : (arr?.results?.[0] || {});
}

// Helper: send email via Resend
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: ALERT_FROM, to, subject, html }),
  });
  if (!r.ok) {
    console.error('email failed', await r.text());
  }
}

/**
 * Vercel Cron target:
 *   Method: GET
 *   Path:   /api/cron/check-price-drops
 *   Schedule example: 0 9 * * *    (09:00 UTC daily)
 */
app.get('/api/cron/check-price-drops', async (_req, res) => {
  try {
    const { data: watches, error } = await supabase.from('watches').select('*').limit(500);
    if (error) throw error;

    for (const w of watches || []) {
      try {
        const d = await fetchProductDetail(w.product_id);
        const newPrice = d?.price?.price ?? d?.price ?? null;
        const link = d?.deeplink_url || d?.url || '';
        if (newPrice == null) continue;

        const threshold = w.threshold ?? w.last_price ?? Number.POSITIVE_INFINITY;
        if (newPrice < threshold) {
          await sendEmail(
            w.email,
            'Price dropped 🎉',
            `<p>Your watched item dropped to <b>$${Number(newPrice).toFixed(2)}</b>.</p>
             <p><a href="${link}" target="_blank" rel="nofollow">Open product</a></p>`
          );
          await supabase
            .from('watches')
            .update({ last_price: newPrice, threshold: newPrice })
            .eq('id', w.id);
        } else {
          await supabase.from('watches').update({ last_price: newPrice }).eq('id', w.id);
        }
      } catch (e) {
        console.warn('watch check error:', e.message);
      }
    }

    res.json({ ok: true, checked: (watches || []).length });
  } catch (e) {
    console.error('cron error', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Search ----------
app.post('/api/search', searchHandler);

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`API server on http://localhost:${PORT}`);
});
