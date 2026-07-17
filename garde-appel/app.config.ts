import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.config.ts complète app.json en injectant les variables d'environnement
 * dans `expo.extra` au moment du build. Voir .env.example pour les variables.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    appGroup:
      process.env.EXPO_PUBLIC_APP_GROUP ?? 'group.com.coeuru.gardeappel',
  },
});
