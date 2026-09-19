// XozHub.GPT — de vraies photos, prises sur internet, mais vérifiées et rangées dans le projet.
//
// Un site sans image a l'air d'un gabarit. Mais un lien direct vers une photo trouvée au hasard
// casse au premier jour, et rien ne dit qui l'a prise ni sous quelle licence. Ici, l'application
// fait le travail entier :
//
//   1. elle CHERCHE des photos réutilisables (Openverse, puis Wikimedia Commons en secours) ;
//   2. elle les TÉLÉCHARGE et les VÉRIFIE : bon type, vraies dimensions, taille plausible. Une
//      image qu'on ne peut pas lire n'est pas annoncée comme récupérée ;
//   3. elle les range dans le projet (assets/images/ par défaut) sous un nom propre et sans
//      accent, pour que le chemin tienne partout ;
//   4. elle écrit les CRÉDITS : auteur, licence, page d'origine — obligatoire pour du CC, et
//      c'est ce qui se fait quand on emprunte le travail de quelqu'un.
//
//   ```photo bouquet de fleurs
//   ```photo 4 atelier de menuiserie
//
// L'agent n'a plus qu'à écrire <img src="assets/images/bouquet-de-fleurs-1.jpg" alt="…">.

import fs from 'node:fs';
import path from 'node:path';

