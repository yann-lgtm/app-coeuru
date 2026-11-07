#!/usr/bin/env node
/**
 * Petit serveur à lancer sur le Mac : il met à disposition de l'app « Lecteur »
 * deux dossiers du Bureau, que le bouton « ⟳ Mac » copie sur l'iPhone par le
 * Wi-Fi :
 *   - « Musique pour iPhone » (un sous-dossier = un thème),
 *   - « Photos pour iPhone »  (un sous-dossier = un album).
 *
 *   node serveur-mac/serveur.mjs
 *
 * Aucune dépendance : seulement Node.
 */
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { hostname, networkInterfaces } from 'node:os';
import { extname, join } from 'node:path';

const PORT = 8090;
const BUREAU = join(process.env.HOME, 'Desktop');

const TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.caf': 'audio/x-caf',
  '.flac': 'audio/flac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
};

// Ce que partage chaque adresse : le dossier, et les extensions acceptées.
const COLLECTIONS = {
  musique: {
    dossier: join(BUREAU, 'Musique pour iPhone'),
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.aif', '.aiff', '.caf', '.flac'],
  },
  photos: {
    dossier: join(BUREAU, 'Photos pour iPhone'),
    extensions: ['.jpg', '.jpeg', '.png', '.heic', '.webp'],
  },
};

/**
 * Liste récursive. Les sous-dossiers peuvent être des alias (liens
 * symboliques) vers un disque externe ; un disque débranché, ou un dossier
 * absent, est simplement ignoré.
 */
function lister(collection, dossier = collection.dossier, prefixe = '') {
  let noms;
  try {
    noms = readdirSync(dossier);
  } catch {
    return [];
  }
  const resultat = [];
  for (const nom of noms) {
    if (nom.startsWith('.')) continue;
    let infos;
    try {
      infos = statSync(join(dossier, nom));
    } catch {
      continue;
    }
    if (infos.isDirectory()) {
      resultat.push(...lister(collection, join(dossier, nom), `${prefixe}${nom}/`));
    } else if (collection.extensions.includes(extname(nom).toLowerCase())) {
      resultat.push({ nom: `${prefixe}${nom}`, octets: infos.size });
    }
  }
  return resultat;
}

function envoyerListe(reponse, collection, libelle) {
  const liste = lister(collection);
  console.log(`→ liste ${libelle} demandée (${liste.length})`);
  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(liste));
}

function envoyerFichier(reponse, collection, nom) {
  // Seuls les noms exacts de la liste sont servis : impossible de sortir du
  // dossier avec un nom du type « ../../secret ».
  const present = lister(collection).find((m) => m.nom === nom);
  if (!present) {
    reponse.writeHead(404).end('Fichier introuvable');
    return;
  }
  console.log(`→ envoi de « ${nom} »`);
  reponse.writeHead(200, {
    'Content-Type': TYPES[extname(nom).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': present.octets,
  });
  createReadStream(join(collection.dossier, nom)).pipe(reponse);
}

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url, 'http://local');
  const nom = url.searchParams.get('nom') ?? '';

  // Adresses d'origine de la musique, gardées pour les versions déjà installées.
  if (url.pathname === '/morceaux') return envoyerListe(reponse, COLLECTIONS.musique, 'musique');
  if (url.pathname === '/fichier') return envoyerFichier(reponse, COLLECTIONS.musique, nom);

  if (url.pathname === '/photos') return envoyerListe(reponse, COLLECTIONS.photos, 'photos');
  if (url.pathname === '/photo') return envoyerFichier(reponse, COLLECTIONS.photos, nom);

  reponse.writeHead(404).end();
});

serveur.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`Musique : ${lister(COLLECTIONS.musique).length} morceaux (${COLLECTIONS.musique.dossier})`);
  console.log(`Photos : ${lister(COLLECTIONS.photos).length} photos (${COLLECTIONS.photos.dossier})`);
  console.log(`Dans l'app, adresse du Mac : ${hostname().replace(/\.local$/, '')}.local  (ou ${ips.join(', ')})`);
  console.log('Laisse cette fenêtre ouverte pendant la synchro. Ctrl+C pour arrêter.');
});
