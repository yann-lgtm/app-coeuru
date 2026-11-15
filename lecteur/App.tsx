import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, AppState, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  Morceau,
  enregistrerAdresseMac,
  enregistrerPosition,
  importerDepuisFichiers,
  lireAdresseMac,
  lirePositions,
  listerMorceaux,
  rangerBoiteDeReception,
  supprimerMorceau,
  synchroniserAvecMac,
} from './src/bibliotheque';
import VuePhotos from './src/VuePhotos';
import { Album, listerAlbums, synchroniserPhotos } from './src/photos';
import {
  Bibliotheque,
  ajouterABibliotheque,
  creerBibliotheque,
  lireBibliotheques,
  oublierMorceau,
  renommerBibliotheque,
  retirerDeBibliotheque,
  supprimerBibliotheque,
} from './src/bibliotheques';
import {
  FONDU_SECONDES,
  Minuterie,
  Repetition,
  libelleMinuterie,
  libelleRepetition,
  minuterieSuivante,
  morceauPrecedent,
  morceauSuivant,
  repetitionSuivante,
} from './src/lecture';

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
  const [pleinEcran, setPleinEcran] = useState(false);
  const [repetition, setRepetition] = useState<Repetition>('non');
  const [aleatoire, setAleatoire] = useState(false);
  const [minuterie, setMinuterie] = useState<Minuterie>(null);
  const [maintenant, setMaintenant] = useState(Date.now());
  // Bibliothèques personnalisées, la vue affichée (« tout » ou un id), et la
  // vue dans laquelle le morceau en cours a été lancé : c'est elle qui décide
  // du suivant, même si on change d'onglet entre-temps.
  const [bibliotheques, setBibliotheques] = useState<Bibliotheque[]>([]);
  const [vue, setVue] = useState<string>('tout');
  const [contexteLecture, setContexteLecture] = useState<string>('tout');
  const [espace, setEspace] = useState<'musique' | 'photos'>('musique');
  const [albums, setAlbums] = useState<Album[]>([]);

  const recharger = useCallback(async () => {
    try {
      // Fichiers reçus par AirDrop ou « Partager » : iOS les dépose dans Inbox.
      await rangerBoiteDeReception().catch(() => {});
      setMorceaux(listerMorceaux());
      setAlbums(listerAlbums());
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
    lireBibliotheques().then(setBibliotheques);
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

  const parNom = useMemo(() => new Map(morceaux.map((m) => [m.nom, m])), [morceaux]);
  const bibliothequeAffichee = bibliotheques.find((b) => b.id === vue);

  /** Les morceaux d'une vue, dans leur ordre ; un morceau effacé est ignoré. */
  const ordreDe = useCallback(
    (contexte: string): string[] => {
      if (contexte === 'tout') return morceaux.map((m) => m.nom);
      const biblio = bibliotheques.find((b) => b.id === contexte);
      return (biblio?.morceaux ?? []).filter((nom) => parNom.has(nom));
    },
    [morceaux, bibliotheques, parNom],
  );

  /** Ce qu'on répète ou mélange : le thème dans « Tout », la bibliothèque sinon. */
  const groupeDe = useCallback(
    (contexte: string, nom: string): string[] => {
      if (contexte !== 'tout') return ordreDe(contexte);
      const theme = parNom.get(nom)?.theme;
      return morceaux.filter((m) => m.theme === theme).map((m) => m.nom);
    },
    [ordreDe, morceaux, parNom],
  );

  const sections = useMemo(() => {
    if (bibliothequeAffichee) {
      const data = ordreDe(vue).flatMap((nom) => parNom.get(nom) ?? []);
      return data.length > 0 ? [{ title: bibliothequeAffichee.nom, data }] : [];
    }
    const parTheme = new Map<string, Morceau[]>();
    for (const m of morceaux) parTheme.set(m.theme, [...(parTheme.get(m.theme) ?? []), m]);
    return [...parTheme].map(([title, data]) => ({ title, data }));
  }, [morceaux, bibliothequeAffichee, ordreDe, vue, parNom]);

  const memoriser = useCallback((nom: string, secondes: number) => {
    positions.current[nom] = secondes;
    enregistrerPosition(nom, secondes);
  }, []);

  const lancer = useCallback(
    (nom: string, contexte: string) => {
      const morceau = parNom.get(nom);
      if (!morceau) return;
      setContexteLecture(contexte);
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
    [parNom, morceauCourant, memoriser, player],
  );

  // « Répète ce morceau » : c'est le lecteur qui boucle, sans passer par la fin.
  useEffect(() => {
    player.loop = repetition === 'morceau';
  }, [repetition, player]);

  // Minuterie d'arrêt : fondu sur les dernières secondes, puis pause.
  useEffect(() => {
    if (minuterie?.type !== 'duree') {
      player.volume = 1;
      return;
    }
    const tic = setInterval(() => {
      const reste = (minuterie.fin - Date.now()) / 1000;
      setMaintenant(Date.now());
      if (reste <= 0) {
        player.pause();
        player.volume = 1;
        setMinuterie(null);
      } else if (reste < FONDU_SECONDES) {
        player.volume = reste / FONDU_SECONDES;
      }
    }, 1000);
    return () => clearInterval(tic);
  }, [minuterie, player]);

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

  // Fin du morceau : on repart du début la prochaine fois, puis on enchaîne
  // selon la répétition et le hasard — sauf si la minuterie dit d'arrêter.
  useEffect(() => {
    if (!status.didJustFinish || courant === null || !morceauCourant) return;
    memoriser(morceauCourant.nom, 0);
    if (minuterie?.type === 'fin-morceau') {
      setMinuterie(null);
      return;
    }
    const nom = morceauCourant.nom;
    const suivant = morceauSuivant(
      ordreDe(contexteLecture),
      groupeDe(contexteLecture, nom),
      nom,
      repetition,
      aleatoire,
    );
    if (suivant !== null) lancer(suivant, contexteLecture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const allerSuivant = () => {
    if (!morceauCourant) return;
    const nom = morceauCourant.nom;
    const suivant = morceauSuivant(
      ordreDe(contexteLecture),
      groupeDe(contexteLecture, nom),
      nom,
      repetition === 'morceau' ? 'non' : repetition,
      aleatoire,
    );
    if (suivant !== null) lancer(suivant, contexteLecture);
  };

  // Comme sur un autoradio : un premier appui revient au début du morceau.
  const allerPrecedent = () => {
    if (courant === null) return;
    if (status.currentTime > 5) {
      player.seekTo(0);
      return;
    }
    if (!morceauCourant) return;
    const nom = morceauCourant.nom;
    const precedent = morceauPrecedent(
      ordreDe(contexteLecture),
      groupeDe(contexteLecture, nom),
      nom,
      repetition === 'morceau' ? 'non' : repetition,
    );
    if (precedent !== null) lancer(precedent, contexteLecture);
  };

  const changerMinuterie = () => {
    const t = Date.now();
    setMaintenant(t);
    setMinuterie((m) => minuterieSuivante(m, t));
  };

  const lectureOuPause = () => {
    if (courant === null) {
      const premier = ordreDe(vue)[0];
      if (premier) lancer(premier, vue);
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

  const [synchro, setSynchro] = useState<string | null>(null);

  const ajouter = async () => {
    try {
      const bilan = await importerDepuisFichiers((n) =>
        setSynchro(`Import de ${n} morceau${n > 1 ? 'x' : ''}… (les fichiers iCloud peuvent prendre un moment)`),
      );
      if (!bilan) return;
      await recharger();
      const n = bilan.ajoutes.length;
      const message = [
        n > 0 ? `${n} morceau${n > 1 ? 'x' : ''} ajouté${n > 1 ? 's' : ''} dans « Mes morceaux ».` : '',
        ...bilan.echecs.map((e) => `Échec pour « ${e.nom} » : ${e.raison}`),
      ]
        .filter(Boolean)
        .join('\n\n');
      Alert.alert(bilan.echecs.length === 0 ? 'Import terminé' : 'Import incomplet', message);
    } catch (e) {
      Alert.alert('Import impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setSynchro(null);
    }
  };

  const lancerSynchro = async (adresse: string) => {
    setSynchro('Connexion au Mac…');
    try {
      const { ajoutes, dejaPresents } = await synchroniserAvecMac(adresse, (fait, total) => {
        setSynchro(total === 0 ? 'Musique : rien de nouveau' : `Musique : ${fait} / ${total}…`);
        if (fait > 0) recharger();
      });
      const photos = await synchroniserPhotos(adresse, (fait, total) => {
        setSynchro(total === 0 ? 'Photos : rien de nouveau' : `Photos : ${fait} / ${total}…`);
        if (fait > 0 && fait % 10 === 0) recharger();
      });
      recharger();
      const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? (mot === 'morceau' ? 'x' : 's') : ''}`;
      Alert.alert(
        'Synchro terminée',
        ajoutes === 0 && photos.ajoutees === 0
          ? `Tout est déjà sur l'iPhone (${pluriel(dejaPresents, 'morceau')}, ${pluriel(photos.dejaPresentes, 'photo')}).`
          : `Copié sur l'iPhone : ${pluriel(ajoutes, 'morceau')} et ${pluriel(photos.ajoutees, 'photo')}.`,
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

  const proposerSuppression = (morceau: Morceau) => {
    Alert.alert('Supprimer ce morceau de l’iPhone ?', `${morceau.titre}\n\nLe fichier sera effacé, et retiré de toutes les bibliothèques.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (morceau.nom === nomCourant) {
            player.pause();
            player.clearLockScreenControls();
            setNomCourant(null);
          }
          supprimerMorceau(morceau);
          setBibliotheques(await oublierMorceau(morceau.nom));
          recharger();
        },
      },
    ]);
  };

  const demanderNomBibliotheque = (titre: string, valeur: string, valider: (nom: string) => void) => {
    Alert.prompt(
      titre,
      'Par exemple « Voiture », « Dormir » ou « Soirée ».',
      (saisie) => {
        if (saisie?.trim()) valider(saisie.trim());
      },
      'plain-text',
      valeur,
    );
  };

  const nouvelleBibliotheque = (puis?: (id: string) => void) =>
    demanderNomBibliotheque('Nouvelle bibliothèque', '', async (nom) => {
      const { liste, creee } = await creerBibliotheque(nom);
      setBibliotheques(liste);
      if (puis) puis(creee.id);
      else setVue(creee.id);
    });

  const choisirBibliotheque = (morceau: Morceau) => {
    const choix = bibliotheques.filter((b) => !b.morceaux.includes(morceau.nom));
    const libelles = [...choix.map((b) => b.nom), '＋ Nouvelle bibliothèque…', 'Annuler'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `Ajouter « ${morceau.titre} » à…`, options: libelles, cancelButtonIndex: libelles.length - 1 },
      async (i) => {
        if (i < choix.length) setBibliotheques(await ajouterABibliotheque(choix[i].id, morceau.nom));
        else if (i === choix.length)
          nouvelleBibliotheque(async (id) => setBibliotheques(await ajouterABibliotheque(id, morceau.nom)));
      },
    );
  };

  // Appui long sur un morceau : ajouter à une bibliothèque, l'en retirer, ou l'effacer.
  const menuMorceau = (morceau: Morceau) => {
    const actions: { libelle: string; faire: () => void }[] = [
      { libelle: 'Ajouter à une bibliothèque…', faire: () => choisirBibliotheque(morceau) },
    ];
    if (bibliothequeAffichee) {
      actions.push({
        libelle: `Retirer de « ${bibliothequeAffichee.nom} »`,
        faire: async () => setBibliotheques(await retirerDeBibliotheque(bibliothequeAffichee.id, morceau.nom)),
      });
    }
    actions.push({ libelle: 'Supprimer de l’iPhone…', faire: () => proposerSuppression(morceau) });
    const libelles = [...actions.map((a) => a.libelle), 'Annuler'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: morceau.titre,
        options: libelles,
        cancelButtonIndex: libelles.length - 1,
        destructiveButtonIndex: actions.length - 1,
      },
      (i) => actions[i]?.faire(),
    );
  };

  // Appui long sur l'onglet d'une bibliothèque : la renommer ou la supprimer.
  const menuBibliotheque = (biblio: Bibliotheque) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: biblio.nom,
        message: 'Supprimer une bibliothèque n’efface aucun morceau.',
        options: ['Renommer…', 'Supprimer la bibliothèque', 'Annuler'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0)
          demanderNomBibliotheque('Renommer', biblio.nom, async (nom) =>
            setBibliotheques(await renommerBibliotheque(biblio.id, nom)),
          );
        if (i === 1)
          (async () => {
            setBibliotheques(await supprimerBibliotheque(biblio.id));
            if (vue === biblio.id) setVue('tout');
          })();
      },
    );
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
          {espace === 'musique' && (
            <Pressable onPress={ajouter} style={({ pressed }) => [styles.boutonAjouter, pressed && styles.appuye]}>
              <Text style={styles.texteAjouter}>＋</Text>
            </Pressable>
          )}
        </View>
      </View>
      {synchro && <Text style={styles.bandeauSynchro}>{synchro}</Text>}

      <View style={styles.espaces}>
        {(['musique', 'photos'] as const).map((e) => (
          <Pressable
            key={e}
            onPress={() => setEspace(e)}
            accessibilityState={{ selected: espace === e }}
            style={[styles.espace, espace === e && styles.espaceActif]}
          >
            <Ionicons name={e === 'musique' ? 'musical-notes' : 'images'} size={20} color={espace === e ? '#0B0B0D' : '#C8C8CE'} />
            <Text style={[styles.espaceTexte, espace === e && styles.espaceTexteActif]}>
              {e === 'musique' ? 'Musique' : 'Photos'}
            </Text>
          </Pressable>
        ))}
      </View>

      {espace === 'photos' ? (
        <VuePhotos albums={albums} onChangement={recharger} />
      ) : (
      <>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.onglets}>
          <Onglet libelle="Tout" actif={vue === 'tout'} onPress={() => setVue('tout')} />
          {bibliotheques.map((b) => (
            <Onglet
              key={b.id}
              libelle={b.nom}
              actif={vue === b.id}
              onPress={() => setVue(b.id)}
              onLongPress={() => menuBibliotheque(b)}
            />
          ))}
          <Onglet libelle="＋ Nouvelle" actif={false} onPress={() => nouvelleBibliotheque()} discret />
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(m) => m.nom}
        stickySectionHeadersEnabled
        contentContainerStyle={sections.length === 0 && styles.listeVide}
        ListEmptyComponent={
          bibliothequeAffichee ? (
            <View style={styles.vide}>
              <Text style={styles.videTitre}>« {bibliothequeAffichee.nom} » est vide</Text>
              <Text style={styles.videTexte}>
                Dans « Tout », fais un appui long sur un morceau, puis « Ajouter à une bibliothèque… ».
              </Text>
            </View>
          ) : (
            <View style={styles.vide}>
              <Text style={styles.videTitre}>Aucun morceau pour l'instant</Text>
              <Text style={styles.videTexte}>
                Touche « ⟳ Mac » pour copier le dossier « Musique pour iPhone » du Mac, ou « ＋ » pour choisir des
                fichiers sur l'iPhone.
              </Text>
            </View>
          )
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.theme}>
            {section.title} <Text style={styles.themeNombre}>· {section.data.length}</Text>
          </Text>
        )}
        renderItem={({ item }) => {
          const actif = item.nom === nomCourant;
          const reprise = positions.current[item.nom];
          return (
            <Pressable
              onPress={() => lancer(item.nom, vue)}
              onLongPress={() => menuMorceau(item)}
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
      </>
      )}

      <View style={styles.panneau}>
        <Pressable
          onPress={() => morceauCourant && setPleinEcran(true)}
          style={({ pressed }) => [styles.enCoursLigne, pressed && styles.appuye]}
          accessibilityLabel="Agrandir le lecteur"
        >
          <Text style={styles.enCours} numberOfLines={1}>
            {morceauCourant ? morceauCourant.titre : 'Choisis un morceau'}
          </Text>
          {morceauCourant && <Ionicons name="chevron-up" size={26} color={ACCENT} />}
        </Pressable>
        <View style={styles.barre}>
          <View style={[styles.barrePleine, { width: `${progression * 100}%` }]} />
        </View>
        <View style={styles.temps}>
          <Text style={styles.tempsTexte}>{duree(status.currentTime)}</Text>
          <Text style={styles.tempsTexte}>{duree(status.duration)}</Text>
        </View>

        <View style={styles.commandes}>
          <BoutonRond icone="play-skip-back" onPress={allerPrecedent} />
          <BoutonRond libelle={`−${SAUT_SECONDES}`} onPress={() => sauter(-SAUT_SECONDES)} />
          <BoutonRond icone={status.playing ? 'pause' : 'play'} onPress={lectureOuPause} principal />
          <BoutonRond libelle={`+${SAUT_SECONDES}`} onPress={() => sauter(SAUT_SECONDES)} />
          <BoutonRond icone="play-skip-forward" onPress={allerSuivant} />
        </View>
      </View>

      {/* Écran « en cours » : tout en grand, pour la voiture. */}
      <Modal visible={pleinEcran && !!morceauCourant} animationType="slide" onRequestClose={() => setPleinEcran(false)}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.plein} edges={['top', 'bottom']}>
            <View style={styles.pleinHaut}>
              <Pressable
                onPress={() => setPleinEcran(false)}
                hitSlop={16}
                style={({ pressed }) => [styles.pleinFermer, pressed && styles.appuye]}
                accessibilityLabel="Revenir à la liste"
              >
                <Ionicons name="chevron-down" size={34} color="#FFF" />
              </Pressable>
              <Text style={styles.pleinTheme} numberOfLines={1}>
                {morceauCourant?.theme}
              </Text>
              <View style={styles.pleinFermer} />
            </View>

            <View style={styles.pleinCentre}>
              <Text style={styles.pleinTitre} numberOfLines={3} adjustsFontSizeToFit>
                {morceauCourant?.titre}
              </Text>
              <BarreProgression
                progression={progression}
                onChercher={(ratio) => status.duration > 0 && player.seekTo(ratio * status.duration)}
              />
              <View style={styles.temps}>
                <Text style={styles.pleinTemps}>{duree(status.currentTime)}</Text>
                <Text style={styles.pleinTemps}>−{duree(status.duration - status.currentTime)}</Text>
              </View>
            </View>

            <View style={styles.pleinCommandes}>
              <BoutonRond libelle={`−${SAUT_SECONDES}`} onPress={() => sauter(-SAUT_SECONDES)} grand />
              <BoutonRond icone={status.playing ? 'pause' : 'play'} onPress={lectureOuPause} principal geant />
              <BoutonRond libelle={`+${SAUT_SECONDES}`} onPress={() => sauter(SAUT_SECONDES)} grand />
            </View>
            <View style={styles.pleinPistes}>
              <BoutonLarge icone="play-skip-back" libelle="Précédent" onPress={allerPrecedent} />
              <BoutonLarge icone="play-skip-forward" libelle="Suivant" onPress={allerSuivant} iconeApres />
            </View>

            <View style={styles.pleinOptions}>
              <BoutonOption
                icone="repeat"
                libelle={libelleRepetition(repetition, contexteLecture === 'tout' ? 'theme' : 'bibliotheque')}
                actif={repetition !== 'non'}
                onPress={() => setRepetition(repetitionSuivante)}
              />
              <BoutonOption
                icone="shuffle"
                libelle={
                  aleatoire
                    ? contexteLecture === 'tout'
                      ? 'Au hasard dans le thème'
                      : 'Au hasard dans la bibliothèque'
                    : 'Dans l’ordre'
                }
                actif={aleatoire}
                onPress={() => setAleatoire((a) => !a)}
              />
              <BoutonOption
                icone="moon"
                libelle={libelleMinuterie(minuterie, maintenant)}
                actif={minuterie !== null}
                onPress={changerMinuterie}
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

type NomIcone = keyof typeof Ionicons.glyphMap;

function Onglet({
  libelle,
  actif,
  onPress,
  onLongPress,
  discret,
}: {
  libelle: string;
  actif: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  discret?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={{ selected: actif }}
      style={({ pressed }) => [styles.onglet, actif && styles.ongletActif, discret && styles.ongletDiscret, pressed && styles.appuye]}
    >
      <Text style={[styles.ongletTexte, actif && styles.ongletTexteActif]}>{libelle}</Text>
    </Pressable>
  );
}

function BoutonRond({
  libelle,
  icone,
  onPress,
  principal,
  grand,
  geant,
}: {
  libelle?: string;
  icone?: NomIcone;
  onPress: () => void;
  principal?: boolean;
  grand?: boolean;
  geant?: boolean;
}) {
  const taille = geant ? 128 : grand ? 84 : principal ? 88 : 60;
  const couleur = principal ? '#0B0B0D' : '#FFF';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={libelle ?? icone}
      style={({ pressed }) => [
        styles.rond,
        { width: taille, height: taille, borderRadius: taille / 2 },
        principal && styles.rondPrincipal,
        pressed && styles.appuye,
      ]}
    >
      {icone ? (
        <Ionicons
          name={icone}
          size={taille * 0.42}
          color={couleur}
          // Le triangle « lecture » paraît décentré : on le pousse d'un cheveu à droite.
          style={icone === 'play' ? { marginLeft: taille * 0.06 } : undefined}
        />
      ) : (
        <Text style={[styles.rondTexte, { color: couleur, fontSize: grand ? 26 : 20 }]}>{libelle}</Text>
      )}
    </Pressable>
  );
}

function BoutonLarge({
  icone,
  libelle,
  onPress,
  iconeApres,
}: {
  icone: NomIcone;
  libelle: string;
  onPress: () => void;
  iconeApres?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.large, pressed && styles.appuye]}>
      {!iconeApres && <Ionicons name={icone} size={28} color="#FFF" />}
      <Text style={styles.largeTexte}>{libelle}</Text>
      {iconeApres && <Ionicons name={icone} size={28} color="#FFF" />}
    </Pressable>
  );
}

function BoutonOption({
  icone,
  libelle,
  actif,
  onPress,
}: {
  icone: NomIcone;
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, actif && styles.optionActive, pressed && styles.appuye]}
      accessibilityState={{ selected: actif }}
    >
      <Ionicons name={icone} size={24} color={actif ? '#0B0B0D' : ACCENT} />
      <Text style={[styles.optionTexte, actif && styles.optionTexteActif]}>{libelle}</Text>
    </Pressable>
  );
}

/** Barre de lecture : on touche un endroit pour s'y rendre. */
function BarreProgression({ progression, onChercher }: { progression: number; onChercher: (ratio: number) => void }) {
  const [largeur, setLargeur] = useState(1);
  return (
    <Pressable
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      onPress={(e) => onChercher(Math.min(Math.max(e.nativeEvent.locationX / largeur, 0), 1))}
      hitSlop={{ top: 16, bottom: 16 }}
      style={styles.pleinBarre}
      accessibilityLabel="Avancer ou reculer dans le morceau"
    >
      {/* La partie remplie ne capte pas le toucher : la position se lit sur la barre entière. */}
      <View pointerEvents="none" style={[styles.pleinBarrePleine, { width: `${progression * 100}%` }]} />
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
  espaces: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#17171B',
    gap: 4,
  },
  espace: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  espaceActif: { backgroundColor: ACCENT },
  espaceTexte: { color: '#C8C8CE', fontSize: 17, fontWeight: '600' },
  espaceTexteActif: { color: '#0B0B0D' },
  onglets: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  onglet: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
  },
  ongletActif: { backgroundColor: ACCENT },
  ongletDiscret: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3A3A42' },
  ongletTexte: { color: '#E6E6EA', fontSize: 16, fontWeight: '600' },
  ongletTexteActif: { color: '#0B0B0D' },
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
  enCoursLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  enCours: { flex: 1, color: '#FFF', fontSize: 20, fontWeight: '600' },
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

  plein: { flex: 1, backgroundColor: '#0B0B0D', paddingHorizontal: 22 },
  pleinHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  pleinFermer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pleinTheme: { flex: 1, textAlign: 'center', color: ACCENT, fontSize: 16, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  pleinCentre: { flex: 1, justifyContent: 'center' },
  pleinTitre: { color: '#FFF', fontSize: 38, fontWeight: '700', lineHeight: 44, marginBottom: 28 },
  pleinBarre: { height: 10, backgroundColor: '#2A2A30', borderRadius: 5, overflow: 'hidden' },
  pleinBarrePleine: { height: 10, backgroundColor: ACCENT },
  pleinTemps: { color: '#B4B4BC', fontSize: 18, fontVariant: ['tabular-nums'], marginTop: 6 },
  pleinCommandes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  pleinPistes: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  large: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#22222A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  largeTexte: { color: '#FFF', fontSize: 19, fontWeight: '600' },
  pleinOptions: { gap: 10, paddingBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#17171B',
    borderWidth: 1,
    borderColor: '#2A2A30',
  },
  optionActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionTexte: { color: '#F2F2F5', fontSize: 17, fontWeight: '500' },
  optionTexteActif: { color: '#0B0B0D', fontWeight: '700' },
});
