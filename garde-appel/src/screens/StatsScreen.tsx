import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarreScore } from '@/components/BarreScore';
import { supabaseConfigure } from '@/lib/config';
import { numerosLesPlusSignales } from '@/lib/supabase';
import {
  colors,
  couleurVerdict,
  espace,
  libelleCategorie,
  radius,
} from '@/theme/colors';
import { verdictDepuisScore } from '@/services/analyse';
import type { NumeroSignale } from '@/types';

/** Écran stats : numéros les plus signalés par la communauté. */
export function StatsScreen() {
  const [numeros, setNumeros] = useState<NumeroSignale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(() => {
    if (!supabaseConfigure) {
      setChargement(false);
      return;
    }
    setChargement(true);
    numerosLesPlusSignales(30)
      .then((r) => {
        setNumeros(r);
        setErreur(null);
      })
      .catch((e: unknown) =>
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.'),
      )
      .finally(() => setChargement(false));
  }, []);

  useFocusEffect(recharger);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.titre}>Numéros les plus signalés</Text>

      {!supabaseConfigure ? (
        <Text style={styles.vide}>
          Configurez Supabase (.env) pour afficher les statistiques.
        </Text>
      ) : chargement ? (
        <ActivityIndicator color={colors.primaire} style={{ marginTop: espace.xxl }} />
      ) : erreur ? (
        <Text style={styles.erreur}>{erreur}</Text>
      ) : (
        <FlatList
          data={numeros}
          keyExtractor={(n) => n.numero}
          contentContainerStyle={styles.liste}
          renderItem={({ item, index }) => (
            <LigneStat numero={item} rang={index + 1} />
          )}
          ListEmptyComponent={
            <Text style={styles.vide}>
              Aucun numéro signalé pour l'instant.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function LigneStat({ numero, rang }: { numero: NumeroSignale; rang: number }) {
  const couleur = couleurVerdict(verdictDepuisScore(numero.score_risque));

  return (
    <View style={styles.ligne}>
      <Text style={styles.rang}>#{rang}</Text>
      <View style={styles.corps}>
        <View style={styles.enteteLigne}>
          <Text style={styles.numero}>{numero.numero}</Text>
          <Text style={styles.compte}>
            {numero.nb_signalements} signalement
            {numero.nb_signalements > 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.categorie}>
          {libelleCategorie(numero.categorie)}
        </Text>
        <BarreScore score={numero.score_risque} couleur={couleur} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.fond },
  titre: {
    color: colors.texte,
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: espace.xl,
    paddingTop: espace.sm,
    paddingBottom: espace.md,
  },
  liste: { paddingHorizontal: espace.xl, paddingBottom: espace.xxl, gap: espace.md },
  ligne: {
    flexDirection: 'row',
    gap: espace.md,
    backgroundColor: colors.fondCarte,
    borderRadius: radius.md,
    padding: espace.lg,
  },
  rang: {
    color: colors.texteFaible,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 36,
  },
  corps: { flex: 1, gap: espace.sm },
  enteteLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numero: { color: colors.texte, fontSize: 16, fontWeight: '700' },
  compte: { color: colors.texteAttenue, fontSize: 13 },
  categorie: { color: colors.texteAttenue, fontSize: 13, marginTop: -espace.xs },
  vide: {
    color: colors.texteAttenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: espace.xxl,
    paddingHorizontal: espace.xl,
    lineHeight: 22,
  },
  erreur: {
    color: colors.arnaque,
    fontSize: 14,
    textAlign: 'center',
    marginTop: espace.xxl,
    paddingHorizontal: espace.xl,
  },
});
