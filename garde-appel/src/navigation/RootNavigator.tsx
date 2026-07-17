import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { Text } from 'react-native';

import { AnalyseScreen } from '@/screens/AnalyseScreen';
import { HistoriqueScreen } from '@/screens/HistoriqueScreen';
import { SignalementScreen } from '@/screens/SignalementScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { colors } from '@/theme/colors';

const Tab = createBottomTabNavigator();

/** Icône d'onglet en emoji (évite une dépendance d'icônes native). */
function IconeOnglet({ emoji, focus }: { emoji: string; focus: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focus ? 1 : 0.5 }}>{emoji}</Text>;
}

const themeNav = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.fond,
    card: colors.fondCarte,
    border: colors.bordure,
    primary: colors.primaire,
    text: colors.texte,
  },
};

/** Navigation racine par onglets. */
export function RootNavigator() {
  return (
    <NavigationContainer theme={themeNav}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primaire,
          tabBarInactiveTintColor: colors.texteFaible,
          tabBarStyle: {
            backgroundColor: colors.fondCarte,
            borderTopColor: colors.bordure,
          },
        }}
      >
        <Tab.Screen
          name="Analyse"
          component={AnalyseScreen}
          options={{
            tabBarLabel: 'Analyser',
            tabBarIcon: ({ focused }) => (
              <IconeOnglet emoji="🔎" focus={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Historique"
          component={HistoriqueScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <IconeOnglet emoji="🕘" focus={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Signaler"
          component={SignalementScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <IconeOnglet emoji="🚩" focus={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <IconeOnglet emoji="📊" focus={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
