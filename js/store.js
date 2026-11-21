// localStorage mit Rückfall: In manchen Umgebungen (privater Modus,
// eingebettete Vorschau) ist der Speicher gesperrt. Dann merkt sich die
// App die Werte nur, solange die Seite offen ist.
const memory = new Map();

function storage() {
  try {
    const s = window.localStorage;
    s.setItem("nk.__test", "1");
    s.removeItem("nk.__test");
    return s;
  } catch {
    return null;
  }
}

const ls = storage();

export const store = {
  get(key) {
    return ls ? ls.getItem(key) : memory.has(key) ? memory.get(key) : null;
  },
  set(key, value) {
    if (ls) ls.setItem(key, value);
    else memory.set(key, String(value));
  },
  remove(key) {
    if (ls) ls.removeItem(key);
    else memory.delete(key);
  },
};
