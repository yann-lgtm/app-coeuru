import Constants from 'expo-constants';

/**
 * Accès centralisé à la configuration injectée via app.config.ts -> expo.extra.
 */
type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  appGroup?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  appGroup: extra.appGroup ?? 'group.com.coeuru.gardeappel',
};

/** Vrai si les clés Supabase sont bien configurées. */
export const supabaseConfigure =
  config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
