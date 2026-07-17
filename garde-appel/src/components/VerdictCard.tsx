import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarreScore } from '@/components/BarreScore';
import {
  colors,
  couleurVerdict,
  emojiVerdict,
  espace,
  fondVerdict,
  libelleCategorie,
  libelleVerdict,
  radius,
} from '@/theme/colors';
import type { ResultatAnalyse } from '@/types';

/** Carte affichant le verdict d'une analyse. */
export function VerdictCard({ resultat }: { resultat: ResultatAnalyse }) {
  const couleur = couleurVerdict(resultat.verdict);

  return (
    <View
      style={[
        styles.carte,
        { backgroundColor: fondVerdict(resultat.verdict), borderColor: couleur },
      ]}
    >
      <View style={styles.entete}>
        <Text style={styles.emoji}>{emojiVerdict(resultat.verdict)}</Text>
        <View style={styles.enteteTexte}>
          <Text style={[styles.verdict, { color: couleur }]}>
            {libelleVerdict(resultat.verdict)}
          </Text>
          <Text style={styles.sousTitre}>
            {libelleCategorie(resultat.categorie)}
            {resultat.source === 'base'
              ? ` · ${resultat.nb_signalements} signalement${resultat.nb_signalements > 1 ? 's' : ''}`
              : ' · analyse IA'}
          </Text>
        </View>
      </View>

      <BarreScore score={resultat.score_risque} couleur={couleur} />

      <Text style={styles.explication}>{resultat.explication}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: espace.xl,
    gap: espace.lg,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace.md,
  },
  emoji: { fontSize: 40 },
  enteteTexte: { flex: 1 },
  verdict: { fontSize: 26, fontWeight: '800' },
  sousTitre: { color: colors.texteAttenue, fontSize: 14, marginTop: 2 },
  explication: {
    color: colors.texte,
    fontSize: 15,
    lineHeight: 22,
  },
});
