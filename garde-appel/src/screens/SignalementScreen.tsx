import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bouton } from '@/components/Bouton';
import { supabaseConfigure } from '@/lib/config';
import { signalerNumero } from '@/lib/supabase';
import { colors, espace, libelleCategorie, radius } from '@/theme/colors';
import type { Categorie } from '@/types';

const CATEGORIES: Exclude<Categorie, 'inconnu'>[] = [
  'arnaque',
  'demarchage',
  'phishing',
];

/** Écran de signalement d'un numéro avec catégorie. */
export function SignalementScreen() {
  const [numero, setNumero] = useState('');
  const [categorie, setCategorie] = useState<Categorie>('arnaque');
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    const propre = numero.trim();
    if (!propre) return;

    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      const r = await signalerNumero(propre, categorie);
      setMessage(
        `Merci ! Ce numéro totalise désormais ${r.nb_signalements} signalement${r.nb_signalements > 1 ? 's' : ''}.`,
      );
      setNumero('');
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : 'Le signalement a échoué. Réessayez.',
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
          <Text style={styles.titre}>Signaler un numéro</Text>
          <Text style={styles.sousTitre}>
            Aidez la communauté en signalant les numéros indésirables.
          </Text>

          {!supabaseConfigure && (
            <View style={styles.banniere}>
              <Text style={styles.banniereTexte}>
                Configurez Supabase (.env) pour activer le signalement.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Numéro</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex. 06 12 34 56 78"
            placeholderTextColor={colors.texteFaible}
            value={numero}
            onChangeText={setNumero}
            keyboardType="phone-pad"
            autoCorrect={false}
          />

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((c) => {
              const actif = categorie === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategorie(c)}
                  style={[styles.categorie, actif && styles.categorieActive]}
                >
                  <Text
                    style={[
                      styles.categorieTexte,
                      actif && styles.categorieTexteActif,
                    ]}
                  >
                    {libelleCategorie(c)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Bouton
            titre="Envoyer le signalement"
            onPress={envoyer}
            chargement={chargement}
            desactive={!numero.trim() || !supabaseConfigure}
            style={{ marginTop: espace.md }}
          />

          {message && <Text style={styles.succes}>{message}</Text>}
          {erreur && <Text style={styles.erreur}>{erreur}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.fond },
  flex: { flex: 1 },
  contenu: { padding: espace.xl, gap: espace.md },
  titre: { color: colors.texte, fontSize: 28, fontWeight: '800' },
  sousTitre: {
    color: colors.texteAttenue,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: espace.sm,
  },
  banniere: {
    backgroundColor: colors.suspectFond,
    borderColor: colors.suspect,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: espace.md,
  },
  banniereTexte: { color: colors.texte, fontSize: 13, lineHeight: 19 },
  label: {
    color: colors.texteAttenue,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: espace.sm,
  },
  champ: {
    backgroundColor: colors.fondCarte,
    borderColor: colors.bordure,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: espace.lg,
    color: colors.texte,
    fontSize: 18,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.sm },
  categorie: {
    borderWidth: 1,
    borderColor: colors.bordure,
    borderRadius: radius.md,
    paddingVertical: espace.md,
    paddingHorizontal: espace.lg,
    backgroundColor: colors.fondCarte,
  },
  categorieActive: {
    borderColor: colors.primaire,
    backgroundColor: colors.primaireFonce,
  },
  categorieTexte: { color: colors.texteAttenue, fontWeight: '700' },
  categorieTexteActif: { color: '#fff' },
  succes: { color: colors.sur, fontSize: 14, lineHeight: 20 },
  erreur: { color: colors.arnaque, fontSize: 14, lineHeight: 20 },
});
