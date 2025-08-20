export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' })

  const {
    budget, screen, os,
    brands = [],
    page = 0, pageSize = 12,
    topic = 'laptop',
    minPrice = null,
    maxPrice = null,
    broaden = false       // NEW
  } = req.body ?? {}

  // Build query
  const baseTerm =
    topic === 'laptop'     ? 'student laptop' :
    topic === 'headphones' ? 'noise canceling headphones' :
    topic === 'hubs'       ? 'USB-C hub' :
    topic === 'backpacks'  ? 'student backpack' :
    topic === 'monitors'   ? 'budget 24-inch monitor' : 'student laptop'

  const specSuffix = (!broaden && topic === 'laptop')
    ? '>=16GB RAM preferred, SSD, long battery, 2023+'  // strict
    : ''                                                // relaxed

  const parts = [
    baseTerm,
    os && os !== 'Any OS' ? os : '',
    (screen && screen !== 'Any' && topic === 'laptop') ? `${screen} inch` : '',
    specSuffix
  ].filter(Boolean)
  const query = parts.join(' ')

  // Price band (manual overrides budget)
  let bandMin = 0, bandMax = 99999
  if (minPrice != null || maxPrice != null) {
    bandMin = Number(minPrice ?? 0)
    bandMax = Number(maxPrice ?? 99999)
  } else {
    [bandMin, bandMax] =
      budget === 'Under €500' ? [0, 500] :
      budget === '€500–€900'  ? [500, 900] :
      budget === '€900–€1400' ? [900, 1400] : [0, 99999]
  }

  const BASE = process.env.CHANNEL3_API_BASE || 'https://api.trychannel3.com'
  const KEY  = process.env.CHANNEL3_API_KEY
  if (!KEY) return res.json({ ok:true, query, results:[], total:0, brands:[], page, pageSize })

  // Relevance rules
  const PATTERNS = {
    laptop:     { include: [/laptop|notebook|macbook|chromebook/i], exclude: [/sleeve|case|skin|sticker|t[- ]?shirt|dress|sundress|hoodie/i] },
    headphones: { include: [/headphone|headset|earbud|in[- ]?ear|over[- ]?ear/i], exclude: [/t[- ]?shirt|dress|case|sleeve/i] },
    hubs:       { include: [/hub|dock|docking|adapter|usb[- ]?c|thunderbolt/i], exclude: [/t[- ]?shirt|dress/i] },
    backpacks:  { include: [/backpack|rucksack|school bag|laptop bag/i], exclude: [/t[- ]?shirt|dress/i] },
    monitors:   { include: [/monitor|display/i], exclude: [/tv|television|projector/i] },
  }
  // Loosen excludes when broaden=true
  if (broaden) {
    for (const k of Object.keys(PATTERNS)) PATTERNS[k].exclude = []
  }
  const isRelevant = (p) => {
    const text = `${p.title||''} ${p.description||''}`
    const { include, exclude } = PATTERNS[topic] || PATTERNS.laptop
    const okInc = include.some(rx => rx.test(text))
    const bad   = exclude.some(rx => rx.test(text))
    return okInc && !bad
  }

  const normalize = (p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand_name ?? p.brand,
    price: { currency: p?.price?.currency ?? 'USD', amount: p?.price?.price ?? p?.price ?? 0 },
    image: p.image_url ?? p.image ?? '',
    url: p.deeplink_url ?? p.url ?? '',
    specs: { screen: p.specs?.screen ?? '', os: p.specs?.os ?? '', weightKg: p.specs?.weightKg },
    why: Array.from(new Set(p.key_features || [])).slice(0,6),
    description: p.description ?? ''
  })

  // Higher pull when broadened
  const multiplier = broaden ? 3 : 2
  const effectiveLimit = Math.min((page + 1) * pageSize * multiplier, broaden ? 120 : 80)

  const filters = { price: { min_price: bandMin, max_price: bandMax } }
  if (brands?.length) filters.brand_names = brands

  const r = await fetch(new URL('/v0/search', BASE).toString(), {
    method:'POST',
    headers:{ 'content-type':'application/json', 'x-api-key': KEY },
    body: JSON.stringify({ query, limit: effectiveLimit, filters })
  })
  if (!r.ok) {
    const txt = await r.text().catch(()=>r.statusText)
    if (r.status === 401 || r.status === 403) return res.json({ ok:true, query, results:[], total:0, brands:[], page, pageSize, debug:txt })
    return res.status(502).json({ ok:false, error:`Channel3 ${r.status}: ${txt}` })
  }

  const json = await r.json().catch(()=>[])
  const raw = Array.isArray(json) ? json : (json.results ?? [])
  let normalized = raw.map(normalize).filter(isRelevant)

  // after: let normalized = raw.map(normalize).filter(isRelevant)

  const dedupeByTitleBrandPrice = (arr) => {
    const seen = new Set()
    return arr.filter(p => {
      const key = `${(p.title||'').toLowerCase().trim()}|${(p.brand||'').toLowerCase().trim()}|${Math.round(p?.price?.amount ?? 0)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

normalized = dedupeByTitleBrandPrice(normalized)

if (brands?.length) normalized = normalized.filter(p => p.brand && brands.includes(p.brand))


  if (brands?.length) normalized = normalized.filter(p => p.brand && brands.includes(p.brand))

  const brandSet = new Set(normalized.map(p => p.brand).filter(Boolean))
  const allBrands = Array.from(brandSet).sort()

  const total = normalized.length
  const start = page * pageSize
  const pageSlice = normalized.slice(start, start + pageSize)

  res.json({ ok:true, query, results:pageSlice, total, brands: allBrands, page, pageSize })
}



