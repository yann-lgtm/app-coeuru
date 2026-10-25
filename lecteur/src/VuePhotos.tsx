import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Album, supprimerAlbum } from './photos';

const ACCENT = '#E8B04B';

/*
 * Onglet Photos : la liste des albums, puis la grille d'un album, puis la
 * visionneuse plein écran (on glisse pour passer d'une photo à l'autre, on
 * pince pour zoomer). Les photos restent dans l'app, hors de la pellicule.
 */
export default function VuePhotos({ albums, onChangement }: { albums: Album[]; onChangement: () => void }) {
  const [albumOuvert, setAlbumOuvert] = useState<string | null>(null);
  const [photoOuverte, setPhotoOuverte] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const album = albums.find((a) => a.nom === albumOuvert);

  const proposerSuppression = (a: Album) =>
    Alert.alert(
      `Retirer « ${a.nom} » de l’iPhone ?`,
      'Les photos originales sur le Mac ne sont pas touchées : un « ⟳ Mac » le ramènera.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            supprimerAlbum(a.nom);
            setAlbumOuvert(null);
            onChangement();
          },
        },
      ],
    );

  if (albums.length === 0) {
    return (
      <View style={styles.vide}>
        <Text style={styles.videTitre}>Aucun album pour l'instant</Text>
        <Text style={styles.videTexte}>
          Range des dossiers de photos dans « Photos pour iPhone » sur le Bureau du Mac, puis touche « ⟳ Mac ».
        </Text>
      </View>
    );
  }

  // Grille d'un album
  if (album) {
    const cote = (width - 4) / 3;
    return (
      <View style={styles.plein}>
        <Pressable onPress={() => setAlbumOuvert(null)} style={({ pressed }) => [styles.retour, pressed && styles.appuye]}>
          <Ionicons name="chevron-back" size={26} color={ACCENT} />
          <Text style={styles.retourTexte}>Albums</Text>
        </Pressable>
        <Text style={styles.titreAlbum}>
          {album.nom} <Text style={styles.nombre}>· {album.photos.length}</Text>
        </Text>
        <FlatList
          data={album.photos}
          keyExtractor={(p) => p.nom}
          numColumns={3}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ gap: 2, paddingBottom: 24 }}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => setPhotoOuverte(index)}>
              <Image source={item.uri} style={{ width: cote, height: cote }} contentFit="cover" recyclingKey={item.uri} />
            </Pressable>
          )}
        />
        <Visionneuse
          album={album}
          depart={photoOuverte}
          onFermer={() => setPhotoOuverte(null)}
        />
      </View>
    );
  }

  // Liste des albums
  const largeurCarte = (width - 16 * 2 - 12) / 2;
  return (
    <FlatList
      data={albums}
      keyExtractor={(a) => a.nom}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ padding: 16, gap: 18 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setAlbumOuvert(item.nom)}
          onLongPress={() => proposerSuppression(item)}
          style={({ pressed }) => [{ width: largeurCarte }, pressed && styles.appuye]}
        >
          <Image
            source={item.photos[0].uri}
            style={{ width: largeurCarte, height: largeurCarte, borderRadius: 14 }}
            contentFit="cover"
          />
          <Text style={styles.nomAlbum} numberOfLines={1}>
            {item.nom}
          </Text>
          <Text style={styles.nombre}>{item.photos.length} photos</Text>
        </Pressable>
      )}
    />
  );
}

function Visionneuse({ album, depart, onFermer }: { album: Album; depart: number | null; onFermer: () => void }) {
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = useState(0);

  return (
    <Modal
      visible={depart !== null}
      animationType="fade"
      onShow={() => setPosition(depart ?? 0)}
      onRequestClose={onFermer}
      supportedOrientations={['portrait', 'landscape']}
    >
      <SafeAreaProvider>
        <View style={styles.visionneuse}>
          {depart !== null && (
            <FlatList
              data={album.photos}
              keyExtractor={(p) => p.nom}
              horizontal
              pagingEnabled
              initialScrollIndex={depart}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPosition(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => (
                // Le ScrollView sert au zoom à deux doigts (iOS).
                <ScrollView
                  style={{ width, height }}
                  contentContainerStyle={{ width, height }}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <Image source={item.uri} style={{ width, height }} contentFit="contain" />
                </ScrollView>
              )}
            />
          )}
          <SafeAreaView edges={['top']} style={styles.barreVisionneuse} pointerEvents="box-none">
            <Pressable onPress={onFermer} hitSlop={16} style={styles.fermer} accessibilityLabel="Fermer">
              <Ionicons name="close" size={30} color="#FFF" />
            </Pressable>
            <Text style={styles.compteur}>
              {position + 1} / {album.photos.length}
            </Text>
            {/* Feuille de partage iOS : Messages, AirDrop, WhatsApp, « Enregistrer l'image »… */}
            <Pressable
              onPress={() => Share.share({ url: album.photos[position].uri })}
              hitSlop={16}
              style={styles.fermer}
              accessibilityLabel="Partager"
            >
              <Ionicons name="share-outline" size={26} color="#FFF" />
            </Pressable>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  appuye: { opacity: 0.55 },
  vide: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  videTitre: { color: '#FFF', fontSize: 22, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  videTexte: { color: '#9A9AA3', fontSize: 17, lineHeight: 24, textAlign: 'center' },
  retour: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  retourTexte: { color: ACCENT, fontSize: 17, fontWeight: '600' },
  titreAlbum: { color: '#FFF', fontSize: 26, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 12 },
  nomAlbum: { color: '#F2F2F5', fontSize: 18, fontWeight: '600', marginTop: 8 },
  nombre: { color: '#8A8A93', fontSize: 15, fontWeight: '500' },
  visionneuse: { flex: 1, backgroundColor: '#000' },
  barreVisionneuse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  fermer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compteur: { color: '#FFF', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
