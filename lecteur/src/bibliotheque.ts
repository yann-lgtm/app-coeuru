import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * La bibliothèque, c'est simplement le dossier « Documents » de l'app.
 * Tout fichier audio qui s'y trouve est lu, quel que soit le chemin par
 * lequel il est arrivé : bouton « ＋ », synchro avec le Mac, AirDrop, app
 * Fichiers, ou glisser-déposer depuis le Finder du Mac.
 *
 * Un sous-dossier = un thème (« Chakras », « Fréquences Sacrées »…).
 * Les fichiers posés à la racine vont dans le thème « Mes morceaux ».
 */

const EXTENSIONS_AUDIO = ['mp3', 'wav', 'm4a', 'aac', 'aif', 'aiff', 'caf', 'flac'];
const CLE_POSITIONS = 'positions-de-lecture';
export const THEME_RACINE = 'Mes morceaux';

export type Morceau = {
  /** Chemin relatif au dossier Documents, ex. « Chakras/chakra-racine.mp3 ». Sert d'identifiant. */
  nom: string;
  theme: string;
  titre: string;
  format: string;
  uri: string;
  tailleMo: number;
};

function extensionDe(nom: string): string {
  const point = nom.lastIndexOf('.');
  return point === -1 ? '' : nom.slice(point + 1).toLowerCase();
}

function estAudio(nom: string): boolean {
  return EXTENSIONS_AUDIO.includes(extensionDe(nom));
}

/** « 01 devenir-un-male-alpha.mp3 » → « devenir un male alpha » */
function titreDe(nom: string): string {
  const sansExtension = nom.replace(/\.[^.]+$/, '');
  return sansExtension.replace(/^\d+\s+/, '').replace(/[-_]+/g, ' ').trim();
}

/** Fichier à l'emplacement « theme/nom.mp3 » sous Documents. */
function fichierRelatif(chemin: string): File {
  return new File(Paths.document, ...chemin.split('/'));
}

/** Évite d'écraser un morceau existant : « titre.mp3 » → « titre (2).mp3 ». */
function destinationLibre(nom: string): File {
  let destination = new File(Paths.document, nom);
  let n = 2;
  while (destination.exists) {
    const ext = extensionDe(nom);
    const base = nom.replace(/\.[^.]+$/, '');
    destination = new File(Paths.document, `${base} (${n}).${ext}`);
    n += 1;
  }
  return destination;
}

/**
 * iOS dépose les fichiers reçus par AirDrop ou « Ouvrir dans… » dans
 * Documents/Inbox. On les remonte dans Documents pour qu'ils rejoignent
 * la liste.
 */
export async function rangerBoiteDeReception(): Promise<void> {
  const inbox = new Directory(Paths.document, 'Inbox');
  if (!inbox.exists) return;
  for (const element of inbox.list()) {
    if (element instanceof File && estAudio(element.name)) {
      // move() et copy() sont asynchrones depuis le SDK 57 : sans await, la
      // suite du code courait avant la fin du déplacement.
      await element.move(destinationLibre(element.name));
    }
  }
}

function parcourir(dossier: Directory, prefixe: string, resultat: Morceau[]): void {
  for (const element of dossier.list()) {
    if (element instanceof Directory) {
      if (prefixe === '' && element.name === 'Inbox') continue;
      parcourir(element, `${prefixe}${element.name}/`, resultat);
    } else if (element instanceof File && estAudio(element.name)) {
      const nom = `${prefixe}${element.name}`;
      resultat.push({
        nom,
        theme: prefixe === '' ? THEME_RACINE : prefixe.split('/')[0],
        titre: titreDe(element.name),
        format: extensionDe(element.name).toUpperCase(),
        uri: element.uri,
        tailleMo: Math.round((element.info().size ?? 0) / 1_000_000),
      });
    }
  }
}

/** Tous les morceaux, triés par thème puis par titre (l'ordre de lecture « suivant »). */
/** Tous les morceaux du dossier. Appeler rangerBoiteDeReception() avant. */
export function listerMorceaux(): Morceau[] {
  const morceaux: Morceau[] = [];
  parcourir(Paths.document, '', morceaux);
  const rangTheme = (t: string) => (t === THEME_RACINE ? '' : t);
  return morceaux.sort(
    (a, b) =>
      rangTheme(a.theme).localeCompare(rangTheme(b.theme), 'fr') ||
      a.titre.localeCompare(b.titre, 'fr', { numeric: true }),
  );
}

const EXTENSION_PAR_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

