import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { config } from '@/lib/config';
import type { Categorie, NumeroSignale } from '@/types';

/**
 * Client Supabase pour le mobile.
 * Utilise AsyncStorage pour persister la session d'auth.
 * `react-native-url-polyfill/auto` est importé dans index.js (requis par supabase-js).
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Normalise un numéro pour la comparaison/stockage (E.164 approximatif). */
export function normaliserNumero(brut: string): string {
  const nettoye = brut.replace(/[^\d+]/g, '');
  // 06 12 34 56 78 -> +33612345678 (heuristique France, ajustable)
  if (/^0\d{9}$/.test(nettoye)) {
    return '+33' + nettoye.slice(1);
  }
  return nettoye;
}

/** Recherche un numéro dans la base communautaire. Retourne null si inconnu. */
export async function chercherNumero(
  numero: string,
): Promise<NumeroSignale | null> {
  const { data, error } = await supabase
    .from('numeros_signales')
    .select('*')
    .eq('numero', normaliserNumero(numero))
    .maybeSingle();

  if (error) throw error;
  return (data as NumeroSignale | null) ?? null;
}

/**
 * Signale un numéro : incrémente le compteur si connu, sinon le crée.
 * S'appuie sur la fonction RPC `signaler_numero` (voir supabase-schema.sql).
 */
export async function signalerNumero(
  numeroBrut: string,
  categorie: Categorie,
): Promise<NumeroSignale> {
  const numero = normaliserNumero(numeroBrut);
  const { data, error } = await supabase.rpc('signaler_numero', {
    p_numero: numero,
    p_categorie: categorie,
  });

  if (error) throw error;
  return data as NumeroSignale;
}

/** Récupère les numéros les plus signalés (pour l'écran Stats). */
export async function numerosLesPlusSignales(
  limite = 20,
): Promise<NumeroSignale[]> {
  const { data, error } = await supabase
    .from('numeros_signales')
    .select('*')
    .order('nb_signalements', { ascending: false })
    .order('score_risque', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data as NumeroSignale[]) ?? [];
}