// ```photo [nombre] recherche
const OPEN = /^(`{3,})(?:photo|photos|image-libre|images-libres|photo-libre|unsplash|pixabay)[\s:]+(.+?)\s*$/i;

const TIMEOUT_MS = 20_000;
const MAX_IMAGES = 6;
const DEFAULT_COUNT = 3;
const MIN_BYTES = 3_000; // en dessous, ce n'est pas une photo
const MAX_BYTES = 8_000_000;
// Les images vont toujours dans « <site>/assets/images », et le chemin rendu à l'agent est
// toujours relatif au dossier du site — celui qu'il écrira dans ses <img>.
const IMAGES_DIR = 'assets/images';
const UA = 'XozHub.GPT/1.0 (agent de dev ; images libres)';

function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

/** « Bouquet de fleurs » → « bouquet-de-fleurs » : un nom de fichier qui passe partout. */
export function slug(text, max = 48) {
  const base = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'photo').slice(0, max).replace(/-+$/, '');
}

/**
 * Repère les blocs « photo » :
 *   ```photo 3 bouquet de fleurs -> mon-site
 * `count` = nombre d'images, `site` = dossier du site (facultatif : "-> mon-site").
 */
export function parsePhotos(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (!open) continue;
    ticks = open[1].length;
    let rest = String(open[2]).trim().replace(/^["'`]|["'`]$/g, '');
    // Le dossier du site se met après une flèche : c'est là que vont les photos.
    let site = '';
    const fleche = /\s*(?:->|=>|→)\s*([\w./\\-]*\w)\s*$/.exec(rest);
    if (fleche) {
      site = fleche[1].replace(/[\\/]+$/g, '').replace(/^[.\\/]+/, '');
      rest = rest.slice(0, fleche.index).trim();
    }
    let count = DEFAULT_COUNT;
    const lead = /^(\d{1,2})\s+(.+)$/.exec(rest);
    if (lead) {
      count = Math.min(MAX_IMAGES, Math.max(1, Number(lead[1])));
      rest = lead[2];
    }
    if (rest) out.push({ query: rest, count, site, siteExplicit: Boolean(site) });
  }
  return out;
}

/** Le texte sans les blocs « photo ». */
export function stripPhotos(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (open) {
      ticks = open[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Le texte avec les blocs « photo » remplacés par une marque. */
export function foldPhotos(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (recherche d’images envoyée) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

// --------------------------------------------------------------------- recherche

async function getJson(url, { signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

const LICENCES = {
  cc0: 'CC0 1.0 (domaine public)',
  pdm: 'domaine public',
  by: 'CC BY',
  'by-sa': 'CC BY-SA',
  'by-nc': 'CC BY-NC',
  'by-nd': 'CC BY-ND',
  'by-nc-sa': 'CC BY-NC-SA',
  'by-nc-nd': 'CC BY-NC-ND',
};

/** Openverse : agrégateur d'images sous licence libre, avec l'auteur et la licence. */
async function searchOpenverse(query, count, { signal } = {}) {
  const url =
    'https://api.openverse.org/v1/images/?' +
    new URLSearchParams({
      q: query,
      page_size: String(Math.min(20, count * 4)),
      // Réutilisables : usage commercial et modification autorisés par défaut.
      license_type: 'commercial,modification',
      mature: 'false',
    });
  const json = await getJson(url, { signal });
  const results = Array.isArray(json.results) ? json.results : [];
  return results
    .filter((r) => r && r.url)
    .map((r) => ({
      url: r.url,
      title: String(r.title || r.foreign_landing_url || 'photo').slice(0, 120),
      author: String(r.creator || 'auteur inconnu').slice(0, 80),
      license: LICENCES[String(r.license).toLowerCase()] || String(r.license || 'licence inconnue'),
      page: r.foreign_landing_url || '',
      source: r.source ? `Openverse · ${r.source}` : 'Openverse',
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
    }));
}

/** Wikimedia Commons, en secours : très fiable, mais moins « photo de banque d'images ». */
async function searchCommons(query, count, { signal } = {}) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6', // les fichiers
      gsrlimit: String(Math.min(20, count * 4)),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '1600',
      format: 'json',
      origin: '*',
    });
  const json = await getJson(url, { signal });
  const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
  return pages
    .map((p) => {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info) return null;
      const meta = info.extmetadata || {};
      const texte = (v) => String((v && v.value) || '').replace(/<[^>]*>/g, '').slice(0, 80);
      const licence = texte(meta.LicenseShortName) || 'voir la page';
      return {
        url: info.thumburl || info.url,
        title: String(p.title || 'photo').replace(/^File:/, '').slice(0, 120),
        author: texte(meta.Artist) || 'auteur inconnu',
        license: licence,
        page: info.descriptionurl || '',
        source: 'Wikimedia Commons',
        width: Number(info.thumbwidth) || Number(info.width) || 0,
        height: Number(info.thumbheight) || Number(info.height) || 0,
      };
    })
    .filter(Boolean);
}

/**
 * Cherche des photos réutilisables. Openverse d'abord (banques d'images, licences claires),
 * Wikimedia Commons ensuite : sur un thème précis, l'un des deux répond toujours.
 */
export async function searchPhotos(query, count, { signal } = {}) {
  const erreurs = [];
  for (const source of [searchOpenverse, searchCommons]) {
    try {
      const found = await source(query, count, { signal });
      if (found.length) return { ok: true, results: found, error: '' };
      erreurs.push('aucun résultat');
    } catch (err) {
      erreurs.push(err.message);
    }
  }
  return { ok: false, results: [], error: erreurs.join(' / ') };
}

// --------------------------------------------------------------------- téléchargement

const MAGIC = [
  [[0xff, 0xd8, 0xff], '.jpg', 'image/jpeg'],
  [[0x89, 0x50, 0x4e, 0x47], '.png', 'image/png'],
  [[0x47, 0x49, 0x46], '.gif', 'image/gif'],
];

/** Reconnaît une image par ses premiers octets — plus sûr que l'extension ou le type annoncé. */
function sniff(buffer) {
  for (const [sig, ext, mime] of MAGIC) {
    if (sig.every((b, i) => buffer[i] === b)) return { ext, mime };
  }
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

/** Télécharge une photo et vérifie que c'en est vraiment une. */
async function download(url, target, { signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA, accept: 'image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (type && !type.startsWith('image/')) throw new Error(`ce n’est pas une image (${type})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < MIN_BYTES) throw new Error(`fichier trop petit (${buffer.length} octets)`);
    if (buffer.length > MAX_BYTES) throw new Error(`fichier trop lourd (${Math.round(buffer.length / 1024)} Ko)`);
    const kind = sniff(buffer);
    if (!kind) throw new Error('format d’image non reconnu');
    const file = target.endsWith(kind.ext) ? target : `${target}${kind.ext}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    return { file, bytes: buffer.length, ext: kind.ext };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** Ajoute les crédits des images empruntées, sans jamais réécrire une ligne déjà écrite. */
function writeCredits(dir, credits) {
  const file = path.join(dir, 'CREDITS.md');
  let existing = '';
  try {
    existing = fs.readFileSync(file, 'utf8');
  } catch {
    existing = '# Crédits des images\n\nImages récupérées via Openverse et Wikimedia Commons, sous licence libre.\n\n| Fichier | Titre | Auteur | Licence | Source |\n| --- | --- | --- | --- | --- |\n';
  }
  const lignes = [];
  for (const c of credits) {
    if (existing.includes(`\`${c.file}\``)) continue;
    const lien = c.page ? `[page](${c.page})` : c.source;
    lignes.push(`| \`${c.file}\` | ${c.title.replace(/\|/g, '/')} | ${c.author.replace(/\|/g, '/')} | ${c.license} | ${lien} |`);
  }
  if (lignes.length) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, `${existing.trimEnd()}\n${lignes.join('\n')}\n`, 'utf8');
  }
  return file;
}

/**
 * Le travail complet : chercher, télécharger, vérifier, créditer.
 * Renvoie [{ query, ok, dir, images: [{ path, bytes, credit }], error }].
 */
export async function fetchPhotos(rootDir, wants, { signal } = {}) {
  const out = [];
  const credits = [];
  for (const want of wants || []) {
    // Le dossier du site : celui donné dans le bloc, sinon celui qu'on est en train de construire.
    const site = String(want.site || '').replace(/[\\/]+$/, '');
    const dossier = site ? `${site}/${IMAGES_DIR}` : IMAGES_DIR;
    const dir = path.join(rootDir, dossier);
    const entry = { query: want.query, ok: false, dir: dossier, site, images: [], error: '' };
    const search = await searchPhotos(want.query, want.count, { signal });
    if (!search.ok) {
      entry.error = `aucune photo trouvée (${search.error})`;
      out.push(entry);
      continue;
    }
    const base = slug(want.query);
    let index = 0;
    for (const candidat of search.results) {
      if (entry.images.length >= want.count) break;
      index += 1;
      const cible = path.join(dir, `${base}-${index}`);
      try {
        const got = await download(candidat.url, cible, { signal });
        // Toujours relatif au dossier du site : c'est ce chemin que l'agent écrit dans son HTML.
        const rel = `${IMAGES_DIR}/${path.basename(got.file)}`;
        const credit = { ...candidat, file: path.basename(got.file) };
        credits.push(credit);
        entry.images.push({
          path: rel,
          bytes: got.bytes,
          width: candidat.width,
          height: candidat.height,
          credit,
        });
        entry.ok = true;
      } catch {
        /* ce candidat ne passe pas : on essaie le suivant, sans rien dire de faux */
      }
    }
    if (!entry.ok) entry.error = entry.error || 'aucune image téléchargeable';
    out.push(entry);
  }
  if (credits.length) {
    try {
      // Les crédits vivent à côté des images du site — un seul endroit à regarder.
      const dossier = out.find((r) => r.ok)?.dir || IMAGES_DIR;
      writeCredits(path.join(rootDir, dossier), credits);
    } catch {
      /* sans crédits écrits, les fichiers restent utilisables */
    }
  }
  return out;
}

/** Une ligne de journal par recherche : ce qui a vraiment été récupéré. */
export function describePhotos(results) {
  return (results || []).map((r) => {
    if (!r.ok) return `« ${r.query} » — rien récupéré : ${r.error}`;
    const details = r.images
      .map((i) => `${path.basename(i.path)}${i.width && i.height ? ` (${i.width}×${i.height})` : ''}`)
      .join(', ');
    return `« ${r.query} » — ${r.images.length} photo(s) dans ${r.dir} : ${details}`;
  });
}

/** Le paquet donné au modèle : les chemins locaux à utiliser, et à qui elles appartiennent. */
export function photosMessage(results) {
  const parts = [];
  for (const r of results || []) {
    if (!r.ok) {
      parts.push(
        `[Photos « ${r.query} » : rien n’a pu être récupéré (${r.error}).]`,
        'Ne mets AUCUNE image à cette place : dessine un SVG en ligne ou un dégradé CSS, et ne prétends pas avoir une photo.',
      );
      continue;
    }
    parts.push(
      `[Photos « ${r.query} » téléchargées et VÉRIFIÉES${r.site ? ` dans ${r.site}/` : ''} — utilise ces chemins tels quels]`,
      ...r.images.map(
        (i) =>
          `  ${i.path}${i.width && i.height ? ` — ${i.width}×${i.height}` : ''} (${Math.round(i.bytes / 1024)} Ko) — « ${i.credit.title} » par ${i.credit.author}, ${i.credit.license}`,
      ),
      r.site
        ? `  Ces chemins sont relatifs au dossier du site « ${r.site} » : ta page vit là aussi, donc src="${r.images[0] ? r.images[0].path : IMAGES_DIR + '/…'}" est correct.`
        : `  Ces chemins sont relatifs au dossier de travail : ta page doit être à la racine (index.html), sinon src ne pointera vers rien.`,
      `  Les crédits sont écrits dans ${r.dir}/CREDITS.md — laisse ce fichier en place.`,
      '  Écris tes <img> avec ces chemins locaux et un alt qui décrit vraiment la photo.',
    );
  }
  return parts.join('\n');
}
