import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lireHistorique, viderHistorique } from '@/lib/storage';
import {
  colors,
  couleurVerdict,
  emojiVerdict,
  espace,
  libelleVerdict,
  radius,
} from '@/theme/colors';
import type { EntreeHistorique } from '@/types';

/** Écran historique : liste des numéros/SMS consultés. */
export function HistoriqueScreen() {
  const [entrees, setEntrees] = useState<EntreeHistorique[]>([]);

  const recharger = useCallback(() => {
    lireHistorique().then(setEntrees);
  }, []);

  useFocusEffect(recharger);

  async function vider() {
    await viderHistorique();
    setEntrees([]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Historique</Text>
        {entrees.length > 0 && (
          <Pressable onPress={vider} hitSlop={8}>
            <Text style={styles.vider}>Vider</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={entrees}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.liste}
        renderItem={({ item }) => <LigneHistorique entree={item} />}
        ListEmptyComponent={
          <Text style={styles.vide}>
            Aucune consultation pour l'instant. Analysez un numéro depuis
            l'accueil.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

function LigneHistorique({ entree }: { entree: EntreeHistorique }) {
  const couleur = couleurVerdict(entree.resultat.verdict);
  const date = new Date(entree.consulte_le).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneEmoji}>
        {emojiVerdict(entree.resultat.verdict)}
      </Text>
      <View style={styles.ligneCorps}>
        <Text style={styles.ligneValeur} numberOfLines={1}>
          {entree.valeur}
        </Text>
        <Text style={styles.ligneMeta}>
          {entree.type === 'numero' ? 'Numéro' : 'SMS'} · {date}
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: couleur }]}>
        <Text style={[styles.badgeTexte, { color: couleur }]}>
          {libelleVerdict(entree.resultat.verdict)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.fond },
  entete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: espace.xl,
    paddingTop: espace.sm,
    paddingBottom: espace.md,
  },
  titre: { color: colors.texte, fontSize: 28, fontWeight: '800' },
  vider: { color: colors.primaire, fontSize: 15, fontWeight: '600' },
  liste: { paddingHorizontal: espace.xl, paddingBottom: espace.xxl, gap: espace.sm },
  vide: {
    color: colors.texteAttenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: espace.xxl,
    lineHeight: 22,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace.md,
    backgroundColor: colors.fondCarte,
    borderRadius: radius.md,
    padding: espace.lg,
  },
  ligneEmoji: { fontSize: 24 },
  ligneCorps: { flex: 1 },
  ligneValeur: { color: colors.texte, fontSize: 16, fontWeight: '600' },
  ligneMeta: { color: colors.texteAttenue, fontSize: 13, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: espace.sm,
    paddingVertical: espace.xs,
  },
  badgeTexte: { fontSize: 12, fontWeight: '700' },
});
