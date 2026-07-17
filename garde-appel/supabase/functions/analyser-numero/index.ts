// ============================================================================
// Edge Function Supabase — analyser-numero
// Analyse un numéro ou un SMS suspect avec l'API Anthropic.
// La clé Anthropic reste côté serveur (secret Supabase), jamais dans l'app.
//
// Déploiement :
//   supabase functions deploy analyser-numero
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================

// @ts-nocheck — exécuté par le runtime Deno de Supabase, pas par TypeScript RN.

const MODELE = 'claude-opus-4-8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Requete {
  valeur: string;
  type: 'numero' | 'sms';
}

const SYSTEME = `Tu es un expert en détection de fraude téléphonique et par SMS en France.
On te fournit soit un numéro de téléphone, soit le texte d'un SMS suspect.
Tu évalues le risque d'arnaque, de démarchage abusif ou de phishing.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{
  "verdict": "sur" | "suspect" | "arnaque",
  "score_risque": <entier 0-100>,
  "categorie": "arnaque" | "demarchage" | "phishing" | "inconnu",
  "explication": "<une à deux phrases en français, claires et concrètes>"
}

Règles :
- "sur" (score < 35) : aucun signal d'alerte notable.
- "suspect" (35-69) : quelques signaux, prudence recommandée.
- "arnaque" (>= 70) : forts signaux de fraude.
- Pour un numéro seul sans contexte, reste prudent et n'invente pas de faits.
- Repère les marqueurs classiques : fausse urgence, lien raccourci, demande
  de données bancaires/identifiants, faux services (CPF, Ameli, colis, impôts),
  préfixes surtaxés, orthographe suspecte.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cle = Deno.env.get('ANTHROPIC_API_KEY');
    if (!cle) {
      return json({ error: 'ANTHROPIC_API_KEY manquante côté serveur.' }, 500);
    }

    const { valeur, type } = (await req.json()) as Requete;
    if (!valeur || (type !== 'numero' && type !== 'sms')) {
      return json({ error: 'Requête invalide.' }, 400);
    }

    const contenu =
      type === 'numero'
        ? `Analyse ce numéro de téléphone : ${valeur}`
        : `Analyse ce SMS suspect :\n"""\n${valeur}\n"""`;

    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 400,
        system: SYSTEME,
        messages: [{ role: 'user', content: contenu }],
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      return json({ error: `Anthropic ${reponse.status}: ${detail}` }, 502);
    }

    const data = await reponse.json();
    const texte: string = data?.content?.[0]?.text ?? '';

    // L'IA doit renvoyer du JSON pur ; on isole le premier objet par sécurité.
    const debut = texte.indexOf('{');
    const fin = texte.lastIndexOf('}');
    if (debut === -1 || fin === -1) {
      return json(
        {
          verdict: 'suspect',
          score_risque: 50,
          categorie: 'inconnu',
          explication: 'Analyse indisponible, prudence recommandée.',
        },
        200,
      );
    }

    const parsed = JSON.parse(texte.slice(debut, fin + 1));
    return json(parsed, 200);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Erreur inconnue.' },
      500,
    );
  }
});

function json(corps: unknown, statut: number): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
