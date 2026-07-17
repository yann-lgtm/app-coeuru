import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, espace, radius } from '@/theme/colors';

/** Barre de progression représentant un score de risque 0-100. */
export function BarreScore({
  score,
  couleur,
}: {
  score: number;
  couleur: string;
}) {
  const largeur = Math.max(0, Math.min(100, score));

  return (
    <View style={styles.conteneur}>
      <View style={styles.ligneTexte}>
        <Text style={styles.libelle}>Score de risque</Text>
        <Text style={[styles.valeur, { color: couleur }]}>{largeur}/100</Text>
      </View>
      <View style={styles.piste}>
        <View
          style={[styles.remplissage, { width: `${largeur}%`, backgroundColor: couleur }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { gap: espace.sm },
  ligneTexte: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libelle: { color: colors.texteAttenue, fontSize: 13 },
  valeur: { fontSize: 14, fontWeight: '700' },
  piste: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bordure,
    overflow: 'hidden',
  },
  remplissage: { height: '100%', borderRadius: radius.sm },
});
