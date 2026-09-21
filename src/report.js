// XozHub.GPT — RAPPORT.md : ce qui a été demandé, et ce qui a été créé.
//
// Un dossier de travail se remplit vite : au bout de trois demandes, on ne sait plus quel
// fichier fait quoi. Ce module tient donc, à la racine du dossier de travail, une page qui
// répond à deux questions : qu'est-ce qu'on a demandé, et qu'est-ce que ça a produit ?
//
// Il est tenu par l'APPLICATION, pas par le modèle : c'est la seule façon qu'il soit
// toujours juste, même quand l'agent oublie ou se trompe. Le rôle de chaque fichier est
// repris de son commentaire d'en-tête (le prompt impose d'en écrire un), donc la ligne
// affichée vient du fichier lui-même et pas d'une invention.
//
//   XOZHUB_RAPPORT=off   coupe le rapport (aucun fichier n'est écrit).

import fs from 'node:fs';
import path from 'node:path';

export const REPORT_FILE = 'RAPPORT.md';

// Les sections gardées : au-delà, les plus anciennes partent. Un rapport qui grossit sans
// fin ne sert plus à rien à personne.
const MAX_SECTIONS = 60;

const HEADER = `# Rapport du projet

Ce fichier est tenu par **XozHub.GPT** : il dit ce qui a été demandé dans ce dossier et ce
que chaque fichier y fait. Il est complété à chaque fois que l'IA crée ou modifie quelque
chose. Tu peux l'éditer ou le supprimer : il sera réécrit au prochain travail.

`;

/** Le rapport est-il actif ? (`XOZHUB_RAPPORT`, même convention que `XOZHUB_RELECTURE`.) */
function isOff() {
  return /^(?:non|off|0|false|jamais)$/i.test(String(process.env.XOZHUB_RAPPORT ?? '').trim());
}

// Ce qui ressemble à un commentaire, dans à peu près toutes les syntaxes. L'ordre compte :
// le premier motif qui donne un texte exploitable gagne.
const COMMENT_FORMS = [
  /^\/\/\s?(.*)$/, // JavaScript, TypeScript, C, Go, Rust, Java, PHP
  /^#(?!\!)\s?(.*)$/, // Python, Ruby, shell, YAML, Markdown, Makefile
  /^--\s?(.*)$/, // SQL, Lua, Haskell
  /^;\s?(.*)$/, // Lisp, INI, assembly
  /^%\s?(.*)$/, // LaTeX, Erlang
  /^<!--\s?(.*?)\s*-->$/, // HTML, XML
  /^\/\*\s?(.*?)\s*\*\/$/, // bloc sur une seule ligne
  /^\*\s?(.*)$/, // suite d'un bloc /* … */
];

// Lignes de commentaire qui ne décrivent pas le fichier : directives d'outils, licences,
// en-têtes techniques. Elles ne disent rien du rôle, donc elles ne sont pas rendues.
const NOISE =
  /^(?:-?\*-|coding[:=]|encoding[:=]|eslint|prettier|@ts-|@flow|noqa\b|type:\s|sourcemappingurl|copyright|\(c\)\s|spdx|licen[cs]e|vim?:|todo\b|fixme\b|shebang)/i;

/**
 * Le rôle d'un fichier, en une phrase : la première ligne de commentaire qui décrit vraiment
 * quelque chose. Renvoie '' quand le fichier n'en a pas.
 */
export function roleOf(content) {
  const lines = String(content ?? '').split('\n').slice(0, 40);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const form of COMMENT_FORMS) {
      const m = form.exec(trimmed);
      if (!m) continue;
      const text = String(m[1] ?? '')
        .replace(/\s*\*\/\s*$/, '')
        .trim();
      // Un vrai rôle : assez long pour vouloir dire quelque chose, et pas une directive.
      if (text.length >= 12 && !NOISE.test(text)) return text.replace(/[.;,\s]+$/, '');
      break; // c'est un commentaire, mais pas un rôle : on passe à la ligne suivante
    }
  }
  return '';
}

/** Caractéristiques d'un fichier, pour la ligne du tableau. */
function describe(rootDir, rel) {
  const abs = path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    return null; // supprimé entre-temps, ou illisible : il ne figure pas au rapport
  }
  // Un binaire ne se lit pas : il est listé, mais sans rôle.
  const binary = content.includes('\u0000');
  return {
    path: String(rel).replace(/\\/g, '/'),
    lines: binary ? 0 : Math.max(1, content.split('\n').length - 1),
    bytes: Buffer.byteLength(content, 'utf8'),
    role: binary ? '' : roleOf(content),
  };
}

const stamp = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Une section du rapport : une demande, sa date, et les fichiers qu'elle a produits. */
function renderSection(request, entries) {
  const lines = [
    `## ${stamp(new Date())} — ${entries.length} fichier${entries.length > 1 ? 's' : ''}`,
    '',
    `**Demande :** ${String(request || '').trim() || '(non précisée)'}`,
    '',
    '| Fichier | Lignes | Taille | Rôle |',
    '| --- | --- | --- | --- |',
  ];
  for (const e of entries) {
    const role = e.role ? e.role.replace(/\|/g, '\\|') : '—';
    const lines_ = e.lines ? String(e.lines) : '—';
    lines.push(`| \`${e.path}\` | ${lines_} | ${e.bytes} o | ${role} |`);
  }
  return lines.join('\n');
}

/** Découpe un rapport existant en sections (`## …`), sans son en-tête. */
function splitSections(text) {
  const parts = String(text ?? '').split(/\n(?=## )/);
  if (!parts.length) return [];
  // Le premier morceau est le titre et le chapeau : on ne garde que les sections.
  return parts.filter((p) => p.trimStart().startsWith('## ')).map((p) => p.trimEnd());
}

/**
 * Écrit (ou met à jour) `RAPPORT.md` à la racine du dossier de travail.
 *
 * La section de la demande EN COURS est remplacée, pas dupliquée : l'appeler à chaque tour
 * ne crée donc jamais deux fois la même entrée. Renvoie le chemin écrit, ou '' si rien n'a
 * changé (aucun fichier, rapport coupé, ou contenu identique).
 */
export function writeReport(rootDir, { request, paths } = {}) {
  if (isOff()) return '';
  const unique = [...new Set((paths || []).map((p) => String(p).trim()).filter(Boolean))];
  if (!unique.length) return '';

  const entries = unique.map((p) => describe(rootDir, p)).filter(Boolean);
  if (!entries.length) return '';
  // Le rapport s'écrit dans son propre dossier : il ne se décrit pas lui-même.
  const kept = entries.filter((e) => path.basename(e.path) !== REPORT_FILE);
  if (!kept.length) return '';

  const file = path.join(rootDir, REPORT_FILE);
  let previous = '';
  try {
    previous = fs.readFileSync(file, 'utf8');
  } catch {
    /* premier rapport dans ce dossier */
  }

  const sections = splitSections(previous);
  const sentence = `**Demande :** ${String(request || '').trim() || '(non précisée)'}`;
  // Même demande que la dernière section : c'est la même entrée, qu'on rafraîchit.
  if (sections.length && sections[sections.length - 1].includes(sentence)) sections.pop();
  sections.push(renderSection(request, kept));

  const out = `${HEADER}${sections.slice(-MAX_SECTIONS).join('\n\n')}\n`;
  if (out === previous) return '';
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out, 'utf8');
  } catch {
    return ''; // dossier en lecture seule : ce n'est pas une raison pour casser un tour
  }
  return file;
}
