import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { productId } = req.query;
  const url   = req.query.url;
  const rank  = Number(req.query.rank || 0);
  const query = req.query.query || '';

  if (!url) return res.status(400).json({ ok: false, error: 'missing url' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }});
      await supabase.from('clicks').insert({
        product_id: productId, query, rank,
        ua: req.headers['user-agent'] || '', referrer: req.headers.referer || '', outbound_url: url,
      });
    }
  } catch (_) { /* non-blocking */ }

  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}
