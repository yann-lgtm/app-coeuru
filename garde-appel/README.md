# GardeAppel 🛡️

Application iOS (React Native + Expo, workflow *bare*) de **détection et
signalement de numéros frauduleux**. Analyse un numéro ou un SMS suspect,
rend un verdict (**Sûr / Suspect / Arnaque**), s'appuie sur une base
communautaire Supabase et l'IA Anthropic, et affiche un avertissement
directement sur l'écran d'appel entrant iOS grâce à une extension CallKit.

---

## Sommaire

- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Configuration Supabase](#configuration-supabase)
- [Configuration de l'IA (Edge Function)](#configuration-de-lia-edge-function)
- [Extensions iOS (CallKit + IdentityLookup)](#extensions-ios-callkit--identitylookup)
- [Architecture de l'analyse](#architecture-de-lanalyse)

---

## Stack technique

| Domaine | Choix |
|---|---|
| Framework | React Native `0.76` via Expo SDK `52` (bare workflow, dev-client) |
| Langage | TypeScript (strict) |
| Navigation | React Navigation (onglets) |
| Base de données + Auth | Supabase (`@supabase/supabase-js`) |
| Analyse IA | API Anthropic via **Edge Function Supabase** (clé côté serveur) |
| Extensions iOS | CallKit (`CXCallDirectoryProvider`) + IdentityLookup (`ILMessageFilterExtension`) |

## Structure du projet

```
garde-appel/
├── App.tsx                      # Point d'entrée : providers + sync au lancement
├── app.config.ts                # Injecte les variables d'env dans expo.extra
├── app.json                     # Config Expo (bundle id, App Group, entitlements)
├── src/
│   ├── navigation/RootNavigator.tsx
│   ├── screens/
│   │   ├── AnalyseScreen.tsx     # Accueil : saisie -> analyse -> verdict
│   │   ├── HistoriqueScreen.tsx  # Numéros/SMS consultés (stockage local)
│   │   ├── SignalementScreen.tsx # Signaler un numéro + catégorie
│   │   └── StatsScreen.tsx       # Numéros les plus signalés
│   ├── lib/
│   │   ├── config.ts             # Lecture de la config (expo.extra)
│   │   ├── supabase.ts           # Client + requêtes (recherche, signalement, stats)
│   │   ├── anthropic.ts          # Appel de l'Edge Function d'analyse IA
│   │   ├── storage.ts            # Historique local (AsyncStorage)
│   │   └── sync.ts               # Pont vers le module natif iOS
│   ├── services/analyse.ts       # Orchestration base -> IA -> historique
│   ├── components/               # VerdictCard, BarreScore, Bouton
│   ├── theme/colors.ts           # Palette + helpers verdict/catégorie
│   └── types/index.ts            # Types partagés
├── ios/
│   ├── GardeAppelCallDirectory/  # Extension identification d'appel (CallKit)
│   ├── GardeAppelMessageFilter/  # Extension filtrage SMS (IdentityLookup)
│   └── GardeAppelSync/           # Module natif RN (écrit App Group + reload)
├── supabase/functions/analyser-numero/  # Edge Function (Anthropic)
└── supabase-schema.sql           # Table + RPC + RLS
```

## Fonctionnalités

- **Écran d'analyse** — saisie d'un numéro ou d'un SMS, verdict coloré, score
  de risque 0-100 et explication.
- **Historique** — consultations récentes stockées localement (AsyncStorage).
- **Signalement** — signaler un numéro avec catégorie (*arnaque*, *démarchage*,
  *phishing*), agrégé dans Supabase via une fonction RPC sécurisée.
- **Stats** — classement des numéros les plus signalés par la communauté.
- **Identification à l'appel (iOS)** — l'extension CallKit affiche
  « ⚠️ Arnaque probable » ou « 📢 Démarchage » sur l'appel entrant, **même
  app fermée**.
- **Filtrage SMS (iOS)** — l'extension IdentityLookup route les SMS d'expéditeurs
  signalés vers l'onglet « Indésirables ».

## Installation

> Prérequis : Node 18+, un Mac avec Xcode 15+, un compte Apple Developer
> (les extensions CallKit/IdentityLookup et les App Groups exigent la
> signature avec un vrai profil).

```bash
cd garde-appel
npm install

# Variables d'environnement
cp .env.example .env
# … renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY

# Génère les assets placeholder (icône, splash) — non versionnés
npm run assets

# Génère les projets natifs ios/ et android/
npx expo prebuild

# Lance sur iOS (simulateur ou appareil)
npx expo run:ios
```

> ⚠️ Les extensions iOS et le module natif `GardeAppelSync` doivent être
> ajoutés au projet Xcode **après** `expo prebuild` (voir plus bas). Le
> simulateur iOS **ne teste pas** l'identification d'appel réelle : il faut un
> appareil physique.

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Exécuter [`supabase-schema.sql`](./supabase-schema.sql) dans le SQL Editor
   (table `numeros_signales`, fonction RPC `signaler_numero`, RLS).
3. Copier l'URL du projet et la clé **anon** dans `.env` :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

La table `numeros_signales` suit exactement le schéma demandé :

| Colonne | Type | Rôle |
|---|---|---|
| `numero` | `text` (PK) | numéro normalisé E.164 |
| `categorie` | enum | `arnaque` \| `demarchage` \| `phishing` \| `inconnu` |
| `nb_signalements` | `int` | compteur communautaire |
| `score_risque` | `int` 0-100 | risque agrégé |
| `derniere_activite` | `timestamptz` | dernier signalement |

## Configuration de l'IA (Edge Function)

La clé Anthropic **ne doit jamais** se trouver dans l'app mobile (elle serait
extractible du binaire). Elle vit côté serveur, dans l'Edge Function.

```bash
# Depuis la racine du projet (CLI Supabase installée + `supabase login`)
supabase functions deploy analyser-numero
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

L'app appelle `POST {SUPABASE_URL}/functions/v1/analyser-numero` avec
`{ valeur, type }` et reçoit `{ verdict, score_risque, categorie, explication }`.

## Extensions iOS (CallKit + IdentityLookup)

Expo `prebuild` ne crée pas automatiquement les *targets* d'extension. Après
`npx expo prebuild`, dans **Xcode** (`ios/GardeAppel.xcworkspace`) :

### 1. App Group (partage app ↔ extensions)
- Cible principale → *Signing & Capabilities* → **+ App Groups** →
  `group.com.coeuru.gardeappel` (déjà déclaré dans `app.json`).

### 2. Extension d'identification d'appel (CallKit)
- *File → New → Target… → Call Directory Extension*, nom **GardeAppelCallDirectory**,
  bundle id `com.coeuru.gardeappel.CallDirectory`.
- Remplacer le code généré par
  [`ios/GardeAppelCallDirectory/CallDirectoryHandler.swift`](./ios/GardeAppelCallDirectory/CallDirectoryHandler.swift).
- Ajouter la capability **App Groups** à cette cible (même groupe).

### 3. Extension de filtrage SMS (IdentityLookup)
- *File → New → Target… → Message Filter Extension*, nom **GardeAppelMessageFilter**,
  bundle id `com.coeuru.gardeappel.MessageFilter`.
- Remplacer le code par
  [`ios/GardeAppelMessageFilter/MessageFilterExtension.swift`](./ios/GardeAppelMessageFilter/MessageFilterExtension.swift).
- Ajouter la capability **App Groups**.

### 4. Module natif de synchronisation
- Ajouter `ios/GardeAppelSync/GardeAppelSync.swift` et `GardeAppelSync.m` à la
  **cible principale**. Xcode proposera de créer un *bridging header* : accepter.

### Fonctionnement
iOS interdit tout appel réseau au moment d'un appel entrant. Le flux est donc :

```
Supabase ──(app, au lancement)──► sync.ts ──► GardeAppelSync (natif)
   │                                              │
   │                            écrit numeros.json / expediteurs.json
   │                                    dans l'App Group partagé
   ▼                                              ▼
                     CXCallDirectoryManager.reloadExtension
                                    │
                    ┌──────────────┴───────────────┐
      CallDirectoryHandler (appels)     MessageFilterExtension (SMS)
      lit numeros.json, pose les        lit expediteurs.json, route
      libellés d'identification         les SMS vers « Indésirables »
```

L'utilisateur doit activer l'extension dans **Réglages → Téléphone →
Blocage d'appels et identification** (et **Réglages → Messages → SMS
inconnus et indésirables** pour le filtrage SMS).

## Architecture de l'analyse

`src/services/analyse.ts` orchestre la décision :

1. **Numéro** → recherche d'abord dans la **base communautaire Supabase**
   (rapide, fiable). Si connu et déjà signalé → verdict issu de la base.
2. **Inconnu** ou **SMS** → appel à l'**IA** (Edge Function Anthropic) pour un
   verdict + explication.
3. Le résultat est enregistré dans l'**historique local**.

Le mapping score → verdict : `< 35` = Sûr, `35-69` = Suspect, `≥ 70` = Arnaque.
