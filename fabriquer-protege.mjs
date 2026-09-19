// XozHub.GPT — fabrique la version « protegee » : un seul fichier, illisible.
//
//   node fabriquer-protege.mjs [racine] [sortie]
//
//     racine  dossier du projet            (defaut : le dossier de ce script)
//     sortie  fichier a ecrire             (defaut : <racine>/bin/xozhub.js)
//
// Ce que fait ce script, dans l'ordre :
//
//   1. il rassemble TOUS les modules (bin/ + src/) en un seul bloc de code ;
//   2. il range ce bloc dans une enveloppe AES-256-GCM, encodee en base64 ;
//   3. il ecrit, a la place demandee, un petit lanceur qui dechiffre le bloc
//      EN MEMOIRE (rien n'est jamais ecrit sur le disque) et l'execute.
//
// Consequence : une fois installe, il ne reste chez la personne qu'UN fichier
// illisible. Plus de src/, plus de modules a recopier.
//
// ⚠ Honnetete : ce n'est PAS du chiffrement fort. La cle voyage dans le
// lanceur, donc quelqu'un de determine peut la retrouver et dechiffrer le
// bloc. Ce qui est empeche, c'est la copie simple : ouvrir le fichier, lire
// le code, le reprendre tel quel. Pour une vraie protection il faudrait un
// service distant (le code resterait sur un serveur).
//
// Le layout est conserve a l'identique : le fichier produit se place la ou
// etait bin/xozhub.js, donc PACKAGE_ROOT (et le .env a cote) ne bougent pas.
//
// Aucune dependance : uniquement Node.js.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

// Cle de l'enveloppe (32 octets). Elle est aussi ecrite dans le lanceur :
// c'est elle qui permet de dechiffrer au demarrage.
const CLE_HEX = '5c1f9a0d3e7b2468a1c4f0e2d8b357ca91f6e04d27b83a5c6f19d0e4b7a2c853';
const CLE = Buffer.from(CLE_HEX, 'hex');

const ENTRY = 'bin/xozhub.js';
const BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

// --------------------------------------------------------------- lecture

/** Chaque module du projet, indexe par son chemin relatif ("src/api.js"). */
function collecter(racine, entryRel) {
  const codes = new Map();
  const aFaire = [entryRel];

  while (aFaire.length) {
    const id = aFaire.pop();
    if (codes.has(id)) continue;

    const abs = path.join(racine, ...id.split('/'));
    let code;
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch {
      throw new Error(`module introuvable : ${id}`);
    }
    codes.set(id, code);

    for (const imp of analyser(code, id).imports) {
      if (!imp.spec.startsWith('.') && !imp.spec.startsWith('/')) continue;
      const cible = resoudreDepuis(id, imp.spec);
      if (!codes.has(cible)) aFaire.push(cible);
    }
  }

  return codes;
}

/** "src/app.js" + "./config.js" -> "src/config.js" */
function resoudreDepuis(id, spec) {
  const dir = path.posix.dirname(id);
  const cible = path.posix.normalize(path.posix.join(dir, spec));
  if (cible.startsWith('..')) throw new Error(`import hors projet dans ${id} : ${spec}`);
  return cible;
}

/** "fs" -> "node:fs" (laisse "node:fs" tel quel). */
function normaliserBuiltin(spec) {
  return spec.startsWith('node:') ? spec : `node:${spec}`;
}

/**
 * Separe un module en trois : ses imports, ses exports, et son corps
 * (le code, avec les mots-cles « import » et « export » retires).
 */
function analyser(code, id) {
  const props = { imports: [], exports: [], corps: [] };
  // « import.meta.url » n'existe que dans un vrai module : dans le bloc
  // assemble, il est remplace par l'adresse du lanceur (elle pointe sur le
  // meme dossier, donc PACKAGE_ROOT et le .env ne bougent pas).
  const lignes = code.replace(/\r\n/g, '\n').split('\n');
  const interdit = code.replace(/import\.meta\.url/g, '');
  if (/import\.meta\b/.test(interdit)) {
    throw new Error(`import.meta non geree dans ${id} (seul import.meta.url l'est)`);
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    // Le « #! » n'est valable qu'en toute premiere ligne d'un fichier.
    if (ligne.startsWith('#!')) continue;

    // --- import (sur une ou plusieurs lignes) ---
    if (/^import\b/.test(ligne)) {
      let brut = ligne.trim();
      while (!/from\s*['"][^'"]+['"]/.test(brut) && i + 1 < lignes.length) {
        i++;
        brut += ` ${lignes[i].trim()}`;
      }
      const m = /^import\s+(.+?)\s+from\s*['"]([^'"]+)['"]/.exec(brut.replace(/;+\s*$/, ''));
      if (!m) throw new Error(`import non comprise dans ${id} : ${brut}`);
      props.imports.push({ clause: m[1].trim(), spec: m[2] });
      continue;
    }

    // --- export ---
    const me = /^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(
      ligne,
    );
    if (me) {
      props.exports.push(me[2]);
      props.corps.push(ligne.replace(/^export\s+/, '').replace(/import\.meta\.url/g, '__metaUrl'));
      continue;
    }
    if (/^export\b/.test(ligne)) {
      throw new Error(`export non geree dans ${id} : ${ligne}`);
    }

    props.corps.push(ligne.replace(/import\.meta\.url/g, '__metaUrl'));
  }

  return props;
}

