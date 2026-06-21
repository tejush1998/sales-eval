import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ evaluations: [] }, null, 2));

function read() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return { evaluations: [] };
  }
}

function write(state) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

export const db = {
  list() {
    return read().evaluations.sort((a, b) => b.createdAt - a.createdAt);
  },
  get(id) {
    return read().evaluations.find((e) => e.id === id);
  },
  findByUrl(url) {
    return read().evaluations.find((e) => e.url === url && e.status === 'completed' && e.transcription?.turns?.length > 0);
  },
  save(record) {
    const state = read();
    const existingIdx = state.evaluations.findIndex((e) => e.id === record.id);
    if (existingIdx >= 0) state.evaluations[existingIdx] = record;
    else state.evaluations.push(record);
    write(state);
    return record;
  },
  count() {
    return read().evaluations.length;
  },
};
