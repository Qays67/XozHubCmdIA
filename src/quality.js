// XozHub.GPT — le contrôle qualité du travail livré par l'agent.
//
// Un modèle écrit vite ; l'application, elle, peut regarder ce qui a été écrit. Deux
// vérifications sont faites ici, sans rien demander au modèle :
//   1. les références locales du HTML et du CSS (src, href, url(...)) pointent-elles vers un
//      fichier qui existe vraiment ? Un site livré avec une image ou une page introuvable
//      n'est pas un site fini — et ça, ça se vérifie.
//   2. un contrôle qualité mécanique : la page écrite est relue ligne à ligne (doctype,
//      charset, viewport, titre, lang, header, footer, sections, « alt », texte de
//      remplissage, variables de couleur, « !important », media query, « :focus-visible »,
//      restes de debug). Ce sont exactement les oublis qui font qu'une page a l'air d'un
//      brouillon ; les relever vaut mieux que les répéter dans un prompt ;
//   3. dès que l'agent a écrit quelque chose, il a droit à une relecture juste avant de
//      terminer : on le renvoie sur ses propres fichiers avec la liste de ce qui fait
//      « bâclé » plutôt que « livré » — défauts relevés compris. La liste change selon le
//      travail : le rendu d'une page (design, mobile, finitions) n'est pas jugé comme un
//      script (propreté, cas limites, vérification). S'il reste du bloquant après la
//      première relecture, il en a une seconde — jamais plus.
//
// Rien de tout ça n'appelle le réseau ni n'installe quoi que ce soit : on lit des fichiers.

import fs from 'node:fs';
import path from 'node:path';
import { toOklab } from './theme.js';
import { colorsInText } from './site.js';

const PAGE_RE = /\.(?:html?|xhtml)$/i;
const STYLE_RE = /\.css$/i;

/** Une page web a-t-elle été écrite pendant ce tour ? */
export function isWebWork(paths) {
  return (paths || []).some((p) => PAGE_RE.test(String(p || '').trim()));
}

/** Le tour a-t-il écrit du HTML ou du CSS qu'on peut relire ? */
function isCheckable(p) {
  const file = String(p || '').trim();
  return PAGE_RE.test(file) || STYLE_RE.test(file);
}

// Ce qui n'est pas un fichier du projet : liens externes, ancres, données en ligne…
const NOT_A_FILE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|$)/i;

// src="…", href="…", poster="…" — et url(…) dans les styles, en ligne comme dans un .css.
const ATTR_REF = /(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const CSS_REF = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+))\s*\)/gi;

/** Toutes les références locales d'un contenu (les liens externes sont écartés). */
export function localRefs(content, { media = false } = {}) {
  const out = [];
  const scan = (re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(String(content ?? ''))) !== null) {
      const raw = String(m[1] ?? m[2] ?? m[3] ?? '').trim();
      // Un lien relatif simple, sans protocole, sans ancre, sans requête : un vrai chemin.
      const clean = raw.split('#')[0].split('?')[0].trim();
      if (!clean || NOT_A_FILE.test(clean)) continue;
      out.push(clean);
    }
  };
  if (media) scan(CSS_REF);
  else {
    scan(ATTR_REF);
    scan(CSS_REF);
  }
  return out;
}

/**
 * Vérifie les références locales des fichiers écrits.
 * Renvoie [{ path, missing: [référence, …] }] — une entrée par fichier fautif.
 */
export function checkRefs(rootDir, paths) {
  const problems = [];
  for (const rel of paths || []) {
    if (!isCheckable(rel)) continue;
    const file = path.resolve(rootDir, String(rel));
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // fichier non écrit : le message d'écriture s'en charge déjà
    }
    const media = STYLE_RE.test(String(rel));
    const missing = [];
    for (const ref of localRefs(content, { media })) {
      // Le chemin part du dossier du fichier : « images/logo.svg » depuis mon-site/index.html.
      const target = path.resolve(path.dirname(file), ref.replace(/^[\\/]+/, ''));
      let ok = false;
      try {
        ok = fs.existsSync(target);
      } catch {
        ok = false;
      }
      if (!ok && !missing.includes(ref)) missing.push(ref);
    }
    if (missing.length) problems.push({ path: String(rel), missing });
  }
  return problems;
}

/** Les références introuvables, en lignes lisibles pour le journal et pour l'agent. */
export function describeRefs(problems) {
  return (problems || [])
    .map((p) => `${p.path} → introuvable : ${p.missing.join(', ')}`)
    .join('\n');
}

