// XozHub.GPT — sauvegarde et reprise de la conversation, dans le dossier de travail.

import fs from 'node:fs';
import path from 'node:path';

const FILE = '.xozhub-session.json';
const MAX_ENTRIES = 300;

export function sessionPath(cwd) {
  return path.join(cwd, FILE);
}

/** Enregistre la conversation (messages + journal visible) du dossier courant. */
export function saveSession(cwd, { messages, entries, model }) {
  try {
    const slim = (entries || [])
      .slice(-MAX_ENTRIES)
      .map((e) => ({ kind: e.kind, text: e.text }))
      .filter((e) => e.text !== undefined);
    fs.writeFileSync(
      sessionPath(cwd),
      JSON.stringify({ savedAt: Date.now(), model, messages: messages || [], entries: slim }),
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
}

/** Relit la dernière conversation sauvegardée dans ce dossier (ou null). */
export function loadSession(cwd) {
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath(cwd), 'utf8'));
    if (!data || !Array.isArray(data.messages) || !data.messages.length) {
      if (!data || !Array.isArray(data.entries) || !data.entries.length) return null;
    }
    return {
      savedAt: data.savedAt || 0,
      model: data.model || '',
      messages: Array.isArray(data.messages) ? data.messages : [],
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
  } catch {
    return null;
  }
}

export function hasSession(cwd) {
  try {
    return fs.statSync(sessionPath(cwd)).isFile();
  } catch {
    return false;
  }
}

export function dropSession(cwd) {
  try {
    fs.rmSync(sessionPath(cwd), { force: true });
    return true;
  } catch {
    return false;
  }
}
