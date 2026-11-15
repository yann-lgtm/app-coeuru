/*
 * Règles de lecture : quel morceau vient après, selon la répétition et le
 * hasard. Pur calcul, sans état : l'écran décide quand l'appeler.
 *
 * Tout se raisonne sur des noms de morceaux et deux listes :
 * - `ordre` : la liste dans laquelle on avance (toute la bibliothèque de
 *   l'iPhone, ou une bibliothèque personnalisée) ;
 * - `groupe` : ce qu'on répète ou mélange (le thème du morceau quand on lit
 *   « Tout », la bibliothèque entière sinon).
 */

export type Repetition = 'non' | 'morceau' | 'groupe';

export function libelleRepetition(r: Repetition, groupe: 'theme' | 'bibliotheque'): string {
  if (r === 'non') return 'Pas de répétition';
  if (r === 'morceau') return 'Répète ce morceau';
  return groupe === 'theme' ? 'Répète le thème' : 'Répète la bibliothèque';
}

export function repetitionSuivante(r: Repetition): Repetition {
  return r === 'non' ? 'morceau' : r === 'morceau' ? 'groupe' : 'non';
}

/**
 * Morceau suivant, ou null s'il faut s'arrêter.
 * - au hasard : un autre morceau du groupe ;
 * - « répète le groupe » : le suivant du groupe, puis retour au premier ;
 * - sinon : le suivant dans l'ordre, arrêt au dernier.
 */
export function morceauSuivant(
  ordre: string[],
  groupe: string[],
  courant: string,
  repetition: Repetition,
  aleatoire: boolean,
): string | null {
  if (aleatoire) {
    const autres = groupe.filter((nom) => nom !== courant);
    if (autres.length === 0) return repetition === 'non' ? null : courant;
    return autres[Math.floor(Math.random() * autres.length)];
  }
  if (repetition === 'groupe' && groupe.length > 0) {
    const position = groupe.indexOf(courant);
    return groupe[(position + 1) % groupe.length];
  }
  const position = ordre.indexOf(courant);
  return position !== -1 && position + 1 < ordre.length ? ordre[position + 1] : null;
}

/** Morceau précédent (même logique), ou null. */
export function morceauPrecedent(ordre: string[], groupe: string[], courant: string, repetition: Repetition): string | null {
  if (repetition === 'groupe' && groupe.length > 0) {
    const position = groupe.indexOf(courant);
    return groupe[(position - 1 + groupe.length) % groupe.length];
  }
  const position = ordre.indexOf(courant);
  return position > 0 ? ordre[position - 1] : null;
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
