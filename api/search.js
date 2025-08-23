// Vercel serverless function (Node runtime)
// No node-fetch import needed on Node 18+

/** -------- helpers -------- */
function normalize(p = {}) {
  return {
    id: p.id,
    title: p.title,
    brand: p.brand_name ?? p.brand ?? '',
    price: {
      currency: p?.price?.currency ?? 'USD',
      amount: Number(p?.price?.price ?? p?.price ?? 0),
    },
    image: p.image_url ?? p.image ?? '',
    url: p.deeplink_url ?? p.url ?? '',
    specs: {
      screen: p.specs?.screen ?? '',
      os: p.specs?.os ?? '',
      weightKg: p.specs?.weightKg ?? undefined,
    },
    why: Array.isArray(p.key_features) ? p.key_features : [],
  };
}

function buildQuery({ topic, budget, screen, os, broaden }) {
  const topicPhrase =
    topic === 'headphones' ? 'noise cancelling headphones' :
    topic === 'hubs'       ? 'usb-c hub' :
    topic === 'backpacks'  ? 'laptop backpack' :
    topic === 'monitors'   ? 'budget monitor' :
                             'student laptop';

  const parts = [topicPhrase];

  if (!broaden) {
    if (os && os !== 'Any OS') parts.push(os);
    if (screen && screen !== 'Any' && topic === 'laptop') parts.push(`${screen} inch`);
    if (topic === 'laptop') parts.push('>=16GB RAM preferred, SSD, long battery, 2023+');
  }

  if (broaden) parts.push('best value');

  // Budget → numeric range (interpreted as USD)
  let minPrice = 0, maxPrice = 99999;
  if (budget === 'Under €500' || budget === 'Under $500') {
    maxPrice = 500;
  } else if (budget === '€500–€900' || budget === '$500–$900') {
    minPrice = 500; maxPrice = 900;
  } else if (budget === '€900–€1400' || budget === '$900–$1400') {
    minPrice = 900; maxPrice = 1400;
  }

  return { query: parts.join(' '), minPrice, maxPrice };
}

function uniqueByTitleBrandPrice(list) {
  const m = new Map();
  for (const p of list) {
    const key = `${(p.title||'').toLowerCase()}|${(p.brand||'').toLowerCase()}|${Math.round(p.price?.amount||0)}`;
    if (!m.has(key)) m.set(key, p);
  }
  return [...m.values()];
}

/** -------- handler -------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      topic = 'laptop',
      budget = '$500–$900',
      screen = '14',
      os = 'Windows',
      brands = [],
      page = 0,
      pageSize = 12,
      minPrice = null,
      maxPrice = null,
      broaden = false,
    } = req.body || {};

    const { query, minPrice: bMin, maxPrice: bMax } = buildQuery({ topic, budget, screen, os, broaden });

    const effectiveMin = Number.isFinite(minPrice) ? Number(minPrice) : bMin;
    const effectiveMax = Number.isFinite(maxPrice) ? Number(maxPrice) : bMax;

    const base = process.env.CHANNEL3_API_BASE || 'https://api.trychannel3.com/v0';
    const key  = process.env.CHANNEL3_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'Missing CHANNEL3_API_KEY' });

    const endpoint = `${base.replace(/\/$/, '')}/search`;

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,               // Channel3 expects x-api-key
      },
      body: JSON.stringify({
        query,
        limit: Math.min(50, pageSize),  // page handled client-side
        filters: {
          price: {
            min_price: Math.max(0, effectiveMin),
            max_price: Math.max(effectiveMin, effectiveMax),
          },
          // If you want to pass brand filters to Channel3 directly, you can:
          // brand_name: brands.length ? brands : undefined,
        },
        config: { enrich_query: true, semantic_search: true },
      }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => r.statusText);
      console.error('Channel3 search error:', r.status, txt);
      return res.status(502).json({ ok: false, error: `Channel3 ${r.status}: ${txt}` });
    }

    const raw = await r.json().catch(() => []);
    // raw is an array per Channel3 docs
    let results = Array.isArray(raw) ? raw.map(normalize) : [];

    // Local brand filter (UI chips)
    if (Array.isArray(brands) && brands.length) {
      results = results.filter(p => brands.includes(p.brand));
    }

    results = uniqueByTitleBrandPrice(results);

    // Build brand list from this page (for chips)
    const brandSet = new Set(results.map(p => p.brand).filter(Boolean));
    const brandList = [...brandSet].sort((a, b) => a.localeCompare(b));

    // Simulate pagination client-side: just send what we have
    const total = results.length;

    return res.json({
      ok: true,
      query,
      total,
      brands: brandList,
      results,
    });
  } catch (e) {
    console.error('/api/search failed:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'search failed' });
  }
}

