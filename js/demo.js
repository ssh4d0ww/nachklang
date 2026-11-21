// Demo-Modus: tut so, als wäre es die Spotify Web API.
// Liefert Objekte im selben Format, damit die App denselben Code nutzt.
// Titel, Künstler und Cover sind frei erfunden.

const TRACKS = [
  { name: "Nachtfahrt", artist: "Neon Atlas", album: "Lichter der Stadt", dur: 203000, hues: [262, 318] },
  { name: "Glasregen", artist: "Mira Holm", album: "Glasregen", dur: 187000, hues: [198, 232] },
  { name: "Afterglow City", artist: "Kite Delay", album: "Afterglow City", dur: 224000, hues: [18, 342] },
  { name: "Slow Orbit", artist: "Velvet Static", album: "Orbit", dur: 241000, hues: [162, 204] },
  { name: "Weiße Linien", artist: "Juno Park", album: "Linien", dur: 176000, hues: [42, 14] },
  { name: "Low Tide FM", artist: "Sora Mae", album: "Coastline", dur: 198000, hues: [188, 276] },
  { name: "Mitternachtsblau", artist: "Arlo & Wen", album: "Blau", dur: 212000, hues: [224, 252] },
  { name: "Kupferherz", artist: "Ilse Vane", album: "Kupfer", dur: 195000, hues: [24, 2] },
];

const DEVICES = [
  { id: "demo-pc", name: "Desktop-PC", type: "Computer", supports_volume: true },
  { id: "demo-phone", name: "iPhone", type: "Smartphone", supports_volume: false },
  { id: "demo-speaker", name: "Wohnzimmer", type: "Speaker", supports_volume: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cover als kleines Kunstwerk zeichnen (Verläufe + weiche Kreise)
function drawCover(t, i, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const [h1, h2] = t.hues;
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, `hsl(${h1} 72% 46%)`);
  bg.addColorStop(1, `hsl(${h2} 68% 18%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry(i * 7919 + 13);
  for (let k = 0; k < 5; k++) {
    const x = rand() * size, y = rand() * size, r = size * (0.18 + rand() * 0.35);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const h = k % 2 ? h1 : h2;
    g.addColorStop(0, `hsla(${h} 85% ${55 + rand() * 20}% / .75)`);
    g.addColorStop(1, `hsla(${h} 85% 50% / 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // eine feine Linie als "Logo" des Albums
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * (0.16 + (i % 3) * 0.05), 0, Math.PI * 2);
  ctx.stroke();
  return c.toDataURL("image/jpeg", 0.86);
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDemoApi() {
  const items = TRACKS.map((t, i) => {
    const big = drawCover(t, i, 640);
    const small = drawCover(t, i, 128);
    return {
      id: `demo${i}`,
      uri: `spotify:track:demo${i}`,
      type: "track",
      name: t.name,
      duration_ms: t.dur,
      artists: [{ name: t.artist }],
      album: { name: t.album, images: [{ url: big, width: 640, height: 640 }, { url: small, width: 128, height: 128 }] },
    };
  });

  const s = {
    index: 0,
    order: items.map((_, i) => i),
    playing: true,
    base: 42000, // Position beim letzten Start/Seek
    since: Date.now(),
    shuffle: false,
    repeat: "off",
    device: "demo-pc",
    volume: { "demo-pc": 64, "demo-phone": 100, "demo-speaker": 40 },
    liked: new Set(["spotify:track:demo2"]),
    history: [5, 3, 6, 1].map((i, k) => ({ i, at: Date.now() - (k + 1) * 4 * 60000 })),
  };

  const position = () => Math.min(s.base + (s.playing ? Date.now() - s.since : 0), items[s.index].duration_ms);
  const setPos = (ms) => { s.base = ms; s.since = Date.now(); };
  const pos = () => s.order.indexOf(s.index);

  function go(step) {
    s.history.unshift({ i: s.index, at: Date.now() });
    s.history = s.history.slice(0, 30);
    const n = s.order.length;
    s.index = s.order[(pos() + step + n) % n];
    setPos(0);
  }

  // automatisch zum nächsten Lied, wenn eins zu Ende ist
  function advance() {
    while (position() >= items[s.index].duration_ms && s.playing) {
      const over = Date.now() - s.since - (items[s.index].duration_ms - s.base);
      if (s.repeat === "track") setPos(0);
      else go(1);
      s.since -= Math.max(0, over);
    }
  }

  const device = (id) => {
    const d = DEVICES.find((x) => x.id === id);
    return { ...d, is_active: id === s.device, volume_percent: d.supports_volume ? s.volume[id] : null };
  };

  return {
    kind: "demo",
    async me() {
      return { display_name: "Demo" };
    },
    async playbackState() {
      await sleep(60);
      advance();
      return {
        device: device(s.device),
        shuffle_state: s.shuffle,
        repeat_state: s.repeat,
        timestamp: Date.now(),
        progress_ms: position(),
        is_playing: s.playing,
        item: items[s.index],
        context: null,
      };
    },
    async play(_deviceId, body) {
      await sleep(120);
      const uri = body?.uris?.[0] || body?.offset?.uri;
      if (uri) {
        const i = items.findIndex((t) => t.uri === uri);
        if (i >= 0) { s.history.unshift({ i: s.index, at: Date.now() }); s.index = i; setPos(0); }
      } else {
        setPos(position());
      }
      s.playing = true;
    },
    async pause() {
      await sleep(120);
      setPos(position());
      s.playing = false;
    },
    async next() {
      await sleep(150);
      go(1);
    },
    async previous() {
      await sleep(150);
      if (position() > 3000) setPos(0);
      else go(-1);
    },
    async seek(ms) {
      await sleep(100);
      setPos(Math.max(0, Math.min(ms, items[s.index].duration_ms - 500)));
    },
    async shuffle(on) {
      await sleep(100);
      s.shuffle = on;
      const rest = items.map((_, i) => i).filter((i) => i !== s.index);
      if (on) rest.sort(() => Math.random() - 0.5);
      s.order = [s.index, ...rest];
      if (!on) s.order = items.map((_, i) => i);
    },
    async repeat(mode) {
      await sleep(100);
      s.repeat = mode;
    },
    async volume(pct) {
      await sleep(80);
      if (!DEVICES.find((d) => d.id === s.device).supports_volume) {
        const e = new Error("Dieses Gerät erlaubt keine Lautstärke von außen.");
        e.status = 403;
        throw e;
      }
      s.volume[s.device] = pct;
    },
    async devices() {
      await sleep(250);
      return { devices: DEVICES.map((d) => device(d.id)) };
    },
    async transfer(deviceId, play) {
      await sleep(300);
      s.device = deviceId;
      if (play) { setPos(position()); s.playing = true; }
    },
    async queue() {
      await sleep(200);
      const n = s.order.length;
      const queue = [];
      for (let k = 1; k < n; k++) queue.push(items[s.order[(pos() + k) % n]]);
      return { currently_playing: items[s.index], queue };
    },
    async recent() {
      await sleep(200);
      return {
        items: s.history.map((h) => ({ track: items[h.i], played_at: new Date(h.at).toISOString(), context: null })),
      };
    },
    async isSaved(uris) {
      await sleep(80);
      return [].concat(uris).map((u) => s.liked.has(u));
    },
    async save(uris) {
      await sleep(100);
      [].concat(uris).forEach((u) => s.liked.add(u));
    },
    async unsave(uris) {
      await sleep(100);
      [].concat(uris).forEach((u) => s.liked.delete(u));
    },
  };
}
