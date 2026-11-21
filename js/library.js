// Bibliothek und Suche: Lieblingssongs, Playlists, Alben, Künstler.
// Ansichten liegen auf einem Stapel (stack), "Zurück" nimmt die oberste weg.
import { icon } from "./icons.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function fmt(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function pickImage(images, want) {
  if (!images?.length) return "";
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 0) >= want) || sorted[sorted.length - 1]).url;
}

const artistNames = (t) => (t?.artists || []).map((a) => a.name).join(", ");
const trackImages = (t) => (t?.type === "episode" ? t.images || t.show?.images : t?.album?.images) || [];
const countOf = (pl) => pl?.items?.total ?? pl?.tracks?.total;
// Playlist-Einträge heißen seit Februar 2026 "item" statt "track"
const entryTrack = (e) => e?.item || e?.track || null;

const skeleton = (n = 6) =>
  Array.from({ length: n }, () => `<li><div class="row skeleton"><span class="thumb"></span><span class="row-text"><div class="bar" style="width:62%"></div><div class="bar" style="width:36%"></div></span></div></li>`).join("");

export function createLibrary(ctx) {
  const root = document.querySelector("#lib");
  const input = document.querySelector("#search");
  const clearBtn = document.querySelector("#search-clear");

  let stack = [];
  let home = null; // { playlists, albums, liked, at }
  let me = null;
  let searchTimer = null;
  let token = 0;

  const top = () => stack[stack.length - 1];

  async function getMe() {
    if (!me) me = await ctx.api().me().catch(() => ({}));
    return me;
  }

  // ------------------------------------------------------------
  // Öffentliche Funktionen
  // ------------------------------------------------------------

  function show() {
    if (!stack.length) stack = [{ kind: "home" }];
    if (top().kind === "home" && home && Date.now() - home.at > 5 * 60000) home = null;
    render();
  }

  function reset() {
    stack = [];
    home = null;
    me = null;
    input.value = "";
    clearBtn.hidden = true;
    root.innerHTML = "";
  }

  // ------------------------------------------------------------
  // Zeichnen
  // ------------------------------------------------------------

  function render() {
    const view = top();
    const t = ++token;
    root.scrollTop = 0;
    if (view.kind === "home") return renderHome(t);
    if (view.kind === "search") return renderSearch(view, t);
    return renderDetail(view, t);
  }

  const done = (t) => t !== token;

  function entityRow({ open, img, title, sub, round = false, chevron = true }) {
    return `<li><button class="row" data-open="${esc(open)}">
      ${img ? `<img class="${round ? "round" : ""}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb${round ? " round" : ""}"></span>`}
      <span class="row-text"><div class="row-title">${esc(title)}</div><div class="row-sub">${esc(sub)}</div></span>
      ${chevron ? `<span class="row-chev">${icon("chevron")}</span>` : ""}
    </button></li>`;
  }

  function trackRow(t, i, { number = false } = {}) {
    const img = pickImage(trackImages(t), 120);
    const lead = number
      ? `<span class="thumb num">${t.track_number || i + 1}</span>`
      : img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb"></span>`;
    return `<li class="row-wrap">
      <button class="row" data-play="${i}" data-uri="${esc(t.uri)}">
        ${lead}
        <span class="row-text"><div class="row-title">${esc(t.name)}</div><div class="row-sub">${esc(t.type === "episode" ? t.show?.name : artistNames(t))}</div></span>
        <span class="row-meta">${fmt(t.duration_ms)}</span>
      </button>
      <button class="icon-btn row-add" data-queue="${esc(t.uri)}" aria-label="Zur Warteschlange hinzufügen">${icon("plus")}</button>
    </li>`;
  }

  const playlistRow = (pl) =>
    entityRow({ open: `playlist:${pl.id}`, img: pickImage(pl.images, 120), title: pl.name, sub: `Playlist · ${pl.owner?.display_name || ""}` });
  const albumRow = (al) =>
    entityRow({ open: `album:${al.id}`, img: pickImage(al.images, 120), title: al.name, sub: `${al.album_type === "single" ? "Single" : "Album"} · ${artistNames(al)}` });
  const artistRow = (ar) => entityRow({ open: `artist:${ar.id}`, img: pickImage(ar.images, 120), title: ar.name, sub: "Künstler", round: true });

  async function renderHome(t) {
    if (!home) {
      root.innerHTML = `<ul class="track-list">${skeleton(7)}</ul>`;
      const api = ctx.api();
      const [pl, al, li] = await Promise.allSettled([api.myPlaylists(0), api.savedAlbums(0), api.savedTracks(0)]);
      if (done(t)) return;
      const val = (r) => (r.status === "fulfilled" ? r.value : null);
      home = { playlists: val(pl), albums: val(al), liked: val(li), at: Date.now(), error: [pl, al, li].every((r) => r.status === "rejected") ? pl.reason : null };
      if (home.error) {
        const msg = home.error.message;
        home = null;
        root.innerHTML = `<p class="list-empty">${esc(msg || "Bibliothek konnte nicht geladen werden.")}</p>`;
        return;
      }
    }
    const playlists = (home.playlists?.items || []).filter(Boolean);
    const albums = (home.albums?.items || []).map((e) => e?.album).filter(Boolean);
    const likedTotal = home.liked?.total ?? 0;
    root.innerHTML = `<ul class="track-list">
        <li><button class="row" data-open="liked:">
          <span class="thumb liked-thumb">${icon("heartFilled")}</span>
          <span class="row-text"><div class="row-title">Lieblingssongs</div><div class="row-sub">${likedTotal} Songs</div></span>
          <span class="row-chev">${icon("chevron")}</span>
        </button></li>
        <li class="list-label">Playlists</li>
        ${playlists.length ? playlists.map(playlistRow).join("") : `<li class="list-empty small">Noch keine Playlists.</li>`}
        ${home.playlists?.next ? `<li><button class="more-btn" data-more="playlists">Mehr Playlists laden</button></li>` : ""}
        <li class="list-label">Alben</li>
        ${albums.length ? albums.map(albumRow).join("") : `<li class="list-empty small">Noch keine gespeicherten Alben.</li>`}
      </ul>`;
  }

  async function renderSearch(view, t) {
    if (!view.result) {
      root.innerHTML = `<ul class="track-list">${skeleton(6)}</ul>`;
      try {
        view.result = await ctx.api().search(view.q);
      } catch (e) {
        if (!done(t)) root.innerHTML = `<p class="list-empty">${esc(e.message)}</p>`;
        return;
      }
      if (done(t)) return;
    }
    const r = view.result;
    const tracks = (r.tracks?.items || []).filter(Boolean);
    const artists = (r.artists?.items || []).filter(Boolean);
    const albums = (r.albums?.items || []).filter(Boolean);
    const playlists = (r.playlists?.items || []).filter(Boolean);
    view.tracks = tracks;
    if (!tracks.length && !artists.length && !albums.length && !playlists.length) {
      root.innerHTML = `<p class="list-empty">Nichts gefunden für „${esc(view.q)}“.</p>`;
      return;
    }
    const section = (label, html) => (html ? `<li class="list-label">${label}</li>${html}` : "");
    root.innerHTML = `<ul class="track-list">
      ${section("Songs", tracks.map((x, i) => trackRow(x, i)).join(""))}
      ${section("Künstler", artists.slice(0, 5).map(artistRow).join(""))}
      ${section("Alben", albums.slice(0, 6).map(albumRow).join(""))}
      ${section("Playlists", playlists.slice(0, 6).map(playlistRow).join(""))}
    </ul>`;
    ctx.highlight();
  }

  async function renderDetail(view, t) {
    if (!view.loaded) {
      root.innerHTML = `${backBar()}<div class="detail-head skeleton"><span class="thumb detail-cover"></span><div class="detail-text"><div class="bar" style="width:70%"></div><div class="bar" style="width:40%"></div></div></div><ul class="track-list">${skeleton(5)}</ul>`;
      try {
        await loadDetail(view);
      } catch (e) {
        if (!done(t)) root.innerHTML = `${backBar()}<p class="list-empty">${esc(e.message)}</p>`;
        return;
      }
      if (done(t)) return;
    }
    const round = view.kind === "artist";
    const cover = view.kind === "liked"
      ? `<span class="thumb detail-cover liked-thumb">${icon("heartFilled")}</span>`
      : view.image ? `<img class="detail-cover${round ? " round" : ""}" src="${esc(view.image)}" alt="">` : `<span class="thumb detail-cover${round ? " round" : ""}"></span>`;
    const list = view.kind === "artist"
      ? `<li class="list-label">Alben &amp; Singles</li>${view.albums.length ? view.albums.map(albumRow).join("") : `<li class="list-empty small">Keine Alben gefunden.</li>`}`
      : view.tracks.length
        ? view.tracks.map((x, i) => trackRow(x, i, { number: view.kind === "album" })).join("")
        : view.notice ? "" : `<li class="list-empty small">Hier ist noch nichts drin.</li>`;
    root.innerHTML = `${backBar()}
      <div class="detail-head">
        ${cover}
        <div class="detail-text">
          <div class="detail-kind">${esc(view.label)}</div>
          <h3>${esc(view.title)}</h3>
          <p>${esc(view.sub)}</p>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn-pill primary" data-action="play">${icon("play")}<span>Abspielen</span></button>
        <button class="btn-pill" data-action="shuffle">${icon("shuffle")}<span>Zufall</span></button>
      </div>
      ${view.notice ? `<p class="notice">${esc(view.notice)}</p>` : ""}
      <ul class="track-list">${list}
        ${view.next ? `<li><button class="more-btn" data-more="detail">Mehr laden</button></li>` : ""}
      </ul>`;
    ctx.highlight();
  }

  function backBar() {
    const prev = stack[stack.length - 2];
    const label = !prev ? "Bibliothek" : prev.kind === "home" ? "Bibliothek" : prev.kind === "search" ? "Suche" : prev.title || "Zurück";
    return `<div class="lib-top"><button class="back-btn" data-back>${icon("back")}<span>${esc(label)}</span></button></div>`;
  }

  // ------------------------------------------------------------
  // Daten für Detailansichten
  // ------------------------------------------------------------

  async function loadDetail(view) {
    const api = ctx.api();
    if (view.kind === "liked") {
      const res = await api.savedTracks(0);
      Object.assign(view, {
        label: "Playlist", title: "Lieblingssongs", sub: `${res.total ?? 0} Songs`,
        tracks: (res.items || []).map(entryTrack).filter(Boolean), next: !!res.next, offset: 50, total: res.total,
      });
    } else if (view.kind === "playlist") {
      const meta = view.meta || findPlaylist(view.id) || {};
      Object.assign(view, {
        label: "Playlist", title: meta.name || "Playlist", sub: [meta.owner?.display_name, countOf(meta) != null ? `${countOf(meta)} Songs` : ""].filter(Boolean).join(" · "),
        image: pickImage(meta.images, 300), uri: meta.uri || `spotify:playlist:${view.id}`, tracks: [], total: countOf(meta),
      });
      try {
        const res = await api.playlistItems(view.id, 0);
        view.tracks = (res.items || []).map(entryTrack).filter((x) => x && x.uri && !x.uri.startsWith("spotify:local:"));
        view.next = !!res.next;
        view.offset = 50;
      } catch (e) {
        if (e.status !== 403 && e.status !== 404) throw e;
        view.notice = "Spotify zeigt den Inhalt fremder Playlists nicht mehr an. Abspielen geht trotzdem.";
      }
    } else if (view.kind === "album") {
      const al = await api.album(view.id);
      const tracks = (al.tracks?.items || []).map((x) => ({ ...x, album: x.album || { images: al.images, name: al.name } }));
      Object.assign(view, {
        label: al.album_type === "single" ? "Single" : "Album", title: al.name,
        sub: [artistNames(al), (al.release_date || "").slice(0, 4), `${al.total_tracks ?? tracks.length} Songs`].filter(Boolean).join(" · "),
        image: pickImage(al.images, 300), uri: al.uri, tracks, next: !!al.tracks?.next, offset: 50, total: al.total_tracks,
      });
    } else if (view.kind === "artist") {
      const [ar, albums] = await Promise.all([api.artist(view.id), api.artistAlbums(view.id).catch(() => ({ items: [] }))]);
      Object.assign(view, {
        label: "Künstler", title: ar.name, sub: (ar.genres || []).slice(0, 3).join(", ") || "Künstler",
        image: pickImage(ar.images, 300), uri: ar.uri, tracks: [], albums: (albums.items || []).filter(Boolean),
      });
    }
    view.loaded = true;
  }

  function findPlaylist(id) {
    const lists = [home?.playlists?.items, ...stack.map((v) => v.result?.playlists?.items)];
    for (const l of lists) {
      const hit = (l || []).find((p) => p?.id === id);
      if (hit) return hit;
    }
    return null;
  }

  async function loadMore(which) {
    const api = ctx.api();
    try {
      if (which === "playlists" && home?.playlists) {
        const res = await api.myPlaylists(home.playlists.items.length);
        home.playlists = { ...res, items: [...home.playlists.items, ...(res.items || [])] };
      } else {
        const view = top();
        const res = view.kind === "liked" ? await api.savedTracks(view.offset)
          : view.kind === "album" ? await api.albumTracks(view.id, view.offset)
          : await api.playlistItems(view.id, view.offset);
        const more = (res.items || []).map((e) => (view.kind === "album" ? { ...e, album: { images: view.tracks[0]?.album?.images } } : entryTrack(e))).filter(Boolean);
        view.tracks = [...view.tracks, ...more];
        view.offset += 50;
        view.next = !!res.next;
      }
      const scroll = root.scrollTop;
      render();
      requestAnimationFrame(() => (root.scrollTop = scroll));
    } catch (e) {
      ctx.handleError(e);
    }
  }

  // ------------------------------------------------------------
  // Abspielen
  // ------------------------------------------------------------

  async function playFrom(view, index, shuffle = false) {
    const tracks = view.tracks || [];
    const track = index != null ? tracks[index] : null;
    try {
      if (view.kind === "search") {
        await ctx.play({ uris: [track.uri] });
      } else if (view.kind === "liked") {
        const user = await getMe();
        const start = shuffle ? Math.floor(Math.random() * Math.max(1, tracks.length)) : index ?? 0;
        try {
          if (!user?.id) throw new Error("no user");
          await ctx.play({ context_uri: `spotify:user:${user.id}:collection`, offset: { uri: tracks[start]?.uri } }, { quiet: true });
        } catch {
          // Rückfall: die geladenen Lieblingssongs als Liste abspielen
          await ctx.play({ uris: tracks.map((x) => x.uri), offset: { position: start } });
        }
      } else {
        const body = { context_uri: view.uri };
        if (track) body.offset = { uri: track.uri };
        else if (shuffle && view.total > 1) body.offset = { position: Math.floor(Math.random() * view.total) };
        await ctx.play(body);
      }
      if (shuffle) await ctx.setShuffle(true);
      ctx.played();
    } catch (e) {
      ctx.handleError(e);
    }
  }

  // ------------------------------------------------------------
  // Ereignisse
  // ------------------------------------------------------------

  function push(view) {
    stack.push(view);
    render();
  }

  root.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-back]")) {
      stack.pop();
      if (!stack.length) stack = [{ kind: "home" }];
      render();
    } else if (t.dataset.open) {
      const [kind, id] = t.dataset.open.split(":");
      push({ kind, id, meta: kind === "playlist" ? findPlaylist(id) : null });
    } else if (t.dataset.queue) {
      try {
        await ctx.api().addToQueue(t.dataset.queue, ctx.deviceId());
        ctx.toast("Zur Warteschlange hinzugefügt");
        ctx.queued();
      } catch (err) {
        ctx.handleError(err);
      }
    } else if (t.dataset.play !== undefined) {
      playFrom(top(), Number(t.dataset.play));
    } else if (t.dataset.action === "play") {
      playFrom(top(), null);
    } else if (t.dataset.action === "shuffle") {
      playFrom(top(), null, true);
    } else if (t.dataset.more) {
      t.disabled = true;
      loadMore(t.dataset.more);
    }
  });

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearBtn.hidden = !input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (q.length < 2) {
        if (stack[0]?.kind === "search") {
          stack = [{ kind: "home" }];
          render();
        }
        return;
      }
      if (stack.length === 1 && stack[0].kind === "search" && stack[0].q === q) return;
      stack = [{ kind: "search", q }];
      render();
    }, 350);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    stack = [{ kind: "home" }];
    render();
    input.focus();
  });

  return { show, reset };
}
