// replaces current file
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  const {
    budget, screen, os,
    brands = [],               // array of brand names to include
    page = 0,                  // 0-based
    pageSize = 12,             // items per page
    topic = 'laptop',          // for category tabs (laptop, headphones, etc.)
  } = req.body ?? {};

  const parts = [
    topic === 'laptop' ? 'student laptop' :
    topic === 'headphones' ? 'noise-canceling headphones' :
    topic === 'hubs' ? 'USB-C hub' :
    topic === 'backpacks' ? 'student laptop backpack' :
    topic === 'monitors' ? 'budget 24-inch monitor' : 'student laptop',
    os && os !== 'Any OS' ? os : '',
    screen && screen !== 'Any' && topic === 'laptop' ? `${screen} inch` : '',
    topic === 'laptop' ? '>=16GB RAM preferred, SSD, long battery, 2023+' : ''
  ].filter(Boolean);
  const [min, max] =
    budget === 'Under €500' ? [0, 500] :
    budget === '€500–€900'  ? [500, 900] :
    budget === '€900–€1400' ? [900, 1400] : [0, 99999];
  const query = parts.join(' ');

  const BASE = process.env.CHANNEL3_API_BASE || 'https://api.trychannel3.com';
  const KEY  = process.env.CHANNEL3_API_KEY;

  // helper: enrich “why we like this”
  const inferWhy = (p) => {
    const title = (p.title || '').toLowerCase();
    const desc  = (p.description || '').toLowerCase();
    const bag = `${title} ${desc}`;
    const why = new Set(p.key_features || []);
    if (bag.includes('16gb')) why.add('16GB RAM');
    if (bag.includes('32gb')) why.add('32GB RAM');
    if (bag.includes('ssd'))  why.add('SSD storage');
    if (bag.includes('ryzen 7')||bag.includes('i7')) why.add('Fast CPU');
    if (bag.includes('battery')) why.add('Good battery');
    if (bag.includes('light')||bag.includes('1.2 kg')) why.add('Lightweight');
    if (bag.includes('touch')) why.add('Touchscreen');
    return Array.from(why).slice(0,6);
  };

  const normalize = (p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand_name ?? p.brand,
    price: { currency: p?.price?.currency ?? 'USD', amount: p?.price?.price ?? p?.price ?? 0 },
    image: p.image_url ?? p.image ?? '',
    url: p.deeplink_url ?? p.url ?? '',
    specs: { screen: p.specs?.screen ?? '', os: p.specs?.os ?? '', weightKg: p.specs?.weightKg },
    why: inferWhy(p),
    description: p.description ?? ''
  });

  if (!KEY) {
    return res.json({ ok:true, query, results:[], total:0, brands:[], page, pageSize });
  }

  // call Channel3 with a higher limit and slice for paging (API doesn’t expose cursor publicly)
  const effectiveLimit = Math.min((page + 1) * pageSize, 60); // cap to keep response reasonable
  const filters = { price: { min_price: min, max_price: max } };
  if (Array.isArray(brands) && brands.length) {
    // If the API supports brand filtering: try it.
    // Otherwise we’ll filter on the server after the fetch.
    filters.brand_names = brands;
  }

  const r = await fetch(new URL('/v0/search', BASE).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify({
      query,
      limit: effectiveLimit,
      filters
      // config or additional flags can be added here if needed
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(()=>r.statusText);
    if (r.status === 401 || r.status === 403) return res.json({ ok:true, query, results:[], total:0, brands:[], page, pageSize, debug:txt });
    return res.status(502).json({ ok:false, error:`Channel3 ${r.status}: ${txt}` });
  }

  const json = await r.json().catch(() => []);
  const raw = Array.isArray(json) ? json : (json.results ?? []);
  let normalized = raw.map(normalize);

  // If brand filter wasn’t honored upstream, enforce here
  if (Array.isArray(brands) && brands.length) {
    normalized = normalized.filter(p => p.brand && brands.includes(p.brand));
  }

  // compute brand list from the current result set
  const brandSet = new Set(normalized.map(p => p.brand).filter(Boolean));
  const allBrands = Array.from(brandSet).sort();

  const total = normalized.length;
  const pageStart = page * pageSize;
  const pageSlice = normalized.slice(pageStart, pageStart + pageSize);

  res.json({ ok:true, query, results:pageSlice, total, brands: allBrands, page, pageSize });
}