// La relecture design se coupe avec XOZHUB_RELECTURE=off (non / 0 / jamais).
export const REVIEW_ENABLED = !['off', 'no', 'non', '0', 'false', 'jamais'].includes(
  String(process.env.XOZHUB_RELECTURE ?? '')
    .trim()
    .toLowerCase(),
);

// --------------------------------------------------------------------- contrôle qualité
//
// Ce qui suit ne demande rien au modèle : on lit le fichier écrit et on cherche ce qui
// manque. Un modèle oublie régulièrement le <title>, le viewport, les « alt », la media
// query ou les variables de couleur — pas parce qu'il ne sait pas, mais parce qu'il écrit
// vite. Une liste de défauts concrets, donnée au bon moment, les fait corriger tous.
//
// Deux niveaux : « bloquant » (la page ne peut pas partir comme ça) et « fin » (ça se voit,
// ça fait brouillon). Le niveau décide seulement si l'agent a droit à une seconde relecture.

const PLACEHOLDERS = [
  [/lorem ipsum/i, 'du « Lorem ipsum » est resté dans la page'],
  [/\btexte ici\b/i, '« Texte ici » est resté dans la page'],
  [/\btitre de la page\b/i, '« Titre de la page » est resté dans la page'],
  [/[àa] compl[ée]ter/i, 'un « à compléter » est resté dans la page'],
  [/\bvotre texte\b/i, '« Votre texte » est resté dans la page'],
];

