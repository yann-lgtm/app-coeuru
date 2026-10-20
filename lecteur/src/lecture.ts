import type { Morceau } from './bibliotheque';

/*
 * Règles de lecture : quel morceau vient après, selon la répétition et le
 * hasard. Pur calcul, sans état : l'écran décide quand l'appeler.
 */

export type Repetition = 'non' | 'morceau' | 'theme';

export const LIBELLES_REPETITION: Record<Repetition, string> = {
  non: 'Pas de répétition',
  morceau: 'Répète ce morceau',
  theme: 'Répète le thème',
};

export function repetitionSuivante(r: Repetition): Repetition {
  return r === 'non' ? 'morceau' : r === 'morceau' ? 'theme' : 'non';
}

/**
 * Index du morceau suivant, ou null s'il faut s'arrêter.
 * - au hasard : un autre morceau du même thème ;
 * - « répète le thème » : le suivant du thème, puis retour au premier ;
 * - sinon : le suivant de toute la liste, arrêt au dernier.
 */
export function indexSuivant(
  morceaux: Morceau[],
  courant: number,
  repetition: Repetition,
  aleatoire: boolean,
): number | null {
  const actuel = morceaux[courant];
  if (!actuel) return null;
  const memeTheme = morceaux.flatMap((m, i) => (m.theme === actuel.theme ? [i] : []));

  if (aleatoire) {
    const autres = memeTheme.filter((i) => i !== courant);
    if (autres.length === 0) return repetition === 'non' ? null : courant;
    return autres[Math.floor(Math.random() * autres.length)];
  }
  if (repetition === 'theme') {
    const position = memeTheme.indexOf(courant);
    return memeTheme[(position + 1) % memeTheme.length];
  }
  return courant + 1 < morceaux.length ? courant + 1 : null;
}

/** Index du morceau précédent (même logique de thème), ou null. */
export function indexPrecedent(morceaux: Morceau[], courant: number, repetition: Repetition): number | null {
  const actuel = morceaux[courant];
  if (!actuel) return null;
  if (repetition === 'theme') {
    const memeTheme = morceaux.flatMap((m, i) => (m.theme === actuel.theme ? [i] : []));
    const position = memeTheme.indexOf(courant);
    return memeTheme[(position - 1 + memeTheme.length) % memeTheme.length];
  }
  return courant > 0 ? courant - 1 : null;
}

/* Minuterie d'arrêt */

export type Minuterie = { type: 'duree'; fin: number } | { type: 'fin-morceau' } | null;

/** Cycle du bouton : désactivée → 15 → 30 → 45 → 60 min → fin du morceau → désactivée. */
const CYCLE_MINUTES = [15, 30, 45, 60];

export function minuterieSuivante(m: Minuterie, maintenant: number): Minuterie {
  if (m === null) return { type: 'duree', fin: maintenant + CYCLE_MINUTES[0] * 60_000 };
  if (m.type === 'fin-morceau') return null;
  const restantes = Math.round((m.fin - maintenant) / 60_000);
  const prochaine = CYCLE_MINUTES.find((min) => min > restantes);
  return prochaine ? { type: 'duree', fin: maintenant + prochaine * 60_000 } : { type: 'fin-morceau' };
}

export function libelleMinuterie(m: Minuterie, maintenant: number): string {
  if (m === null) return 'Minuterie';
  if (m.type === 'fin-morceau') return 'Arrêt en fin de morceau';
  const minutes = Math.max(0, Math.ceil((m.fin - maintenant) / 60_000));
  return `Arrêt dans ${minutes} min`;
}

/** Fondu des dernières secondes avant l'arrêt, pour ne pas couper net. */
export const FONDU_SECONDES = 10;
