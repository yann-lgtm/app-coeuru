import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  Morceau,
  enregistrerAdresseMac,
  enregistrerPosition,
  importerDepuisFichiers,
  lireAdresseMac,
  lirePositions,
  listerMorceaux,
  supprimerMorceau,
  synchroniserAvecMac,
} from './src/bibliotheque';

const SAUT_SECONDES = 30;
const ADRESSE_MAC_PAR_DEFAUT = 'Yann-Coeuru.local';

function duree(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Lecteur />
    </SafeAreaProvider>
  );
}

function Lecteur() {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const [morceaux, setMorceaux] = useState<Morceau[]>([]);
  // On retient le morceau par son nom (et pas par sa place dans la liste) :
  // une synchro qui ajoute des morceaux pendant la lecture décale les places.
  const [nomCourant, setNomCourant] = useState<string | null>(null);
  const indexCourant = nomCourant === null ? -1 : morceaux.findIndex((m) => m.nom === nomCourant);
  const courant = indexCourant === -1 ? null : indexCourant;
  const positions = useRef<Record<string, number>>({});
  const repriseEnAttente = useRef<number | null>(null);

  const recharger = useCallback(() => {
    try {
      setMorceaux(listerMorceaux());
    } catch (e) {
      Alert.alert('Lecture du dossier impossible', String(e));
    }
  }, []);

  // Son en arrière-plan, écran verrouillé, et même si l'iPhone est sur silencieux.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    lirePositions().then((p) => (positions.current = p));
    recharger();
  }, [recharger]);

  // Des fichiers ont pu arriver par AirDrop ou par l'app Fichiers pendant que l'app était fermée.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') recharger();
    });
    return () => abonnement.remove();
  }, [recharger]);

  const morceauCourant = courant !== null ? morceaux[courant] : undefined;

  const sections = useMemo(() => {
    const parTheme = new Map<string, Morceau[]>();
    for (const m of morceaux) parTheme.set(m.theme, [...(parTheme.get(m.theme) ?? []), m]);
    return [...parTheme].map(([title, data]) => ({ title, data }));
  }, [morceaux]);

  const memoriser = useCallback((nom: string, secondes: number) => {
    positions.current[nom] = secondes;
    enregistrerPosition(nom, secondes);
  }, []);

  const lancer = useCallback(
    (index: number) => {
      const morceau = morceaux[index];
      if (!morceau) return;
      if (morceauCourant) memoriser(morceauCourant.nom, player.currentTime);

      player.replace({ uri: morceau.uri });
      repriseEnAttente.current = positions.current[morceau.nom] ?? null;
      player.play();
      player.setActiveForLockScreen(
        true,
        { title: morceau.titre, artist: morceau.format },
        { showSeekForward: true, showSeekBackward: true },
      );
      setNomCourant(morceau.nom);
    },
    [morceaux, morceauCourant, memoriser, player],
  );

  // Reprise là où on s'était arrêté, une fois le fichier chargé.
  useEffect(() => {
    const reprise = repriseEnAttente.current;
    if (!status.isLoaded || reprise === null) return;
    repriseEnAttente.current = null;
    if (reprise > 5 && reprise < status.duration - 10) player.seekTo(reprise);
  }, [status.isLoaded, status.duration, player]);

  // Sauvegarde régulière de la position, pour reprendre même après un arrêt brutal.
  const tranche = Math.floor(status.currentTime / 5);
  useEffect(() => {
    if (morceauCourant && status.playing && tranche > 0) {
      memoriser(morceauCourant.nom, status.currentTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tranche]);

  // Fin du morceau : on repart du début la prochaine fois, et on enchaîne.
  useEffect(() => {
    if (!status.didJustFinish || courant === null || !morceauCourant) return;
    memoriser(morceauCourant.nom, 0);
    if (courant + 1 < morceaux.length) lancer(courant + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const lectureOuPause = () => {
    if (courant === null) {
      if (morceaux.length > 0) lancer(0);
      return;
    }
    if (status.playing) {
      player.pause();
      if (morceauCourant) memoriser(morceauCourant.nom, status.currentTime);
    } else {
      player.play();
    }
  };

  const sauter = (secondes: number) => {
    const cible = Math.min(Math.max(0, status.currentTime + secondes), status.duration || 0);
    player.seekTo(cible);
  };

  const ajouter = async () => {
    try {
      const n = await importerDepuisFichiers();
      if (n > 0) recharger();
    } catch (e) {
      Alert.alert('Import impossible', String(e));
    }
  };

  const [synchro, setSynchro] = useState<string | null>(null);

  const lancerSynchro = async (adresse: string) => {
    setSynchro('Connexion au Mac…');
    try {
      const { ajoutes, dejaPresents } = await synchroniserAvecMac(adresse, (fait, total) => {
        setSynchro(total === 0 ? 'Rien de nouveau' : `Copie ${fait} / ${total}…`);
        if (fait > 0) recharger();
      });
      recharger();
      Alert.alert(
        'Synchro terminée',
        ajoutes === 0
          ? `Tout est déjà sur l'iPhone (${dejaPresents} morceaux).`
          : `${ajoutes} morceau${ajoutes > 1 ? 'x' : ''} copié${ajoutes > 1 ? 's' : ''} sur l'iPhone.`,
      );
    } catch {
      Alert.alert(
        'Mac introuvable',
        `Vérifie que le Mac est allumé, sur le même Wi-Fi, et que le serveur de synchro tourne.\n\nAdresse essayée : ${adresse}`,
        [
          { text: 'OK' },
          { text: "Changer l'adresse", onPress: () => demanderAdresse() },
        ],
      );
    } finally {
      setSynchro(null);
    }
  };

  const demanderAdresse = async () => {
    const actuelle = (await lireAdresseMac()) ?? ADRESSE_MAC_PAR_DEFAUT;
    Alert.prompt(
      'Adresse du Mac',
      'Elle s\'affiche dans le Terminal du Mac quand le serveur de synchro démarre.',
      async (saisie) => {
        if (!saisie?.trim()) return;
        await enregistrerAdresseMac(saisie);
        lancerSynchro(saisie.trim());
      },
      'plain-text',
      actuelle,
    );
  };

  const synchroniser = async () => {
    if (synchro) return;
    lancerSynchro((await lireAdresseMac()) ?? ADRESSE_MAC_PAR_DEFAUT);
  };

  const proposerSuppression =(morceau: Morceau, index: number) => {
    Alert.alert('Retirer ce morceau ?', `${morceau.titre}\n\nLe fichier sera effacé de l'iPhone.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          if (index === courant) {
            player.pause();
            player.clearLockScreenControls();
            setNomCourant(null);
          }
          supprimerMorceau(morceau);
          recharger();
        },
      },
    ]);
  };

  const progression = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <SafeAreaView style={styles.ecran} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.entete}>
        <Text style={styles.titreApp}>Lecteur</Text>
        <View style={styles.boutonsEntete}>
          <Pressable
            onPress={synchroniser}
            onLongPress={demanderAdresse}
            style={({ pressed }) => [styles.boutonAjouter, pressed && styles.appuye]}
          >
            <Text style={styles.texteAjouter}>⟳ Mac</Text>
          </Pressable>
          <Pressable onPress={ajouter} style={({ pressed }) => [styles.boutonAjouter, pressed && styles.appuye]}>
            <Text style={styles.texteAjouter}>＋</Text>
          </Pressable>
        </View>
      </View>
      {synchro && <Text style={styles.bandeauSynchro}>{synchro}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(m) => m.nom}
        stickySectionHeadersEnabled
        contentContainerStyle={morceaux.length === 0 && styles.listeVide}
        ListEmptyComponent={
          <View style={styles.vide}>
            <Text style={styles.videTitre}>Aucun morceau pour l'instant</Text>
            <Text style={styles.videTexte}>
              Touche « ⟳ Mac » pour copier le dossier « Musique pour iPhone » du Mac, ou « ＋ » pour choisir des
              fichiers sur l'iPhone.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.theme}>
            {section.title} <Text style={styles.themeNombre}>· {section.data.length}</Text>
          </Text>
        )}
        renderItem={({ item }) => {
          const index = morceaux.indexOf(item);
          const actif = index === courant;
          const reprise = positions.current[item.nom];
          return (
            <Pressable
              onPress={() => lancer(index)}
              onLongPress={() => proposerSuppression(item, index)}
              style={({ pressed }) => [styles.ligne, actif && styles.ligneActive, pressed && styles.appuye]}
            >
              <Text style={[styles.ligneTitre, actif && styles.ligneTitreActif]} numberOfLines={2}>
                {item.titre}
              </Text>
              <Text style={styles.ligneDetail}>
                {item.format} · {item.tailleMo} Mo{reprise ? ` · reprise à ${duree(reprise)}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.panneau}>
        <Text style={styles.enCours} numberOfLines={1}>
          {morceauCourant ? morceauCourant.titre : 'Choisis un morceau'}
        </Text>
        <View style={styles.barre}>
          <View style={[styles.barrePleine, { width: `${progression * 100}%` }]} />
        </View>
        <View style={styles.temps}>
          <Text style={styles.tempsTexte}>{duree(status.currentTime)}</Text>
          <Text style={styles.tempsTexte}>{duree(status.duration)}</Text>
        </View>

        <View style={styles.commandes}>
          <BoutonRond libelle="⏮" onPress={() => courant !== null && courant > 0 && lancer(courant - 1)} />
          <BoutonRond libelle={`−${SAUT_SECONDES}`} onPress={() => sauter(-SAUT_SECONDES)} />
          <BoutonRond libelle={status.playing ? '❚❚' : '▶'} onPress={lectureOuPause} principal />
          <BoutonRond libelle={`+${SAUT_SECONDES}`} onPress={() => sauter(SAUT_SECONDES)} />
          <BoutonRond
            libelle="⏭"
            onPress={() => courant !== null && courant + 1 < morceaux.length && lancer(courant + 1)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function BoutonRond({ libelle, onPress, principal }: { libelle: string; onPress: () => void; principal?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.rond, principal && styles.rondPrincipal, pressed && styles.appuye]}
    >
      <Text style={[styles.rondTexte, principal && styles.rondTextePrincipal]}>{libelle}</Text>
    </Pressable>
  );
}

const ACCENT = '#E8B04B';

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: '#0B0B0D' },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  titreApp: { color: '#FFF', fontSize: 30, fontWeight: '700' },
  boutonsEntete: { flexDirection: 'row', gap: 10 },
  bandeauSynchro: { color: ACCENT, fontSize: 16, paddingHorizontal: 20, paddingBottom: 8 },
  boutonAjouter: { backgroundColor: '#1F1F24', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  texteAjouter: { color: ACCENT, fontSize: 18, fontWeight: '600' },
  appuye: { opacity: 0.55 },

  listeVide: { flexGrow: 1 },
  vide: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  videTitre: { color: '#FFF', fontSize: 22, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  videTexte: { color: '#9A9AA3', fontSize: 17, lineHeight: 24, textAlign: 'center' },

  theme: {
    color: ACCENT,
    backgroundColor: '#0B0B0D',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  themeNombre: { color: '#6E6E77', fontWeight: '500' },
  ligne: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A30',
  },
  ligneActive: { backgroundColor: '#17171B' },
  ligneTitre: { color: '#F2F2F5', fontSize: 20, fontWeight: '500' },
  ligneTitreActif: { color: ACCENT },
  ligneDetail: { color: '#8A8A93', fontSize: 14, marginTop: 4 },

  panneau: {
    backgroundColor: '#141418',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A30',
  },
  enCours: { color: '#FFF', fontSize: 20, fontWeight: '600', marginBottom: 12 },
  barre: { height: 6, backgroundColor: '#2A2A30', borderRadius: 3, overflow: 'hidden' },
  barrePleine: { height: 6, backgroundColor: ACCENT },
  temps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tempsTexte: { color: '#9A9AA3', fontSize: 14, fontVariant: ['tabular-nums'] },

  commandes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  rond: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22222A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rondPrincipal: { width: 88, height: 88, borderRadius: 44, backgroundColor: ACCENT },
  rondTexte: { color: '#FFF', fontSize: 20, fontWeight: '600' },
  rondTextePrincipal: { color: '#0B0B0D', fontSize: 32 },
});
