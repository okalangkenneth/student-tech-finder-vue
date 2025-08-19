import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' })
  try{
    const { email, product_id, threshold=null, last_price=null } = req.body || {}
    if (!email || !product_id) return res.status(400).json({ ok:false, error:'Missing fields' })
    const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false } })
    const { error } = await s.from('price_watches').upsert(
      { email, product_id, threshold, last_price },
      { onConflict:'email,product_id' }
    )
    if (error) throw error
    res.json({ ok:true })
  }catch(e){ res.status(500).json({ ok:false, error: e.message }) }
}
