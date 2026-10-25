import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Bibliothèques personnalisées (« Voiture », « Dormir »…) : de simples listes
 * de noms de morceaux, gardées sur l'iPhone. Un morceau peut figurer dans
 * plusieurs bibliothèques sans être copié ; supprimer une bibliothèque
 * n'efface jamais de fichier.
 */

export type Bibliotheque = { id: string; nom: string; morceaux: string[] };

const CLE = 'bibliotheques';

export async function lireBibliotheques(): Promise<Bibliotheque[]> {
  const brut = await AsyncStorage.getItem(CLE);
  return brut ? JSON.parse(brut) : [];
}

async function enregistrer(liste: Bibliotheque[]): Promise<Bibliotheque[]> {
  await AsyncStorage.setItem(CLE, JSON.stringify(liste));
  return liste;
}

export async function creerBibliotheque(nom: string): Promise<{ liste: Bibliotheque[]; creee: Bibliotheque }> {
  const creee: Bibliotheque = { id: `${Date.now()}`, nom: nom.trim(), morceaux: [] };
  const liste = await enregistrer([...(await lireBibliotheques()), creee]);
  return { liste, creee };
}

export async function renommerBibliotheque(id: string, nom: string): Promise<Bibliotheque[]> {
  const liste = await lireBibliotheques();
  return enregistrer(liste.map((b) => (b.id === id ? { ...b, nom: nom.trim() } : b)));
}

export async function supprimerBibliotheque(id: string): Promise<Bibliotheque[]> {
  return enregistrer((await lireBibliotheques()).filter((b) => b.id !== id));
}

/** Ajoute à la fin de la bibliothèque ; sans effet si le morceau y est déjà. */
export async function ajouterABibliotheque(id: string, morceau: string): Promise<Bibliotheque[]> {
  const liste = await lireBibliotheques();
  return enregistrer(
    liste.map((b) => (b.id === id && !b.morceaux.includes(morceau) ? { ...b, morceaux: [...b.morceaux, morceau] } : b)),
  );
}

export async function retirerDeBibliotheque(id: string, morceau: string): Promise<Bibliotheque[]> {
  const liste = await lireBibliotheques();
  return enregistrer(liste.map((b) => (b.id === id ? { ...b, morceaux: b.morceaux.filter((m) => m !== morceau) } : b)));
}

/** Un morceau effacé de l'iPhone disparaît de toutes les bibliothèques. */
export async function oublierMorceau(morceau: string): Promise<Bibliotheque[]> {
  const liste = await lireBibliotheques();
  return enregistrer(liste.map((b) => ({ ...b, morceaux: b.morceaux.filter((m) => m !== morceau) })));
}
