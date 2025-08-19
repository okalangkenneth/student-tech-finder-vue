import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- /api/search (same logic as the Vercel function) ---
app.post('/api/search', async (req, res) => {
  try {
    const { budget, screen, os } = req.body ?? {};
    const parts = ['student laptop', os && os !== 'Any OS' ? os : '', screen && screen !== 'Any' ? `${screen} inch` : '', '>=16GB RAM preferred, SSD, long battery, 2023+'].filter(Boolean);
    const [min, max] = budget === 'Under €500' ? [0,500] : budget === '€500–€900' ? [500,900] : budget === '€900–€1400' ? [900,1400] : [0,99999];
    const query = parts.join(' ');

    const BASE = process.env.CHANNEL3_API_BASE || 'https://api.trychannel3.com';
    const KEY  = process.env.CHANNEL3_API_KEY;

    if (!KEY) return res.json({ ok: true, query, results: [] });

    const r = await fetch(new URL('/v0/search', BASE).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ query, limit: 6, filters: { price: { min_price: min, max_price: max } } }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => r.statusText);
      if (r.status === 401 || r.status === 403) return res.json({ ok: true, query, results: [], debug: 'Channel3 auth error: ' + txt });
      return res.status(502).json({ ok: false, error: `Channel3 ${r.status}: ${txt}` });
    }

    const data = await r.json().catch(() => []);
    const raw = Array.isArray(data) ? data : (data.results ?? []);
    const normalize = (p) => ({
      id: p.id, title: p.title, brand: p.brand_name ?? p.brand,
      price: { currency: p?.price?.currency ?? '€', amount: p?.price?.price ?? p?.price ?? 0 },
      image: p.image_url ?? p.image ?? '', url: p.deeplink_url ?? p.url ?? '',
      specs: { screen: p.specs?.screen ?? '', os: p.specs?.os ?? '' }, why: p.key_features ?? [],
    });

    res.json({ ok: true, query, results: raw.slice(0, 6).map(normalize) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- /api/go (local) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && serviceKey) ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }}) : null;

app.get('/api/go/:productId', async (req, res) => {
  const url = req.query.url;
  const rank = Number(req.query.rank || 0);
  const query = req.query.query || '';
  if (!url) return res.status(400).json({ ok: false, error: 'missing url' });

  try {
    if (supabase) {
      await supabase.from('clicks').insert({
        product_id: req.params.productId, query, rank,
        ua: req.headers['user-agent'] || '', referrer: req.get('referer') || '', outbound_url: url,
      });
    }
  } catch (_) {}
  return res.redirect(url);
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API server on http://localhost:${PORT}`));



