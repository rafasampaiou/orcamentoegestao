import { createClient } from '@supabase/supabase-js';

// Mints a real Supabase Auth session from just an email, with no password/code/link step.
// This only runs server-side (Vercel function) because it needs the service_role key —
// that key must never reach the browser bundle. The resulting session is a genuine
// `authenticated`-role JWT, so it satisfies the RLS policies ("Allow all for authenticated")
// the rest of the app already depends on for reads/writes.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!email.endsWith('@taua.com.br')) {
    res.status(403).json({ error: 'Use um e-mail @taua.com.br.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .ilike('email', email)
    .maybeSingle();

  if (!profile) {
    res.status(403).json({ error: 'E-mail não cadastrado no sistema.' });
    return;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    res.status(500).json({ error: 'Erro ao gerar sessão.' });
    return;
  }

  const { data: verifyData, error: verifyError } = await admin.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'magiclink',
  });

  if (verifyError || !verifyData.session) {
    res.status(500).json({ error: 'Erro ao autenticar.' });
    return;
  }

  res.status(200).json({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });
}
