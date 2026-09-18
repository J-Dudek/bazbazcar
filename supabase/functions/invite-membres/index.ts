// Edge Function : invite un ou plusieurs membres par email.
// Nécessite la clé service_role (auth.admin.inviteUserByEmail + passage direct
// du statut à 'valide') — voir CLAUDE.md §7 : cette clé ne doit jamais
// apparaître côté Angular, uniquement ici, dans les secrets de la fonction.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Non authentifié' }, 401);
  }

  // Client "au nom de l'appelant" (anon key + son JWT) : sert uniquement à
  // identifier qui appelle, jamais à effectuer les opérations privilégiées.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    return json({ error: 'Non authentifié' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Le rôle est vérifié ici, côté serveur, sur la base de la table profiles —
  // jamais sur une info envoyée par le client.
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return json({ error: 'Réservé aux administrateurs' }, 403);
  }

  let body: { emails?: unknown; redirectTo?: string; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400);
  }

  const { emails, redirectTo, role } = body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return json({ error: 'Aucune adresse email fournie' }, 400);
  }

  // Valeur non fiable venant du client : on ne retient que 'admin', tout le
  // reste retombe sur 'membre' (comportement par défaut existant).
  const roleAttribue = role === 'admin' ? 'admin' : 'membre';

  const results: InviteResult[] = [];

  for (const raw of emails) {
    const email = String(raw).trim();
    if (!email) continue;

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) {
      results.push({ email, success: false, error: error.message });
      continue;
    }

    if (data.user) {
      // Une invitation admin vaut validation : le compte n'a pas besoin de
      // repasser par l'écran "en attente".
      await admin.from('profiles').update({ statut: 'valide', role: roleAttribue }).eq('id', data.user.id);
    }

    results.push({ email, success: true });
  }

  return json({ results });
});
