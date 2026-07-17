import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors, espace, radius } from '@/theme/colors';

type Props = {
  titre: string;
  onPress: () => void;
  chargement?: boolean;
  desactive?: boolean;
  variante?: 'plein' | 'contour';
  couleur?: string;
  style?: ViewStyle;
};

/** Bouton principal réutilisable. */
export function Bouton({
  titre,
  onPress,
  chargement = false,
  desactive = false,
  variante = 'plein',
  couleur = colors.primaire,
  style,
}: Props) {
  const inactif = desactive || chargement;
  const plein = variante === 'plein';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      style={({ pressed }) => [
        styles.base,
        plein
          ? { backgroundColor: couleur }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: couleur },
        (pressed || inactif) && { opacity: 0.6 },
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={plein ? '#fff' : couleur} />
      ) : (
        <Text style={[styles.texte, { color: plein ? '#fff' : couleur }]}>
          {titre}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: espace.lg,
    paddingHorizontal: espace.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  texte: { fontSize: 16, fontWeight: '700' },
});
