export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

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

  const json = await r.json().catch(() => []);
  const raw = Array.isArray(json) ? json : (json.results ?? []);
  const normalize = (p) => ({
    id: p.id, title: p.title, brand: p.brand_name ?? p.brand,
    price: { currency: p?.price?.currency ?? '€', amount: p?.price?.price ?? p?.price ?? 0 },
    image: p.image_url ?? p.image ?? '', url: p.deeplink_url ?? p.url ?? '',
    specs: { screen: p.specs?.screen ?? '', os: p.specs?.os ?? '' }, why: p.key_features ?? [],
  });

  res.json({ ok: true, query, results: raw.slice(0, 6).map(normalize) });
}
