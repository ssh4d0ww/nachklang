// Demo mode: pretends to be the Spotify Web API.
// Returns objects in the same format so the app runs the same code.
// Titles, artists, playlists and covers are all made up.

const ALBUMS = [
  { name: "City Lights", artist: "Neon Atlas", hues: [262, 318], year: "2025" },
  { name: "Glass Rain", artist: "Mira Holm", hues: [198, 232], year: "2024" },
  { name: "Afterglow City", artist: "Kite Delay", hues: [18, 342], year: "2026" },
  { name: "Orbit", artist: "Velvet Static", hues: [162, 204], year: "2023" },
  { name: "Coastline", artist: "Sora Mae", hues: [188, 276], year: "2025" },
];

const TRACKS = [
  { name: "Night Drive", a: 0, dur: 203000 },
  { name: "Glass Rain", a: 1, dur: 187000 },
  { name: "Afterglow City", a: 2, dur: 224000 },
  { name: "Slow Orbit", a: 3, dur: 241000 },
  { name: "White Lines", a: 0, dur: 176000 },
  { name: "Low Tide FM", a: 4, dur: 198000 },
  { name: "Midnight Blue", a: 1, dur: 212000 },
  { name: "Copper Heart", a: 2, dur: 195000 },
  { name: "Neon Rain", a: 0, dur: 189000 },
  { name: "Weightless", a: 3, dur: 205000 },
  { name: "Saltwater", a: 4, dur: 183000 },
  { name: "Sparks", a: 2, dur: 171000 },
];

const PLAYLISTS = [
  { name: "Night Shift", hues: [250, 300], own: true, tracks: [0, 8, 4, 6, 1, 3, 9] },
  { name: "Sunday Morning", hues: [32, 8], own: true, tracks: [5, 10, 1, 3, 11] },
  { name: "Focus", hues: [170, 210], own: true, tracks: [3, 9, 6, 1] },
  { name: "Weekly Hits", hues: [330, 280], own: false, tracks: [2, 7, 11, 0] },
];

