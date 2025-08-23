// server/api/search.js
import 'dotenv/config';
import fetch from 'node-fetch';

/** -------- helpers -------- */

function extractBullets(txt = '') {
  const s = txt.replace(/\s+/g, ' ').toLowerCase();
  const out = [];
  if (/battery|hours/i.test(s)) out.push('Good battery life');
  if (/light|weigh/i.test(s)) out.push('Lightweight');
  if (/ssd|nvme/i.test(s)) out.push('Fast SSD');
  if (/(16 ?gb|32 ?gb)/i.test(s)) out.push('≥16GB RAM');
  if (/quiet|fanless|silent/i.test(s)) out.push('Quiet cooling');
  return Array.from(new Set(out)).slice(0, 4);
}

// Map raw Channel3 product → our UI shape
function normalize(p) {
  const priceNum = p?.price?.price ?? p?.price ?? 0;
  const bullets = Array.isArray(p.key_features) && p.key_features.length
    ? p.key_features.slice(0, 4)
    : extractBullets(`${p.description || ''} ${p.title || ''}`);

  return {
    id: p.id,
    title: p.title,
    brand: p.brand_name ?? p.brand ?? '',
    price: { currency: p?.price?.currency || 'USD', amount: Number(priceNum) || 0 },
    image: p.image_url ?? p.image ?? '',
    url: p.deeplink_url ?? p.url ?? '',
    specs: {
      screen: p.specs?.screen ?? '',
      os: p.specs?.os ?? '',
      weightKg: p.specs?.weightKg ?? undefined,
    },
    why: bullets,
  };
}

// Student laptop query builder
function buildStudentLaptopQuery(budget, screen, os) {
  const parts = [
    'student laptop',
    os && os !== 'Any OS' ? os : '',
    screen && screen !== 'Any' ? `${screen} inch` : '',
    '>=16GB RAM preferred, SSD, long battery, 2023+',
  ].filter(Boolean);

  const [minPrice, maxPrice] =
    budget === 'Under €500' || budget === 'Under $500' ? [0, 500] :
    budget === '€500–€900'  || budget === '$500–$900' ? [500, 900] :
    budget === '€900–€1400' || budget === '$900–$1400' ? [900, 1400] :
    [0, 99999];

  return { query: parts.join(' '), minPrice, maxPrice };
}

// Topic → base query + guard keywords to keep results relevant
function topicQuery(topic, { budget, screen, os }) {
  if (topic === 'headphones') {
    return { query: 'noise-canceling headphones student', keep: /(headphone|headset|earbud)/i };
  }
  if (topic === 'hubs') {
    return { query: 'USB-C hub multiport', keep: /(hub|usb[- ]?c|dock)/i };
  }
  if (topic === 'backpacks') {
    return { query: 'laptop backpack student 15 inch', keep: /(backpack|rucksack|bag)/i };
  }
  if (topic === 'monitors') {
    return { query: 'budget monitor 24" 1080p', keep: /(monitor|display)/i };
  }
  // default: laptops
  const { query, minPrice, maxPrice } = buildStudentLaptopQuery(budget, screen, os);
  return { query, minPrice, maxPrice, keep: /(laptop|notebook|chromebook|macbook)/i };
}

/** -------- handler -------- */

export default async function searchHandler(req, res) {
  try {
    const {
      topic = 'laptop',
      budget = '$500–$900',
      screen = '14',
      os = 'Windows',
      // filters
      brands = [],
      page = 0,
      pageSize = 12,
      minPrice = null,
      maxPrice = null,
      broaden = false,
    } = req.body || {};

    const CH3_BASE =
      (process.env.CHANNEL3_API_BASE && process.env.CHANNEL3_API_BASE.trim()) ||
      'https://api.trychannel3.com/v0';
    const CH3_KEY = (process.env.CHANNEL3_API_KEY || '').trim();

    // Build query
    const { query, keep, minPrice: sMin, maxPrice: sMax } = topicQuery(topic, { budget, screen, os });

    // Merge price bounds
    const low = (minPrice ?? sMin ?? null);
    const high = (maxPrice ?? sMax ?? null);

    // If no key, serve demo-ish empty response so UI works
    if (!CH3_KEY) {
      return res.json({ ok: true, query, total: 0, brands: [], results: [] });
    }

    // For lack of a documented "offset", request up to the last item we need and slice on our side.
    const limit = Math.min(60, (Number(page) + 1) * Number(pageSize || 12));

    const body = {
      query,
      limit,
      filters: {},
      config: { enrich_query: true, semantic_search: true },
    };

    if (low != null || high != null) {
      body.filters.price = {
        min_price: low != null ? Number(low) : 0,
        max_price: high != null ? Number(high) : 999999,
      };
    }

    const endpoint = `${CH3_BASE}/search`;
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CH3_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => r.statusText);
      console.error('Channel3 error:', r.status, txt);
      return res.status(502).json({ ok: false, error: `Channel3 ${r.status}: ${txt}` });
    }

    const data = await r.json().catch(() => ({}));
    const raw = Array.isArray(data) ? data : (data.results || []);
    let list = raw.map(normalize);

    // Optional relevance guard to drop clothing / random items when not broadening
    if (!broaden && keep) {
      list = list.filter(p => keep.test((p.title || '')));
    }

    // Brand filter (client supplies names); also compute available brands from current set
    const brandsAvailable = Array.from(new Set(list.map(p => p.brand).filter(Boolean))).sort();
    if (Array.isArray(brands) && brands.length) {
      const set = new Set(brands.map(String));
      list = list.filter(p => set.has(p.brand));
    }

    // Deduplicate: title+brand+rounded price
    const seen = new Map();
    for (const p of list) {
      const key = `${(p.title || '').toLowerCase()}|${(p.brand || '').toLowerCase()}|${Math.round(p.price?.amount || 0)}`;
      if (!seen.has(key)) seen.set(key, p);
    }
    const deduped = Array.from(seen.values());

    // Pagination slice
    const start = Number(page) * Number(pageSize || 12);
    const end = start + Number(pageSize || 12);
    const pageItems = deduped.slice(0, limit).slice(start, end);

    res.json({
      ok: true,
      query,
      total: deduped.length,
      brands: brandsAvailable,
      results: pageItems,
    });
  } catch (e) {
    console.error('/api/search failed:', e);
    res.status(500).json({ ok: false, error: e?.message || 'search failed' });
  }
}
