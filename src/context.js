// XozHub.GPT — ce que l'agent sait du projet avant même qu'on lui parle.
// Collecte : technos repérées, git, package.json, début du README, aperçu de l'arborescence.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const IGNORED = new Set([
  'node_modules',
  '.git',
  '.cache',
  'dist',
  'build',
  'out',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'target',
  'vendor',
]);

const MAX_CHARS = 3000;
const MAX_TREE_ENTRIES = 60;

/** Fichier de mémoire durable du projet, à côté du code (lisible et modifiable à la main). */
export const MEMORY_FILE = 'XozHub.md';

function safeRead(file, limit = 4000) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 4_000_000) return '';
    return fs.readFileSync(file, 'utf8').slice(0, limit);
  } catch {
    return '';
  }
}

function exists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function gitInfo(cwd) {
  try {
    const res = spawnSync('git', ['status', '--porcelain', '--branch'], {
      cwd,
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
    });
    if (res.error || res.status !== 0 || !res.stdout) return '';
    const lines = res.stdout.split('\n').filter((l) => l.trim());
    const branch = (lines.shift() || '').replace(/^##\s*/, '').trim();
    const changed = lines.map((l) => l.trim()).filter(Boolean);
    let out = `git : ${branch || 'dépôt détecté'}`;
    if (changed.length) {
      out += ` — ${changed.length} fichier(s) modifié(s) ou non suivi(s) :\n`;
      out += changed.slice(0, 15).map((l) => `  ${l}`).join('\n');
      if (changed.length > 15) out += `\n  … (+${changed.length - 15})`;
    }
    return out;
  } catch {
    return '';
  }
}

function tree(cwd) {
  const out = [];
  const walk = (dir, prefix, depth) => {
    if (out.length >= MAX_TREE_ENTRIES || depth > 3) return;
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    items = items
      .filter((d) => !IGNORED.has(d.name) && !d.name.startsWith('.xozhub'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    for (const item of items) {
      if (out.length >= MAX_TREE_ENTRIES) {
        out.push(`${prefix}…`);
        return;
      }
      if (item.isDirectory()) {
        out.push(`${prefix}${item.name}/`);
        walk(path.join(dir, item.name), `${prefix}  `, depth + 1);
      } else {
        out.push(`${prefix}${item.name}`);
      }
    }
  };
  walk(cwd, '', 1);
  return out;
}

/** Renvoie un résumé texte du projet, prêt à être injecté dans le prompt système. */
export function collectProjectContext(cwd) {
  const parts = [];

  const pkgRaw = safeRead(path.join(cwd, 'package.json'), 40000);
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      const scripts = Object.keys(pkg.scripts || {});
      const deps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
      let line = `package.json : ${pkg.name || 'sans nom'}${pkg.version ? ` v${pkg.version}` : ''}`;
      if (pkg.description) line += ` — ${pkg.description}`;
      if (scripts.length) line += `\n  scripts : ${scripts.join(', ')}`;
      if (deps.length) line += `\n  dépendances : ${deps.slice(0, 25).join(', ')}${deps.length > 25 ? '…' : ''}`;
      parts.push(line);
    } catch {
      /* package.json illisible : on continue sans lui */
    }
  }

  const markers = [
    ['package.json', 'Node.js'],
    ['tsconfig.json', 'TypeScript'],
    ['pyproject.toml', 'Python'],
    ['requirements.txt', 'Python'],
    ['Cargo.toml', 'Rust'],
    ['go.mod', 'Go'],
    ['pom.xml', 'Java'],
    ['Gemfile', 'Ruby'],
    ['composer.json', 'PHP'],
    ['index.html', 'HTML/web'],
  ];
  const langs = [...new Set(markers.filter(([f]) => exists(path.join(cwd, f))).map(([, l]) => l))];
  if (langs.length) parts.push(`technos repérées : ${langs.join(', ')}`);

  const git = gitInfo(cwd);
  if (git) parts.push(git);

  const readme =
    safeRead(path.join(cwd, 'README.md'), 1500) || safeRead(path.join(cwd, 'readme.md'), 1500);
  if (readme.trim()) {
    parts.push(`début du README :\n${readme.split('\n').slice(0, 20).join('\n').trim()}`);
  }

  const files = tree(cwd);
  if (files.length) parts.push(`aperçu de l'arborescence :\n${files.join('\n')}`);

  let text = parts.join('\n\n');
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n…`;
  return text;
}

// ------------------------------------------------------------------ mémoire du projet

export function memoryPath(cwd) {
  return path.join(cwd, MEMORY_FILE);
}

// Mémoire renvoyée au modèle : bornée elle aussi. Les notes récentes sont à la fin du fichier,
// donc on garde le titre et la fin — jamais un gros bloc de vieilles notes qui prendrait toute
// la place et ramènerait l'agent sur des sujets déjà passés.
const MEMORY_LIMIT = 4000;
const MEMORY_HEAD = 300;

export function readMemory(cwd) {
  const raw = safeRead(memoryPath(cwd), 40000).trim();
  if (!raw || raw.length <= MEMORY_LIMIT) return raw;
  const from = raw.length - MEMORY_LIMIT;
  const cut = raw.indexOf('\n', from);
  const tail = cut === -1 ? raw.slice(from) : raw.slice(cut + 1);
  const head = raw
    .slice(0, MEMORY_HEAD)
    .split('\n')
    .filter((l) => l.startsWith('#'))
    .join('\n');
  return `${head ? `${head}\n…\n` : ''}${tail}`.trim();
}

/**
 * Ajoute des notes à la mémoire du projet. Crée le fichier au besoin.
 * Renvoie le nombre de lignes ajoutées.
 */
export function appendMemory(cwd, text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith('-') ? l : `- ${l}`));
  if (!lines.length) return 0;
  try {
    const file = memoryPath(cwd);
    if (!exists(file)) {
      fs.writeFileSync(
        file,
        `# Mémoire du projet\n\nNotes durables retenues par XozHub.GPT (tu peux les modifier à la main).\n\n`,
        'utf8',
      );
    }
    fs.appendFileSync(file, `${lines.join('\n')}\n`, 'utf8');
    return lines.length;
  } catch {
    return 0;
  }
}

export function clearMemory(cwd) {
  try {
    fs.rmSync(memoryPath(cwd), { force: true });
    return true;
  } catch {
    return false;
  }
}
