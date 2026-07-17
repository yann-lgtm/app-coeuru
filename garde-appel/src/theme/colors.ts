/**
 * Palette et tokens de design de GardeAppel.
 * Thème sombre par défaut, orienté confiance/sécurité.
 */
import type { Categorie, Verdict } from '@/types';

export const colors = {
  fond: '#0B1220',
  fondCarte: '#141E30',
  fondCarteElevee: '#1C2942',
  bordure: '#26344F',
  texte: '#F4F7FB',
  texteAttenue: '#93A2BC',
  texteFaible: '#5E6E8A',

  primaire: '#3B82F6',
  primaireFonce: '#2563EB',

  sur: '#22C55E',
  suspect: '#F59E0B',
  arnaque: '#EF4444',

  surFond: 'rgba(34, 197, 94, 0.14)',
  suspectFond: 'rgba(245, 158, 11, 0.14)',
  arnaqueFond: 'rgba(239, 68, 68, 0.14)',
} as const;

export const espace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Couleur associée à un verdict. */
export function couleurVerdict(v: Verdict): string {
  return colors[v];
}

/** Couleur de fond atténuée associée à un verdict. */
export function fondVerdict(v: Verdict): string {
  return { sur: colors.surFond, suspect: colors.suspectFond, arnaque: colors.arnaqueFond }[v];
}

/** Libellé lisible d'un verdict. */
export function libelleVerdict(v: Verdict): string {
  return { sur: 'Sûr', suspect: 'Suspect', arnaque: 'Arnaque' }[v];
}

/** Emoji associé à un verdict. */
export function emojiVerdict(v: Verdict): string {
  return { sur: '✅', suspect: '⚠️', arnaque: '🚨' }[v];
}

/** Libellé lisible d'une catégorie. */
export function libelleCategorie(c: Categorie): string {
  return {
    arnaque: 'Arnaque',
    demarchage: 'Démarchage',
    phishing: 'Phishing',
    inconnu: 'Inconnu',
  }[c];
}
