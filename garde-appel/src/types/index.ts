/**
 * Types partagés de l'application GardeAppel.
 */

/** Catégories de signalement d'un numéro. */
export type Categorie = 'arnaque' | 'demarchage' | 'phishing' | 'inconnu';

/** Verdict rendu à l'utilisateur après analyse. */
export type Verdict = 'sur' | 'suspect' | 'arnaque';

/** Type d'élément analysé. */
export type TypeAnalyse = 'numero' | 'sms';

/** Ligne de la table Supabase `numeros_signales`. */
export interface NumeroSignale {
  numero: string;
  categorie: Categorie;
  nb_signalements: number;
  score_risque: number; // 0-100
  derniere_activite: string; // timestamp ISO
}

/** Résultat d'une analyse (Supabase et/ou IA). */
export interface ResultatAnalyse {
  verdict: Verdict;
  score_risque: number; // 0-100
  categorie: Categorie;
  explication: string;
  /** Source du verdict : base communautaire ou analyse IA. */
  source: 'base' | 'ia';
  /** Nombre de signalements connus (0 si inconnu). */
  nb_signalements: number;
}

/** Entrée de l'historique local des consultations. */
export interface EntreeHistorique {
  id: string;
  valeur: string; // le numéro ou le SMS analysé
  type: TypeAnalyse;
  resultat: ResultatAnalyse;
  consulte_le: string; // timestamp ISO
}

/** Réponse structurée attendue de l'Edge Function d'analyse IA. */
export interface ReponseIA {
  verdict: Verdict;
  score_risque: number;
  categorie: Categorie;
  explication: string;
}