// ------------------------------------------------------------- assemblage

/** Une ligne « const ... = __mod(...) » (module du projet) ou « = __node[...] » (module Node). */
function ligneImport(imp, id, builtins) {
  const nomme = imp.clause.startsWith('{');
  const espaceNomme = /^\*\s+as\s+/.test(imp.clause);

  if (imp.spec.startsWith('.') || imp.spec.startsWith('/')) {
    const cible = JSON.stringify(resoudreDepuis(id, imp.spec));
    if (espaceNomme) {
      const alias = imp.clause.replace(/^\*\s+as\s+/, '').trim();
      return `const ${alias} = __mod(${cible});`;
    }
    if (!nomme) {
      throw new Error(`import par defaut non geree dans ${id} : ${imp.clause} (${imp.spec})`);
    }
    const clause = imp.clause.replace(/\bas\b/g, ':');
    return `const ${clause} = __mod(${cible});`;
  }

  const mod = normaliserBuiltin(imp.spec);
  if (!BUILTINS.has(mod)) throw new Error(`module Node inconnu dans ${id} : ${imp.spec}`);
  builtins.add(mod);

  if (nomme) return `const ${imp.clause.replace(/\bas\b/g, ':')} = __node[${JSON.stringify(mod)}];`;
  if (espaceNomme) {
    const alias = imp.clause.replace(/^\*\s+as\s+/, '').trim();
    return `const ${alias} = __node[${JSON.stringify(mod)}];`;
  }
  return `const ${imp.clause} = __node[${JSON.stringify(mod)}];`;
}

/** Le code complet de l'agent, en un seul bloc (sans les modules Node). */
function assembler(racine, entryRel = ENTRY) {
  const codes = collecter(racine, entryRel);
  const builtins = new Set();
  const parties = [];

  for (const [id, code] of codes) {
    const { imports, exports, corps } = analyser(code, id);
    const entetes = imports.map((imp) => `  ${ligneImport(imp, id, builtins)}`);
    const sorties = exports.map((nom) => `  __ns.${nom} = ${nom};`);

    parties.push(
      [
        `__modules[${JSON.stringify(id)}] = function () {`,
        '  const __ns = {};',
        ...entetes,
        corps.join('\n'),
        ...sorties,
        '  return __ns;',
        '};',
      ].join('\n'),
    );
  }

  const source = [
    "'use strict';",
    'const __modules = {};',
    'const __vus = {};',
    'function __mod(id) {',
    '  if (Object.prototype.hasOwnProperty.call(__vus, id)) return __vus[id];',
    '  const ns = __modules[id]();',
    '  __vus[id] = ns;',
    '  return ns;',
    '}',
    ...parties,
    `__mod(${JSON.stringify(entryRel)});`,
  ].join('\n');

  return { source, builtins: [...builtins].sort(), modules: codes.size };
}

// -------------------------------------------------------------- enveloppe