/**
 * Le nom transmis par l'app Fichiers n'a pas toujours d'extension
 * (« 06-Back-in-Black »). On la retrouve alors via l'adresse du fichier
 * copié ou son type, sinon le morceau n'apparaîtrait jamais dans la liste.
 */
function nomAvecExtension(asset: DocumentPicker.DocumentPickerAsset): string {
  if (estAudio(asset.name)) return asset.name;
  const depuisUri = extensionDe(decodeURIComponent(asset.uri.split('/').pop() ?? ''));
  const extension = EXTENSIONS_AUDIO.includes(depuisUri)
    ? depuisUri
    : EXTENSION_PAR_TYPE[asset.mimeType ?? ''] ?? 'mp3';
  return `${asset.name}.${extension}`;
}

export type BilanImport = { ajoutes: string[]; echecs: { nom: string; raison: string }[] };

/**
 * Ouvre le sélecteur de l'app Fichiers (iCloud Drive compris) et copie les
 * morceaux choisis dans l'app. Renvoie null si l'utilisateur a annulé.
 *
 * `pendant` est appelé une fois le choix fait, avant la copie : les fichiers
 * iCloud peuvent mettre quelques secondes à arriver, l'écran doit le dire.
 */
export async function importerDepuisFichiers(pendant?: (nombre: number) => void): Promise<BilanImport | null> {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (resultat.canceled) return null;
  pendant?.(resultat.assets.length);

  const bilan: BilanImport = { ajoutes: [], echecs: [] };
  for (const asset of resultat.assets) {
    try {
      const source = new File(asset.uri);
      const destination = destinationLibre(nomAvecExtension(asset));
      // copy() est asynchrone : on attend la fin avant d'effacer la copie
      // temporaire, sinon la copie échouait en silence.
      await source.copy(destination);
      try {
        source.delete();
      } catch {
        // La copie temporaire du sélecteur sera de toute façon vidée par iOS.
      }
      bilan.ajoutes.push(asset.name);
    } catch (e) {
      bilan.echecs.push({ nom: asset.name, raison: e instanceof Error ? e.message : String(e) });
    }
  }
  return bilan;
}

/* Synchro avec le Mac (voir serveur-mac/serveur.mjs). */

const CLE_ADRESSE_MAC = 'adresse-du-mac';
const PORT_MAC = 8090;

export async function lireAdresseMac(): Promise<string | null> {
  return AsyncStorage.getItem(CLE_ADRESSE_MAC);
}

export async function enregistrerAdresseMac(adresse: string): Promise<void> {
  await AsyncStorage.setItem(CLE_ADRESSE_MAC, adresse.trim());
}

/**
 * Copie sur l'iPhone les morceaux partagés par le Mac qui n'y sont pas
 * encore, en recréant leurs dossiers de thème. Rien n'est effacé : un
 * morceau retiré sur le Mac reste sur le téléphone (on le retire dans l'app
 * par un appui long).
 */
export async function synchroniserAvecMac(
  adresse: string,
  progression: (fait: number, total: number) => void,
): Promise<{ ajoutes: number; dejaPresents: number }> {
  const base = `http://${adresse}:${PORT_MAC}`;

  const controle = new AbortController();
  const delai = setTimeout(() => controle.abort(), 6000);
  let liste: { nom: string }[];
  try {
    const reponse = await fetch(`${base}/morceaux`, { signal: controle.signal });
    liste = await reponse.json();
  } finally {
    clearTimeout(delai);
  }

  const manquants = liste.filter((m) => estAudio(m.nom) && !fichierRelatif(m.nom).exists);
  progression(0, manquants.length);
  for (const [i, morceau] of manquants.entries()) {
    const destination = fichierRelatif(morceau.nom);
    destination.parentDirectory.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(`${base}/fichier?nom=${encodeURIComponent(morceau.nom)}`, destination);
    progression(i + 1, manquants.length);
  }
  return { ajoutes: manquants.length, dejaPresents: liste.length - manquants.length };
}

export function supprimerMorceau(morceau: Morceau): void {
  new File(morceau.uri).delete();
}

/* Mémoire de l'endroit où chaque morceau a été arrêté (en secondes). */

export async function lirePositions(): Promise<Record<string, number>> {
  const brut = await AsyncStorage.getItem(CLE_POSITIONS);
  return brut ? JSON.parse(brut) : {};
}

export async function enregistrerPosition(nom: string, secondes: number): Promise<void> {
  const positions = await lirePositions();
  positions[nom] = secondes;
  await AsyncStorage.setItem(CLE_POSITIONS, JSON.stringify(positions));
}
