import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EntreeHistorique, ResultatAnalyse, TypeAnalyse } from '@/types';

const CLE_HISTORIQUE = 'gardeappel:historique:v1';
const MAX_ENTREES = 100;

/** Identifiant simple sans dépendance externe. */
function genererId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lit l'historique local des consultations (plus récent en premier). */
export async function lireHistorique(): Promise<EntreeHistorique[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_HISTORIQUE);
    if (!brut) return [];
    return JSON.parse(brut) as EntreeHistorique[];
  } catch {
    return [];
  }
}

/** Ajoute une consultation en tête de l'historique. */
export async function ajouterHistorique(
  valeur: string,
  type: TypeAnalyse,
  resultat: ResultatAnalyse,
): Promise<EntreeHistorique> {
  const entree: EntreeHistorique = {
    id: genererId(),
    valeur,
    type,
    resultat,
    consulte_le: new Date().toISOString(),
  };

  const actuel = await lireHistorique();
  const nouveau = [entree, ...actuel].slice(0, MAX_ENTREES);
  await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(nouveau));
  return entree;
}

/** Vide l'historique local. */
export async function viderHistorique(): Promise<void> {
  await AsyncStorage.removeItem(CLE_HISTORIQUE);
}
