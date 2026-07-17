import { config } from '@/lib/config';
import type { ReponseIA, TypeAnalyse } from '@/types';

/**
 * Analyse IA d'un numéro ou d'un SMS suspect.
 *
 * ⚠️ La clé Anthropic ne doit JAMAIS vivre dans l'app mobile : elle serait
 * extractible du binaire. On passe donc par une Edge Function Supabase
 * (`analyser-numero`) qui détient la clé côté serveur.
 * Voir supabase/functions/analyser-numero/index.ts.
 */
export async function analyserAvecIA(
  valeur: string,
  type: TypeAnalyse,
): Promise<ReponseIA> {
  const url = `${config.supabaseUrl}/functions/v1/analyser-numero`;

  const reponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
    body: JSON.stringify({ valeur, type }),
  });

  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => '');
    throw new Error(
      `Échec de l'analyse IA (${reponse.status}) : ${detail || reponse.statusText}`,
    );
  }

  const data = (await reponse.json()) as Partial<ReponseIA>;

  // Validation défensive : l'IA peut renvoyer un format inattendu.
  return {
    verdict: data.verdict ?? 'suspect',
    score_risque:
      typeof data.score_risque === 'number'
        ? Math.max(0, Math.min(100, Math.round(data.score_risque)))
        : 50,
    categorie: data.categorie ?? 'inconnu',
    explication:
      data.explication ?? "Analyse indisponible, prudence recommandée.",
  };
}
