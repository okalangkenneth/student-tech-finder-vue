import { createClient } from '@supabase/supabase-js'
export const config = { schedule: '*/30 * * * *' } // every 30 minutes

export default async function handler(_req,res){
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}})
  const { data: watches } = await s.from('price_watches').select('*').limit(500)
  if (!watches?.length) return res.json({ok:true, checked:0})
  const hits = []
  for (const w of watches){
    // naive approach: re-run a narrow search by product id/title
    // (If Channel3 exposes a product detail endpoint, switch to that.)
    const r = await fetch('https://api.trychannel3.com/v0/search', {
      method:'POST',
      headers:{'content-type':'application/json','x-api-key':process.env.CHANNEL3_API_KEY},
      body: JSON.stringify({ query: w.product_id, limit: 1 })
    })
    if (!r.ok) continue
    const [p] = await r.json()
    const price = p?.price?.price ?? p?.price ?? null
    if (price!=null){
      await s.from('price_watches').update({ last_price: price }).eq('id', w.id)
      if (w.threshold && price <= Number(w.threshold)) hits.push({ w, p, price })
    }
  }
  // send notifications (reuse resend)
  if (process.env.RESEND_API_KEY && hits.length){
    for (const hit of hits){
      await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{ 'authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'content-type':'application/json' },
        body: JSON.stringify({
          from:'Student Tech <noreply@yourdomain>',
          to:[hit.w.email],
          subject:'Price drop!',
          text:`${hit.p.title} is now ${hit.price}. Link: ${hit.p.url}`
        })
      })
    }
  }
  res.json({ ok:true, checked:watches.length, alerts: hits.length })
}
