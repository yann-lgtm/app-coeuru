# Lecteur

Lecteur audio hors ligne pour l'iPhone de Yann : MP3, WAV, M4A, FLAC…, rangés par
thème, lus sans réseau (dans la voiture), écran verrouillé, avec reprise de chaque
morceau là où il avait été arrêté.

## D'où viennent les morceaux

- **Synchro avec le Mac** (bouton « ⟳ Mac ») : l'app copie, par le Wi-Fi, les
  morceaux du dossier **« Musique pour iPhone »** du Bureau qui ne sont pas encore
  sur le téléphone. Un sous-dossier = un thème dans l'app. Les sous-dossiers peuvent
  être des alias vers un disque externe (ex. `Mental Waves/MP3` sur le WD16T-I).
- **Bouton « ＋ »** : choisir des fichiers dans l'app Fichiers de l'iPhone.
- **AirDrop** (« Ouvrir avec Lecteur ») et glisser-déposer depuis le Finder
  (onglet Fichiers de l'iPhone) une fois l'app installée pour de bon.

Un appui long sur un morceau le retire du téléphone.

## Lancer la synchro sur le Mac

Le petit serveur démarre tout seul à l'ouverture de session du Mac et
redémarre s'il s'arrête (lancement automatique
`~/Library/LaunchAgents/com.coeuru.lecteur-synchro.plist`, journal dans
`~/Library/Logs/lecteur-synchro.log`). Rien à faire au quotidien.

Si l'app dit « Mac introuvable », vérifier qu'il tourne :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://Yann-Coeuru.local:8090/morceaux
```

`200` = il tourne. Sinon, le relancer :

```bash
launchctl kickstart -k gui/$(id -u)/com.coeuru.lecteur-synchro
```

Pour le lancer à la main, sans le lancement automatique :

```bash
cd ~/Desktop/app-coeuru-lecteur/lecteur && node serveur-mac/serveur.mjs
```

Il affiche l'adresse du Mac à saisir dans l'app (appui long sur « ⟳ Mac ») si
`Yann-Coeuru.local` ne répond pas.

## Essai avec Expo Go (le Mac doit rester allumé, même Wi-Fi)

```bash
cd ~/Desktop/app-coeuru-lecteur/lecteur && npx expo start --go --offline --port 8082
```

## Installation pour de bon

Fabriquée dans le cloud par EAS (pas besoin de Xcode), avec le compte développeur
Apple de Yann. Voir `eas.json`.
