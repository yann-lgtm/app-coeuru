import { Directory, File, Paths } from 'expo-file-system';

/*
 * Albums photo : le dossier Documents/Photos de l'app, un sous-dossier par
 * album. Ils arrivent du Mac (dossier « Photos pour iPhone » du Bureau) par
 * le même bouton « ⟳ Mac » que la musique, déjà réduits en taille écran.
 */

export const DOSSIER_PHOTOS = 'Photos';
const EXTENSIONS_PHOTO = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
const PORT_MAC = 8090;

export type Photo = { nom: string; uri: string };
export type Album = { nom: string; photos: Photo[] };

function estPhoto(nom: string): boolean {
  const point = nom.lastIndexOf('.');
  return point !== -1 && EXTENSIONS_PHOTO.includes(nom.slice(point + 1).toLowerCase());
}

function racine(): Directory {
  return new Directory(Paths.document, DOSSIER_PHOTOS);
}

/** Les albums, triés par nom ; les photos dans l'ordre de leurs noms de fichier. */
export function listerAlbums(): Album[] {
  const dossier = racine();
  if (!dossier.exists) return [];
  const albums: Album[] = [];
  for (const element of dossier.list()) {
    if (!(element instanceof Directory)) continue;
    const photos = element
      .list()
      .filter((f): f is File => f instanceof File && estPhoto(f.name))
      .map((f) => ({ nom: f.name, uri: f.uri }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    if (photos.length > 0) albums.push({ nom: element.name, photos });
  }
  return albums.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Efface un album de l'iPhone (les originaux du Mac ne sont pas touchés). */
export function supprimerAlbum(nom: string): void {
  const dossier = new Directory(racine(), nom);
  if (dossier.exists) dossier.delete();
}

/**
 * Copie sur l'iPhone les photos du Mac qui n'y sont pas encore. Si le Mac ne
 * partage pas encore de photos (ancien serveur), on ne fait rien.
 */
export async function synchroniserPhotos(
  adresse: string,
  progression: (fait: number, total: number) => void,
): Promise<{ ajoutees: number; dejaPresentes: number }> {
  const base = `http://${adresse}:${PORT_MAC}`;
  const reponse = await fetch(`${base}/photos`);
  if (!reponse.ok) return { ajoutees: 0, dejaPresentes: 0 };
  const liste: { nom: string }[] = await reponse.json();

  const fichier = (nom: string) => new File(racine(), ...nom.split('/'));
  const manquantes = liste.filter((p) => estPhoto(p.nom) && !fichier(p.nom).exists);
  progression(0, manquantes.length);
  for (const [i, photo] of manquantes.entries()) {
    const destination = fichier(photo.nom);
    destination.parentDirectory.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(`${base}/photo?nom=${encodeURIComponent(photo.nom)}`, destination);
    progression(i + 1, manquantes.length);
  }
  return { ajoutees: manquantes.length, dejaPresentes: liste.length - manquantes.length };
}
