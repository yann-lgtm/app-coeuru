#!/usr/bin/env node
/**
 * Petit serveur à lancer sur le Mac : il met à disposition de l'app « Lecteur »
 * les morceaux d'un dossier, pour que le bouton « Synchro Mac » les copie sur
 * l'iPhone par le Wi-Fi.
 *
 *   node serveur-mac/serveur.mjs                      → dossier « Musique pour iPhone » du Bureau
 *   node serveur-mac/serveur.mjs "/chemin/du/dossier" → un autre dossier
 *
 * Aucune dépendance : seulement Node.
 */
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { hostname, networkInterfaces } from 'node:os';
import { extname, join } from 'node:path';

const PORT = 8090;
const DOSSIER = process.argv[2] ?? join(process.env.HOME, 'Desktop', 'Musique pour iPhone');
const EXTENSIONS_AUDIO = ['.mp3', '.wav', '.m4a', '.aac', '.aif', '.aiff', '.caf', '.flac'];
const TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.caf': 'audio/x-caf',
  '.flac': 'audio/flac',
};

/**
 * Liste récursive : un sous-dossier = un thème dans l'app. Les sous-dossiers
 * peuvent être des alias (liens symboliques) vers un disque externe ; un
 * disque débranché est simplement ignoré.
 */
function morceaux(dossier = DOSSIER, prefixe = '') {
  const resultat = [];
  for (const nom of readdirSync(dossier)) {
    if (nom.startsWith('.')) continue;
    let infos;
    try {
      infos = statSync(join(dossier, nom));
    } catch {
      continue;
    }
    if (infos.isDirectory()) {
      resultat.push(...morceaux(join(dossier, nom), `${prefixe}${nom}/`));
    } else if (EXTENSIONS_AUDIO.includes(extname(nom).toLowerCase())) {
      resultat.push({ nom: `${prefixe}${nom}`, octets: infos.size });
    }
  }
  return resultat;
}

const serveur = createServer((requete, reponse) => {
  const url = new URL(requete.url, 'http://local');

  if (url.pathname === '/morceaux') {
    const liste = morceaux();
    console.log(`→ liste demandée (${liste.length} morceaux)`);
    reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify(liste));
    return;
  }

  if (url.pathname === '/fichier') {
    // Seuls les noms exacts de la liste sont servis : impossible de sortir du
    // dossier avec un nom du type « ../../secret ».
    const nom = url.searchParams.get('nom') ?? '';
    const present = morceaux().find((m) => m.nom === nom);
    if (!present) {
      reponse.writeHead(404).end('Morceau introuvable');
      return;
    }
    console.log(`→ envoi de « ${nom} »`);
    reponse.writeHead(200, {
      'Content-Type': TYPES[extname(nom).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': present.octets,
    });
    createReadStream(join(DOSSIER, nom)).pipe(reponse);
    return;
  }

  reponse.writeHead(404).end();
});

serveur.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`Dossier partagé : ${DOSSIER}`);
  console.log(`${morceaux().length} morceaux disponibles.`);
  console.log(`Dans l'app, adresse du Mac : ${hostname().replace(/\.local$/, '')}.local  (ou ${ips.join(', ')})`);
  console.log('Laisse cette fenêtre ouverte pendant la synchro. Ctrl+C pour arrêter.');
});
