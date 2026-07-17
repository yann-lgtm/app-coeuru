import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabaseConfigure } from '@/lib/config';
import { syncDisponible, synchroniserBaseLocale } from '@/lib/sync';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  // Au lancement : on pousse la base communautaire vers les extensions iOS
  // (identification des appels entrants) si le pont natif est disponible.
  useEffect(() => {
    if (supabaseConfigure && syncDisponible) {
      synchroniserBaseLocale().catch((e) =>
        console.warn('Synchronisation de la base locale échouée :', e),
      );
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