const DEVICES = [
  { id: "demo-pc", name: "Desktop PC", type: "Computer", supports_volume: true },
  { id: "demo-phone", name: "iPhone", type: "Smartphone", supports_volume: false },
  { id: "demo-speaker", name: "Living Room", type: "Speaker", supports_volume: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// draw a cover as a small piece of art (gradients + soft circles)
function drawCover(hues, seed, size, ring = true) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const [h1, h2] = hues;
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, `hsl(${h1} 72% 46%)`);
  bg.addColorStop(1, `hsl(${h2} 68% 18%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry(seed * 7919 + 13);
  for (let k = 0; k < 5; k++) {
    const x = rand() * size, y = rand() * size, r = size * (0.18 + rand() * 0.35);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const h = k % 2 ? h1 : h2;
    g.addColorStop(0, `hsla(${h} 85% ${55 + rand() * 20}% / .75)`);
    g.addColorStop(1, `hsla(${h} 85% 50% / 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  if (ring) ctx.arc(size * 0.5, size * 0.5, size * (0.16 + (seed % 3) * 0.05), 0, Math.PI * 2);
  else ctx.rect(size * 0.3, size * 0.3, size * 0.4, size * 0.4);
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

const images = (big, small) => [{ url: big, width: 640, height: 640 }, { url: small, width: 128, height: 128 }];
const page = (items, offset = 0, limit = 50) => ({ items: items.slice(offset, offset + limit), total: items.length, offset, limit, next: offset + limit < items.length ? "more" : null });

export function createDemoApi() {
  const artists = ALBUMS.map((a, i) => ({ id: `dart${i}`, uri: `spotify:artist:dart${i}`, type: "artist", name: a.artist }));
  const albums = ALBUMS.map((a, i) => ({
    id: `dalb${i}`,
    uri: `spotify:album:dalb${i}`,
    type: "album",
    album_type: "album",
    name: a.name,
    release_date: a.year,
    artists: [artists[i]],
    images: images(drawCover(a.hues, i, 640), drawCover(a.hues, i, 128)),
  }));
  const items = TRACKS.map((t, i) => ({
    id: `demo${i}`,
    uri: `spotify:track:demo${i}`,
    type: "track",
    name: t.name,
    duration_ms: t.dur,
    track_number: TRACKS.slice(0, i).filter((x) => x.a === t.a).length + 1,
    artists: [artists[t.a]],
    album: albums[t.a],
  }));
  albums.forEach((al, i) => (al.total_tracks = TRACKS.filter((t) => t.a === i).length));
  artists.forEach((ar, i) => (ar.images = albums[i].images));
  const playlists = PLAYLISTS.map((p, i) => ({
    id: `dpl${i}`,
    uri: `spotify:playlist:dpl${i}`,
    type: "playlist",
    name: p.name,
    owner: p.own ? { id: "demo", display_name: "Demo" } : { id: "spotify", display_name: "Spotify" },
    items: { total: p.tracks.length },
    images: images(drawCover(p.hues, i + 10, 640, false), drawCover(p.hues, i + 10, 128, false)),
  }));

  const byUri = new Map(items.map((t, i) => [t.uri, i]));

  // list of track indexes for a context (album, playlist, artist, Liked Songs)
  function contextList(uri) {
    const [, kind, id] = uri.split(":");
    if (kind === "album") return TRACKS.map((t, i) => [t, i]).filter(([t]) => `dalb${t.a}` === id).map(([, i]) => i);
    if (kind === "playlist") return PLAYLISTS[Number(id.replace("dpl", ""))]?.tracks.slice() || null;
    if (kind === "artist") return TRACKS.map((t, i) => [t, i]).filter(([t]) => `dart${t.a}` === id).map(([, i]) => i);
    if (uri.endsWith(":collection")) return [...s.liked].map((u) => byUri.get(u));
    return null;
  }

  const s = {
    base: items.map((_, i) => i), // order without shuffle
    list: items.map((_, i) => i), // current order
    at: 0,
    added: 0, // tracks inserted via "Add to queue"
    playing: true,
    start: 42000,
    since: Date.now(),
    shuffle: false,
    repeat: "off",
    device: "demo-pc",
    volume: { "demo-pc": 64, "demo-phone": 100, "demo-speaker": 40 },
    liked: new Set(["spotify:track:demo2", "spotify:track:demo5", "spotify:track:demo8", "spotify:track:demo1"]),
    history: [5, 3, 6, 1].map((i, k) => ({ i, at: Date.now() - (k + 1) * 4 * 60000 })),
  };

  const current = () => s.list[s.at];
  const position = () => Math.min(s.start + (s.playing ? Date.now() - s.since : 0), items[current()].duration_ms);
  const setPos = (ms) => { s.start = ms; s.since = Date.now(); };

  function remember() {
    s.history.unshift({ i: current(), at: Date.now() });
    s.history = s.history.slice(0, 30);
  }

  function go(step) {
    remember();
    s.at = (s.at + step + s.list.length) % s.list.length;
    s.added = 0;
    setPos(0);
  }

  function advance() {
    while (s.playing && position() >= items[current()].duration_ms) {
      const over = Date.now() - s.since - (items[current()].duration_ms - s.start);
      if (s.repeat === "track") setPos(0);
      else go(1);
      s.since -= Math.max(0, over);
    }
  }

  function setList(list, startIndex = 0) {
    remember();
    s.base = list.slice();
    s.list = list.slice();
    s.at = Math.max(0, startIndex);
    s.added = 0;
    if (s.shuffle) shuffleRest();
    setPos(0);
  }

  function shuffleRest() {
    const head = s.list.slice(0, s.at + 1);
    const rest = s.list.slice(s.at + 1).sort(() => Math.random() - 0.5);
    s.list = [...head, ...rest];
  }

  const device = (id) => {
    const d = DEVICES.find((x) => x.id === id);
    return { ...d, is_active: id === s.device, volume_percent: d.supports_volume ? s.volume[id] : null };
  };

  const match = (q, ...fields) => fields.some((f) => f.toLowerCase().includes(q));

  return {
    kind: "demo",
    async me() {
      return { id: "demo", display_name: "Demo" };
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
        item: items[current()],
        context: null,
      };
    },
    async play(_deviceId, body) {
      await sleep(120);
      if (body?.context_uri) {
        const list = contextList(body.context_uri);
        if (!list?.length) throw fail(404, "Nothing to play.");
        const off = body.offset?.uri ? list.indexOf(byUri.get(body.offset.uri)) : body.offset?.position ?? 0;
        setList(list, off);
      } else if (body?.uris?.length) {
        const list = body.uris.map((u) => byUri.get(u)).filter((i) => i !== undefined);
        setList(list, body.offset?.position ?? 0);
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
      go(-1);
    },
    async seek(ms) {
      await sleep(100);
      setPos(Math.max(0, Math.min(ms, items[current()].duration_ms - 500)));
    },
    async shuffle(on) {
      await sleep(100);
      s.shuffle = on;
      if (on) shuffleRest();
      else {
        const cur = current();
        s.list = s.base.slice();
        s.at = Math.max(0, s.list.indexOf(cur));
      }
    },
    async repeat(mode) {
      await sleep(100);
      s.repeat = mode;
    },
    async volume(pct) {
      await sleep(80);
      if (!DEVICES.find((d) => d.id === s.device).supports_volume) throw fail(403, "This device does not allow remote volume control.");
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
      const queue = [];
      for (let k = 1; k < Math.min(s.list.length, 20); k++) queue.push(items[s.list[(s.at + k) % s.list.length]]);
      return { currently_playing: items[current()], queue };
    },
    async addToQueue(uri) {
      await sleep(120);
      const i = byUri.get(uri);
      if (i === undefined) throw fail(404, "Track not found.");
      s.added += 1;
      s.list.splice(s.at + s.added, 0, i);
    },
    async recent() {
      await sleep(200);
      return { items: s.history.map((h) => ({ track: items[h.i], played_at: new Date(h.at).toISOString(), context: null })) };
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

    // Library
    async myPlaylists(offset = 0) {
      await sleep(200);
      return page(playlists, offset);
    },
    async playlistItems(id, offset = 0) {
      await sleep(220);
      const p = PLAYLISTS[Number(id.replace("dpl", ""))];
      if (!p) throw fail(404, "Playlist not found.");
      // like the real API since February 2026: no contents for playlists you don't own
      if (!p.own) throw fail(403, "Spotify does not show the contents of playlists you don't own.");
      return page(p.tracks.map((i) => ({ added_at: "2026-11-01T10:00:00Z", item: items[i] })), offset);
    },
    async savedTracks(offset = 0) {
      await sleep(220);
      return page([...s.liked].reverse().map((u) => ({ added_at: "2026-11-01T10:00:00Z", track: items[byUri.get(u)] })), offset);
    },
    async savedAlbums(offset = 0) {
      await sleep(200);
      return page([0, 2, 3].map((i) => ({ added_at: "2026-10-01T10:00:00Z", album: albums[i] })), offset);
    },
    async album(id) {
      await sleep(180);
      const i = Number(id.replace("dalb", ""));
      const tracks = TRACKS.map((t, k) => [t, k]).filter(([t]) => t.a === i).map(([, k]) => items[k]);
      return { ...albums[i], tracks: page(tracks) };
    },
    async albumTracks(id, offset = 0) {
      const a = await this.album(id);
      return page(a.tracks.items, offset);
    },
    async artist(id) {
      await sleep(150);
      const i = Number(id.replace("dart", ""));
      return { ...artists[i], genres: ["electronic", "chill"], images: albums[i].images };
    },
    async artistAlbums(id) {
      await sleep(180);
      const i = Number(id.replace("dart", ""));
      return page([albums[i]]);
    },
    async search(q) {
      await sleep(260);
      q = q.toLowerCase().trim();
      const tracks = items.filter((t) => match(q, t.name, t.artists[0].name, t.album.name)).slice(0, 10);
      return {
        tracks: page(tracks, 0, 10),
        artists: page(artists.filter((a) => match(q, a.name)), 0, 10),
        albums: page(albums.filter((a) => match(q, a.name, a.artists[0].name)), 0, 10),
        playlists: page(playlists.filter((p) => match(q, p.name)), 0, 10),
      };
    },
  };
}
