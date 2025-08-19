import { createClient } from '@supabase/supabase-js'

export const config = { schedule: '0 9 * * 1' } // every Monday 09:00 UTC

export default async function handler(req, res){
  try{
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false }})
    const { data: subs, error } = await supabase.from('subscribers').select('email, topic, max_price').limit(1000)
    if (error) throw error

    // group by (topic, max_price bucket)
    const buckets = new Map()
    for (const s of subs || []){
      const key = `${s.topic || 'laptop'}|${Math.floor((s.max_price||0)/100)*100}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(s)
    }

    const picksByKey = new Map()
    const BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

    for (const [key, members] of buckets){
      const [topic, bucket] = key.split('|'); const maxPrice = Number(bucket)||0
      // call our own API to reuse logic
      const resp = await fetch(`${BASE}/api/search`, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({
          topic: topic || 'laptop',
          budget: 'Any', screen: 'Any', os: 'Any OS',
          page: 0, pageSize: 6
        })
      })
      const data = await resp.json().catch(()=>({}))
      picksByKey.set(key, (data.results||[]).slice(0,6))
      // send batched emails
      await sendDigest(members.map(m=>m.email), picksByKey.get(key))
    }

    return res.json({ ok:true, groups: buckets.size })
  } catch(e){ return res.status(500).json({ ok:false, error: e.message }) }
}

async function sendDigest(emails, items){
  if (!process.env.RESEND_API_KEY || !emails?.length) return
  const body = [
    `Top picks this week:`,
    ...items.map(p=>`• ${p.title} — ${p.price.currency} ${p.price.amount} (${p.brand})`)
  ].join('\n')

  await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ 'authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({
      from: 'Student Tech <noreply@yourdomain>',
      to: emails.slice(0,50), // batch
      subject: 'Student Tech: weekly picks',
      text: body
    })
  })
}