/** Le lanceur : il contient le bloc chiffre, le dechiffre en memoire, l'execute. */
function envelopper(source, builtins) {
  const iv = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', CLE, iv);
  const donnees = Buffer.concat([chiffreur.update(source, 'utf8'), chiffreur.final()]);
  const blob = Buffer.concat([iv, chiffreur.getAuthTag(), donnees]).toString('base64');
  const morceaux = blob.match(/.{1,100}/g) || [];

  // Le lanceur se dechiffre lui-meme (crypto), et doit exposer au bloc tout ce
  // que le code de l'agent utilise.
  const imports = [
    'import crypto from "node:crypto";',
    ...builtins.map((mod, i) => `import m${i} from ${JSON.stringify(mod)};`),
  ];
  const table = builtins.map((mod, i) => `  ${JSON.stringify(mod)}: m${i},`);

  return [
    '#!/usr/bin/env node',
    '// XozHub.GPT — lanceur protege.',
    '//',
    '// Ce fichier ne contient AUCUN code lisible : l\'agent est range, chiffre,',
    '// dans le bloc BLOB ci-dessous. Au demarrage, il est dechiffre en memoire',
    '// (jamais sur le disque) puis execute. Rien a recopier, rien a reutiliser.',
    '',
    ...imports,
    '',
    'const CLE = Buffer.from(',
    `  '${CLE_HEX}',`,
    "  'hex',",
    ');',
    '',
    'const BLOB = [',
    ...morceaux.map((m) => `  '${m}',`),
    "].join('');",
    '',
    'const __node = {',
    ...table,
    '};',
    '',
    '// Enveloppe : 12 octets de vecteur, 16 octets d’authentification, puis le code.',
    "const octets = Buffer.from(BLOB, 'base64');",
    "const dechiffreur = crypto.createDecipheriv('aes-256-gcm', CLE, octets.subarray(0, 12));",
    'dechiffreur.setAuthTag(octets.subarray(12, 28));',
    'const source = Buffer.concat([',
    '  dechiffreur.update(octets.subarray(28)),',
    '  dechiffreur.final(),',
    "]).toString('utf8');",
    '',
    'try {',
    "  new Function('__node', '__metaUrl', source)(__node, import.meta.url);",
    '} catch (err) {',
    '  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\\n`);',
    '  process.exit(1);',
    '}',
    '',
  ].join('\n');
}

// -------------------------------------------------------------------- API

/**
 * Fabrique le fichier protege et renvoie son contenu.
 * @param {string} racine dossier du projet
 * @returns {{ source: string, modules: number, builtins: string[] }}
 */
export function fabriquerSourceProtegee(racine) {
  const { source, builtins, modules } = assembler(racine);
  const code = envelopper(source, builtins);

  // Verification : le bloc doit etre du JavaScript valide (compile, sans executer).
  try {
    new Function('__node', '__metaUrl', source);
  } catch (err) {
    throw new Error(`le bloc assemble n'est pas du JavaScript valide : ${err.message}`);
  }

  return { source: code, modules, builtins };
}

// --------------------------------------------------------------------- CLI

const estLanceDirectement = (() => {
  try {
    return path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (estLanceDirectement) {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const remplacer = args.includes('--remplacer');
  const libres = args.filter((a) => !a.startsWith('--'));
  const racine = path.resolve(libres[0] || ici);
  const sortie = path.resolve(libres[1] || path.join(racine, ...ENTRY.split('/')));
  const entree = path.join(racine, ...ENTRY.split('/'));

  const brut = path.relative(ici, entree).replace(/\\/g, '/');
  console.log('');
  console.log(`  XozHub.GPT — fabrication de la version protegee (${brut})`);

  if (!fs.existsSync(entree)) {
    console.error(`  ERREUR : ${entree} est introuvable.`);
    process.exit(1);
  }
  if (fs.readFileSync(entree, 'utf8').includes('BLOB')) {
    console.error('  ERREUR : ce dossier est deja protege (pas de sources a rassembler).');
    process.exit(1);
  }
  // Ecrire la version protegee A LA PLACE de l'entree detruit les sources :
  // c'est voulu pendant une installation, jamais pendant qu'on developpe.
  if (path.resolve(entree) === sortie && !remplacer) {
    console.error('  ERREUR : cette sortie ecraserait les sources du projet.');
    console.error("  Donne un autre fichier en 2e argument, ou ajoute --remplacer pour le faire expres.");
    process.exit(1);
  }

  let resultat;
  try {
    resultat = fabriquerSourceProtegee(racine);
  } catch (err) {
    console.error(`  ERREUR : ${err.message}`);
    process.exit(1);
  }

  // Ecriture via un fichier temporaire : le dossier d'installation n'est jamais
  // laisse avec un bin/xozhub.js a moitie ecrit.
  const temporaire = `${sortie}.tmp`;
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(temporaire, resultat.source, 'utf8');
  fs.renameSync(temporaire, sortie);

  const ko = (Buffer.byteLength(resultat.source) / 1024).toFixed(0);
  console.log(`  Modules rassembles : ${resultat.modules}`);
  console.log(`  Fichier ecrit      : ${sortie}  (${ko} Ko, illisible)`);
  console.log('');
}
