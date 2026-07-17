import { NativeModules, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Categorie } from '@/types';

/**
 * Interface avec le module natif iOS `GardeAppelSync`.
 * Si le module n'est pas encore lié (ex. sur Expo Go ou Android), les
 * fonctions échouent proprement sans casser l'app.
 */
type ModuleSync = {
  synchroniser(
    numeros: { numero: number; libelle: string }[],
    expediteurs: { numero: string; categorie: string }[],
  ): Promise<{ ok: boolean }>;
  statutExtension(): Promise<{ statut: 'active' | 'desactive' | 'inconnu' }>;
};

const natif: ModuleSync | undefined = NativeModules.GardeAppelSync;

/** Vrai si le pont natif d'identification d'appel est disponible. */
export const syncDisponible = Platform.OS === 'ios' && natif != null;

/** Convertit un +33... en entier E.164 sans « + » pour le Call Directory. */
function versEntier(numero: string): number | null {
  const chiffres = numero.replace(/[^\d]/g, '');
  const n = Number(chiffres);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Libellé affiché sur l'écran d'appel selon la catégorie. */
function libellePourCategorie(categorie: Categorie): string {
  switch (categorie) {
    case 'arnaque':
    case 'phishing':
      return '⚠️ Arnaque probable';
    case 'demarchage':
      return '📢 Démarchage';
    default:
      return '❓ Numéro signalé';
  }
}

/**
 * Récupère la base communautaire depuis Supabase, l'écrit dans l'App Group
 * et recharge l'extension d'identification d'appel iOS.
 *
 * À appeler au lancement de l'app et périodiquement (ou après un signalement).
 */
export async function synchroniserBaseLocale(): Promise<boolean> {
  if (!syncDisponible || !natif) return false;

  const { data, error } = await supabase
    .from('numeros_signales')
    .select('numero, categorie, score_risque')
    .gte('score_risque', 50) // on ne pousse que les numéros à risque avéré
    .order('numero', { ascending: true })
    .limit(5000);

  if (error) throw error;

  const numeros: { numero: number; libelle: string }[] = [];
  const expediteurs: { numero: string; categorie: string }[] = [];

  for (const ligne of data ?? []) {
    const entier = versEntier(ligne.numero);
    if (entier != null) {
      numeros.push({
        numero: entier,
        libelle: libellePourCategorie(ligne.categorie as Categorie),
      });
    }
    expediteurs.push({ numero: ligne.numero, categorie: ligne.categorie });
  }

  // Le Call Directory exige un tri croissant par numéro.
  numeros.sort((a, b) => a.numero - b.numero);

  await natif.synchroniser(numeros, expediteurs);
  return true;
}

/** Statut d'activation de l'extension dans Réglages iOS. */
export async function statutExtensionAppel(): Promise<
  'active' | 'desactive' | 'inconnu' | 'indisponible'
> {
  if (!syncDisponible || !natif) return 'indisponible';
  const { statut } = await natif.statutExtension();
  return statut;
}
