import { analyserAvecIA } from '@/lib/anthropic';
import { supabaseConfigure } from '@/lib/config';
import { ajouterHistorique } from '@/lib/storage';
import { chercherNumero } from '@/lib/supabase';
import type { Categorie, ResultatAnalyse, TypeAnalyse, Verdict } from '@/types';

/** Déduit un verdict à partir d'un score de risque 0-100. */
export function verdictDepuisScore(score: number): Verdict {
  if (score >= 70) return 'arnaque';
  if (score >= 35) return 'suspect';
  return 'sur';
}

/** Convertit une catégorie communautaire en verdict de départ. */
function verdictDepuisCategorie(categorie: Categorie, score: number): Verdict {
  if (categorie === 'arnaque' || categorie === 'phishing') return 'arnaque';
  return verdictDepuisScore(score);
}

/**
 * Analyse un numéro ou un SMS.
 *
 * Stratégie :
 *  1. Si c'est un numéro, on le cherche d'abord dans la base communautaire Supabase.
 *  2. Numéro connu -> verdict issu de la base (rapide, fiable, hors-ligne des autres).
 *  3. Numéro inconnu OU analyse de SMS -> appel à l'IA (Edge Function Anthropic).
 *
 * Le résultat est enregistré dans l'historique local.
 */
export async function analyser(
  valeur: string,
  type: TypeAnalyse,
): Promise<ResultatAnalyse> {
  let resultat: ResultatAnalyse | null = null;

  // 1. Base communautaire (numéros uniquement).
  if (type === 'numero' && supabaseConfigure) {
    try {
      const connu = await chercherNumero(valeur);
      if (connu && connu.nb_signalements > 0) {
        resultat = {
          verdict: verdictDepuisCategorie(connu.categorie, connu.score_risque),
          score_risque: connu.score_risque,
          categorie: connu.categorie,
          nb_signalements: connu.nb_signalements,
          source: 'base',
          explication: `Ce numéro a été signalé ${connu.nb_signalements} fois par la communauté (${connu.categorie}).`,
        };
      }
    } catch {
      // On tombe en repli sur l'IA si Supabase échoue.
    }
  }

  // 2. Analyse IA si rien trouvé en base.
  if (!resultat) {
    const ia = await analyserAvecIA(valeur, type);
    resultat = {
      verdict: ia.verdict,
      score_risque: ia.score_risque,
      categorie: ia.categorie,
      nb_signalements: 0,
      source: 'ia',
      explication: ia.explication,
    };
  }

  // 3. Historique local.
  await ajouterHistorique(valeur, type, resultat);
  return resultat;
}

/** Détecte si une saisie ressemble à un numéro de téléphone. */
export function ressembleAUnNumero(valeur: string): boolean {
  const nettoye = valeur.replace(/[\s.\-()]/g, '');
  return /^\+?\d{6,15}$/.test(nettoye);
}
