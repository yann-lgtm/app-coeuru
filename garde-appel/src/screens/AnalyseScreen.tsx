import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { VerdictCard } from '@/components/VerdictCard';
import { supabaseConfigure } from '@/lib/config';
import { analyser, ressembleAUnNumero } from '@/services/analyse';
import { colors, espace, radius } from '@/theme/colors';
import type { ResultatAnalyse, TypeAnalyse } from '@/types';

/** Écran d'accueil : saisie d'un numéro ou d'un SMS -> analyse -> verdict. */
export function AnalyseScreen() {
  const [valeur, setValeur] = useState('');
  const [type, setType] = useState<TypeAnalyse>('numero');
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<ResultatAnalyse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancerAnalyse() {
    const propre = valeur.trim();
    if (!propre) return;

    setChargement(true);
    setErreur(null);
    setResultat(null);
    try {
      const typeEffectif: TypeAnalyse =
        type === 'numero' && !ressembleAUnNumero(propre) ? 'sms' : type;
      const r = await analyser(propre, typeEffectif);
      setResultat(r);
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : "L'analyse a échoué. Réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.contenu}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titre}>GardeAppel</Text>
          <Text style={styles.sousTitre}>
            Vérifiez un numéro ou un SMS suspect avant de répondre.
          </Text>

          {!supabaseConfigure && (
            <View style={styles.banniere}>
              <Text style={styles.banniereTexte}>
                Supabase n'est pas encore configuré. Renseignez vos clés dans
                le fichier .env pour activer la base communautaire.
              </Text>
            </View>
          )}

          <View style={styles.selecteur}>
            <Onglet
              actif={type === 'numero'}
              titre="Numéro"
              onPress={() => setType('numero')}
            />
            <Onglet
              actif={type === 'sms'}
              titre="SMS"
              onPress={() => setType('sms')}
            />
          </View>

          <TextInput
            style={[styles.champ, type === 'sms' && styles.champMulti]}
            placeholder={
              type === 'numero'
                ? 'Ex. 06 12 34 56 78'
                : 'Collez ici le contenu du SMS suspect…'
            }
            placeholderTextColor={colors.texteFaible}
            value={valeur}
            onChangeText={setValeur}
            keyboardType={type === 'numero' ? 'phone-pad' : 'default'}
            multiline={type === 'sms'}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Bouton
            titre="Analyser"
            onPress={lancerAnalyse}
            chargement={chargement}
            desactive={!valeur.trim()}
          />

          {erreur && <Text style={styles.erreur}>{erreur}</Text>}

          {resultat && (
            <View style={styles.resultat}>
              <VerdictCard resultat={resultat} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Onglet({
  actif,
  titre,
  onPress,
}: {
  actif: boolean;
  titre: string;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[styles.onglet, actif && styles.ongletActif]}
    >
      {titre}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.fond },
  flex: { flex: 1 },
  contenu: { padding: espace.xl, gap: espace.lg },
  titre: { color: colors.texte, fontSize: 32, fontWeight: '800' },
  sousTitre: {
    color: colors.texteAttenue,
    fontSize: 15,
    lineHeight: 21,
    marginTop: -espace.sm,
  },
  banniere: {
    backgroundColor: colors.suspectFond,
    borderColor: colors.suspect,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: espace.md,
  },
  banniereTexte: { color: colors.texte, fontSize: 13, lineHeight: 19 },
  selecteur: {
    flexDirection: 'row',
    backgroundColor: colors.fondCarte,
    borderRadius: radius.md,
    padding: espace.xs,
    gap: espace.xs,
  },
  onglet: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: espace.md,
    borderRadius: radius.sm,
    color: colors.texteAttenue,
    fontWeight: '700',
    overflow: 'hidden',
  },
  ongletActif: { backgroundColor: colors.primaire, color: '#fff' },
  champ: {
    backgroundColor: colors.fondCarte,
    borderColor: colors.bordure,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: espace.lg,
    color: colors.texte,
    fontSize: 18,
  },
  champMulti: { minHeight: 120, textAlignVertical: 'top', fontSize: 15 },
  erreur: { color: colors.arnaque, fontSize: 14 },
  resultat: { marginTop: espace.sm },
});