/** Défauts d'une page HTML : structure, accessibilité, partage, contenu. */
function lintPage(content) {
  const found = [];
  const add = (severity, message) => found.push({ severity, message });
  const has = (re) => re.test(content);

  if (!has(/<!doctype html>/i)) add('bloquant', 'pas de « <!doctype html> » en première ligne');
  if (!has(/<meta[^>]*charset/i)) add('bloquant', 'pas de « <meta charset="utf-8"> » : les accents vont casser');
  if (!has(/<meta[^>]*name=["']viewport["']/i)) add('bloquant', 'pas de « <meta name="viewport"> » : la page ne sera pas mobile');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content);
  if (!title || !title[1].trim()) add('bloquant', 'pas de « <title> » rempli : l’onglet et le partage n’ont pas de nom');
  for (const [re, message] of PLACEHOLDERS) if (re.test(content)) add('bloquant', message);
  if (!has(/<html[^>]*\slang=/i)) add('fin', 'pas de « lang » sur <html> : la langue n’est pas déclarée');
  if (!has(/<meta[^>]*name=["']description["']/i)) add('fin', 'pas de « <meta name="description"> » : rien à afficher dans les résultats de recherche');
  if (!has(/property=["']og:/i)) add('fin', 'pas de balises de partage « og: » (titre, description, image)');
  if (!has(/rel=["'](?:icon|shortcut icon|apple-touch-icon)/i)) add('fin', 'pas de favicon');
  const h1 = content.match(/<h1[\s>]/gi) || [];
  if (!h1.length) add('fin', 'pas de <h1> : une page n’a qu’un seul titre principal, il manque');
  else if (h1.length > 1) add('fin', `${h1.length} <h1> : il ne doit y en avoir qu’un`);
  if (!has(/<(?:header|nav)[\s>]/i)) add('fin', 'pas d’<header> ni de <nav>');
  if (!has(/<footer[\s>]/i)) add('fin', 'pas de <footer> : la page se termine dans le vide');
  const sections = (content.match(/<section[\s>]/gi) || []).length;
  if (!sections) add('fin', 'aucune <section> : le contenu est posé à même le <body>');
  else if (sections < 2) add('fin', 'une seule <section> : deux, c’est le minimum pour une page qui raconte quelque chose');
  const imgs = content.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  if (noAlt) add('fin', `${noAlt} image(s) sans « alt » : invisibles pour qui ne voit pas la page`);
  const inline = (content.match(/\sstyle=/gi) || []).length;
  if (inline > 3) add('fin', `${inline} attributs « style="…" » : le style appartient au CSS`);
  return found;
}

/** Défauts d'une feuille de style : palette, cohérence, responsive, finitions. */
function lintCss(content) {
  const found = [];
  const add = (severity, message) => found.push({ severity, message });

  const root = /:root\s*\{([\s\S]*?)\}/i.exec(content);
  const vars = root ? (root[1].match(/--[\w-]+\s*:/g) || []).length : 0;
  if (!root) add('fin', 'pas de bloc « :root » : les couleurs ne sont donc pas centralisées');
  else if (vars < 4) add('fin', `seulement ${vars} variables dans « :root » : une palette en demande 5 ou 6`);

  const body = root ? content.replace(root[0], '') : content;
  const colors = new Set((body.match(/#[0-9a-f]{3,8}\b/gi) || []).map((c) => c.toLowerCase()));
  if (colors.size > 4) add('fin', `${colors.size} couleurs écrites en dur hors « :root » — elles passent en variables`);
  if (/!important/.test(content)) add('fin', 'des « !important » : le signe d’un style qui se bat contre lui-même');
  if (!/@media/.test(content)) add('fin', 'aucune « @media » : la page ne s’adapte pas au mobile');
  if (!/:focus-visible/.test(content)) add('fin', 'pas d’état « :focus-visible » : au clavier, on ne voit pas où on est');
  if (!/box-sizing\s*:\s*border-box/.test(content)) add('fin', 'pas de « box-sizing: border-box » : les largeurs vont déborder');
  const fams = new Set((content.match(/font-family\s*:\s*[^;}]+/gi) || []).map((f) => f.split(':')[1].trim().toLowerCase()));
  if (fams.size > 2) add('fin', `${fams.size} polices différentes déclarées : deux suffisent`);
  if (!/transition/.test(content)) add('fin', 'aucune « transition » : rien ne réagit au survol');
  return found;
}

/** Défauts d'un script : restes de debug, code laissé en chantier. */
function lintScript(content) {
  const found = [];
  const add = (severity, message) => found.push({ severity, message });
  const logs = (content.match(/console\.log\s*\(/g) || []).length;
  if (logs) add('fin', `${logs} « console.log » laissé(s) dans le code`);
  if (/\bdebugger\b/.test(content)) add('bloquant', 'un « debugger » est resté dans le code');
  if (/\bTODO\b|\bFIXME\b/.test(content)) add('fin', 'des « TODO » / « FIXME » laissés dans le code');
  if (/\beval\s*\(/.test(content)) add('fin', 'un « eval(…) » : à remplacer par du code explicite');
  return found;
}

/**
 * Relit les fichiers écrits et renvoie la liste à plat des défauts trouvés :
 * [{ path, severity: 'bloquant' | 'fin', message }].
 */
export function lintPaths(rootDir, paths) {
  const out = [];
  for (const rel of paths || []) {
    const name = String(rel);
    const file = path.resolve(rootDir, name);
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const found = PAGE_RE.test(name)
      ? lintPage(content)
      : STYLE_RE.test(name)
        ? lintCss(content)
        : /\.[cm]?js$/i.test(name)
          ? lintScript(content)
          : [];
    for (const f of found) out.push({ path: name, severity: f.severity, message: f.message });
  }
  return out;
}

/** Une ligne de journal qui résume le contrôle : courte, lisible, jamais un pavé. */
export function lintNotice(findings) {
  const list = findings || [];
  if (!list.length) return '';
  const files = [...new Set(list.map((f) => f.path))];
  const blockers = list.filter((f) => f.severity === 'bloquant').length;
  const detail = list.slice(0, 3).map((f) => f.message).join(' ; ');
  return (
    `🔍 Contrôle qualité : ${list.length} point${list.length > 1 ? 's' : ''} à corriger dans ${files.join(', ')}` +
    `${blockers ? ` (dont ${blockers} bloquant${blockers > 1 ? 's' : ''})` : ''}` +
    ` — ${detail}${list.length > 3 ? ` … et ${list.length - 3} autre${list.length - 3 > 1 ? 's' : ''}` : ''}`
  );
}

// --------------------------------------------------------------------- fidélité des couleurs
//
// Quand on refait un site à partir d'un lien (ou d'une capture), la première chose qui se voit
// quand c'est raté, c'est la couleur : un fond presque noir au lieu de noir, un violet à la
// place de l'indigo. On mesure donc l'écart pour de vrai, dans OKLab — l'espace où la distance
// correspond à ce que l'œil perçoit — et on le dit à l'agent en clair.

const MATCH = 0.03; // en dessous : c'est la même teinte pour l'œil
const CLOSE = 0.12; // en dessous : presque, à corriger (compte pour moitié seulement)

/** Écart perçu entre deux teintes (0 = identiques). */
export function colorDelta(a, b) {
  const A = toOklab(toRgbLocal(a));
  const B = toOklab(toRgbLocal(b));
  return Math.sqrt((A.L - B.L) ** 2 + (A.a - B.a) ** 2 + (A.b - B.b) ** 2);
}

function toRgbLocal(hexColor) {
  const h = String(hexColor).replace('#', '');
  const n = Number.parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tout le texte des fichiers livrés, mis bout à bout. */
export function readAll(rootDir, paths) {
  const out = [];
  for (const rel of paths || []) {
    try {
      out.push(fs.readFileSync(path.resolve(rootDir, String(rel)), 'utf8'));
    } catch {
      /* fichier non lisible : ignoré */
    }
  }
  return out.join('\n');
}

/**
 * Compare la palette livrée à celle du site visé.
 * Renvoie { score, matched: [{ want, hex, delta }], missing: [hex] } — ou null sans cible.
 * Seules les six teintes les plus présentes de la cible comptent : viser les 14, dont celles
 * qui occupent 2 % de la page, n'aurait aucun sens.
 */
export function paletteFidelity(target, text) {
  const want = ((target && target.palette) || []).filter(Boolean).slice(0, 6);
  if (!want.length) return null;
  const have = colorsInText(text);
  const matched = [];
  const missing = [];
  // Le fond et l'accent comptent double : une copie avec le bon gris et le mauvais accent ne
  // ressemble pas à l'original, alors qu'un neutre légèrement à côté ne se voit pas.
  const poids = (hex) => (hex === target.dominant || hex === target.accent ? 2 : 1);
  let gagne = 0;
  let total = 0;
  for (const hex of want) {
    const w = poids(hex);
    total += w;
    let best = null;
    for (const candidat of have) {
      const delta = colorDelta(hex, candidat);
      if (!best || delta < best.delta) best = { hex: candidat, delta };
    }
    if (best && best.delta <= CLOSE) {
      const exact = best.delta <= MATCH;
      matched.push({ want: hex, hex: best.hex, delta: best.delta, exact });
      gagne += w * (exact ? 1 : 0.5);
    } else {
      missing.push(hex);
    }
  }
  const score = total ? Math.round((gagne / total) * 100) : 0;
  return { score, matched, missing, total: want.length };
}

/** Une ligne de journal, courte : le score, puis ce qui ne va pas. */
export function describeFidelity(fidelity) {
  if (!fidelity) return '';
  const proches = fidelity.matched.filter((m) => !m.exact);
  const details = [
    proches.length ? `proches : ${proches.map((m) => `${m.want} → ${m.hex}`).join(', ')}` : '',
    fidelity.missing.length ? `à reprendre : ${fidelity.missing.join(', ')}` : '',
  ].filter(Boolean);
  return `🎯 Fidélité des couleurs : ${fidelity.score} % sur ${fidelity.total} teintes visées${details.length ? ` — ${details.join(' · ')}` : ' — toutes retrouvées'}`;
}

/**
 * Reste-t-il de quoi justifier une seconde relecture ?
 * Oui s'il y a du bloquant, une référence cassée — ou des couleurs encore loin de la cible :
 * une copie dont la palette est fausse n'est pas une copie.
 */
export function needsSecondReview(findings, refProblems = [], fidelity = null) {
  if ((refProblems || []).length) return true;
  if (fidelity && fidelity.score < 80) return true;
  return (findings || []).some((f) => f.severity === 'bloquant');
}

/**
 * Ce qui fait qu'une page livrée a l'air finie, et pas laissée en brouillon.
 * Cette liste part telle quelle au modèle, juste avant qu'il termine.
 */
const DESIGN_CHECKS = [
  'la palette : les couleurs viennent toutes de variables CSS déclarées dans « :root » — un fond choisi, une couleur d’accent franche, un deuxième ton pour les titres ou les badges, un vert de succès, un corail d’erreur, deux neutres de texte. Aucune couleur écrite en dur ailleurs, aucun bleu de lien ni gris par défaut ;',
  'l’espacement : les marges et les paddings suivent une échelle fixe (4, 8, 12, 16, 24, 32, 48, 64, 96 px). Aucune valeur au hasard, aucun texte collé aux bords, une section qui respire ;',
  'la typographie : une seule police pour le texte (plus une pour les titres si utile) avec un repli « system-ui, sans-serif », des tailles cohérentes en rem, des gros titres en « clamp() », un interligne de 1.6 pour les paragraphes ;',
  'la hiérarchie : un seul titre principal, des sous-titres courts, un œil qui sait où regarder — bouton d’action plein et coloré, cartes pour les contenus répétés, pied de page plus sombre que le reste ;',
  'le mobile : rien ne déborde horizontalement, le menu se replie derrière un bouton, le texte fait au moins 16 px, les cibles tactiles au moins 44 px ;',
  'les finitions : transitions douces de 150 à 250 ms sur hover et focus, un « :focus-visible » bien visible, un alt sur chaque image, un aria-label sur les icônes seules, un <title> et une meta description ;',
  'la propreté du code : variables, classes nommées clairement, indentation régulière, aucun « !important », aucun style en double, aucun console.log ni bloc commenté laissé en place ;',
  'le contenu : du vrai texte en français, crédible et à la bonne longueur. Aucun « Lorem ipsum », aucun « Texte ici », aucun lien mort, aucun bouton sans effet.',
];

/**
 * Ce qui sépare un code livré d'un code bricolé : la même exigence que pour une page,
 * appliquée à un script, un module, un outil.
 */
const CODE_CHECKS = [
  'ça tourne vraiment : un bloc « run » exécute le code, le test ou la commande, et la sortie le montre. Aucun « ça devrait marcher » — c’est exécuté, ou ce n’est pas fini ;',
  'le code est complet et lisible : noms clairs, indentation régulière, fonctions courtes, aucun reste de debug (console.log, print, TODO), aucun code mort, aucun bloc commenté laissé en place ;',
  'les cas limites sont traités : entrée vide, fichier absent, valeur nulle, erreur de commande — gérés franchement, jamais cachés par un try/catch silencieux ;',
  'rien n’est supposé installé : chaque dépendance utilisée est déclarée, chaque outil est vérifié avant d’être appelé ;',
  'les erreurs réelles reçues pendant ce travail sont corrigées, pas contournées ;',
  'rien de plus que la demande : aucun fichier bonus, aucune variante, aucun « prochaines étapes » — juste le travail demandé, fini.',
];

/** Le texte du bandeau affiché pendant la relecture. */
export function reviewNotice(paths) {
  return isWebWork(paths)
    ? '✎ Relecture du rendu (design, mobile, finitions) avant de te rendre la main…'
    : '✎ Relecture du travail livré (propreté, cas limites, vérification) avant de te rendre la main…';
}

/**
 * Le rappel envoyé à l'agent avant qu'il termine : il relit ses propres fichiers et corrige.
 * `problems` (références introuvables) passe en tête — c'est du concret, pas un conseil.
 */
export function reviewMessage(paths, problems = [], findings = [], extra = '') {
  const files = (paths || []).map((p) => String(p)).filter(Boolean);
  const web = isWebWork(files);
  const checks = web ? DESIGN_CHECKS : CODE_CHECKS;
  const lines = [
    '[Relecture demandée par l’application — à faire AVANT de terminer]',
    files.length ? `Fichiers écrits dans ce tour : ${files.join(', ')}.` : '',
    web
      ? 'Relis vraiment ce que tu as écrit (bloc « run » : « type index.html ») et corrige ce qui'
      : 'Relis vraiment ce que tu as écrit (bloc « run » : « type <fichier> », ou exécute-le) et corrige ce qui',
    `n’est pas au niveau d’un ${web ? 'site livré' : 'travail livré'}. Passe la liste dans l’ordre, rien n’est facultatif :`,
    ...checks.map((c, i) => `  ${i + 1}. ${c}`),
  ];
  if (extra) lines.push('', extra);
  if (findings.length) {
    lines.push(
      '',
      'Défauts relevés par l’application en relisant tes fichiers — chaque ligne se corrige :',
      ...findings.map((f) => `  ${f.path} : ${f.message}${f.severity === 'bloquant' ? ' [BLOQUANT]' : ''}`),
    );
  }
  if (problems.length) {
    lines.push(
      '',
      'Références introuvables — à corriger d’abord (une référence qui ne mène à rien, c’est une',
      'page cassée) :',
      ...problems.map((p) => `  ${p.path} : ${p.missing.join(', ')}`),
    );
  }
  lines.push(
    '',
    'Corrige uniquement ce qui ne va pas, avec des blocs « edit » : une paire ANCIEN / NOUVEAU par',
    'défaut, avec 4 à 8 lignes de contexte pour que le passage soit unique. C’est le moyen le plus',
    'rapide et le plus sûr — un fichier réécrit en entier pour trois lignes, c’est du code perdu au',
    'passage. Un bloc « write » seulement si le fichier doit changer de fond en comble.',
    'Dans la MÊME réponse : vérifie ce que tu viens de corriger (un bloc « run » — lecture du fichier,',
    'serveur local ou test). Une correction qu’on n’a pas revue n’est pas une correction.',
    'Si tout est déjà bon, ne touche à rien : dis juste ce que tu as vérifié, puis termine par',
    'TERMINÉ seul sur la dernière ligne.',
  );
  return lines.filter((l) => l !== '').join('\n');
}
