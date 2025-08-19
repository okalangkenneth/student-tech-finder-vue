import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  try {
    const { email, topic = 'laptop', max_price = null } = req.body || {}
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return res.status(500).json({ ok: false, error: 'Server not configured' })

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    // Upsert works if you add a UNIQUE index on (email, topic) in Supabase
    const { error } = await supabase.from('subscribers').upsert(
      { email, topic, max_price },
      { onConflict: 'email,topic' }
    )
    if (error) throw error
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }) }
}
