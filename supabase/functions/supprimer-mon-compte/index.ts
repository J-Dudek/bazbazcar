// Edge Function : supprime le compte de l'appelant. Nécessite service_role
// (auth.admin.deleteUser) — voir CLAUDE.md §7, cette clé ne quitte jamais
// cette fonction. La suppression de auth.users cascade sur profiles (0001)
// puis sur trajets/inscriptions/evenements/commentaires (0016).
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Non authentifié' }, 401);
  }

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

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role === 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');

    if ((count ?? 0) <= 1) {
      return json(
        {
          error:
            "Tu es le seul administrateur de l'association : désigne un autre administrateur avant de supprimer ton compte.",
        },
        400,
      );
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ success: true });
});
