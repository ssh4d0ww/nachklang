// Nachklang – App-Logik
import { CONFIG } from "./config.js";
import { store } from "./store.js";
import * as auth from "./auth.js";
import { createSpotifyApi } from "./api.js";
import { createDemoApi } from "./demo.js";
import { coverTint } from "./color.js";
import { icon, deviceIcon, hydrateIcons } from "./icons.js";

const $ = (sel) => document.querySelector(sel);

const el = {
  login: $("#login"),
  player: $("#player"),
  clientSetup: $("#client-setup"),
  clientId: $("#client-id"),
  redirectUri: $("#redirect-uri"),
  cover: $("#cover"),
  title: $("#title"),
  artist: $("#artist"),
  like: $("#btn-like"),
  play: $("#btn-play"),
  shuffle: $("#btn-shuffle"),
  repeat: $("#btn-repeat"),
  progress: $("#progress"),
  track: $("#progress-track"),
  fill: $("#progress-fill"),
  tPos: $("#t-pos"),
  tDur: $("#t-dur"),
  deviceBtn: $("#btn-device"),
  deviceName: $("#device-name"),
  deviceIcon: $("#device-icon"),
  volumeRow: $("#volume-row"),
  volume: $("#volume"),
  demoBadge: $("#demo-badge"),
  side: $("#side"),
  list: $("#list"),
  devices: $("#sheet-devices"),
  deviceList: $("#device-list"),
  menu: $("#sheet-menu"),
  menuTitle: $("#menu-title"),
  logout: $("#btn-logout"),
  scrim: $("#scrim"),
  toast: $("#toast"),
  bdLayers: [...document.querySelectorAll(".bd-layer")],
};

const MODE_KEY = "nk.mode";
const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const wide = window.matchMedia("(min-width: 900px) and (min-height: 560px)");

let api = null;
let state = null; // aufbereiteter Wiedergabe-Status (siehe normalize)
let fetchedAt = 0; // wann state.progress gemessen wurde
let pollTimer = null;
let pausedUntil = 0; // nach 429: Abfragen kurz aussetzen
let quietUntil = 0; // nach eigenen Aktionen: alte Antworten nicht anzeigen
let pollErrors = 0;
let likeFor = null;
let seekMs = null;
let tab = "queue";
let openSheetEl = null;
let lastSecond = -1;

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------

async function init() {
  hydrateIcons();
  bindEvents();
  registerServiceWorker();

  try {
    if (await auth.handleRedirect()) {
      store.set(MODE_KEY, "spotify");
      toast("Mit Spotify verbunden");
    }
  } catch (e) {
    toast(e.message, 4000);
  }

  const wanted = new URLSearchParams(location.search).has("demo") ? "demo" : store.get(MODE_KEY);
  if (wanted === "demo") startDemo();
  else if (auth.isLoggedIn()) startSpotify();
  else showLogin();

  requestAnimationFrame(tick);
}

function showLogin() {
  stopPolling();
  api = null;
  el.player.hidden = true;
  el.login.hidden = false;
  el.redirectUri.textContent = CONFIG.redirectUri;
  const missing = !auth.getClientId();
  el.clientSetup.hidden = !missing && !!CONFIG.clientId;
  el.clientId.value = auth.getClientId();
  setBackdrop(null);
  // in einer eingebetteten Vorschau (iframe) klappt der Spotify-Login nicht
  if (embedded) {
    el.clientSetup.hidden = true;
    $("#btn-login").hidden = true;
    $("#embed-note").hidden = false;
  }
}

function startSpotify() {
  api = createSpotifyApi();
  store.set(MODE_KEY, "spotify");
  enterPlayer();
}

function startDemo() {
  api = createDemoApi();
  store.set(MODE_KEY, "demo");
  enterPlayer();
  toast("Demo: Musik und Geräte sind nur simuliert");
}

function enterPlayer() {
  el.login.hidden = true;
  el.player.hidden = false;
  el.demoBadge.hidden = api.kind !== "demo";
  el.logout.textContent = api.kind === "demo" ? "Demo beenden" : "Abmelden";
  el.menuTitle.textContent = "Nachklang";
  state = null;
  likeFor = null;
  render();
  refresh();
  startPolling();
  if (wide.matches) loadList();
  api.me().then((me) => me?.display_name && (el.menuTitle.textContent = me.display_name)).catch(() => {});
}

// ------------------------------------------------------------------
// Status holen
// ------------------------------------------------------------------

function normalize(raw) {
  if (!raw || !raw.item) {
    return raw?.device ? { device: raw.device, empty: true } : null;
  }
  const item = raw.item;
  const episode = item.type === "episode";
  const images = (episode ? item.images || item.show?.images : item.album?.images) || [];
  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists: episode ? item.show?.name || "" : (item.artists || []).map((a) => a.name).join(", "),
    cover: pickImage(images, 640),
    duration: item.duration_ms || 0,
    progress: raw.progress_ms || 0,
    playing: !!raw.is_playing,
    shuffle: !!raw.shuffle_state,
    repeat: raw.repeat_state || "off",
    device: raw.device || null,
  };
}

function pickImage(images, want) {
  if (!images.length) return "";
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  return (sorted.find((i) => (i.width || 0) >= want) || sorted[sorted.length - 1]).url;
}

async function refresh() {
  if (!api || Date.now() < pausedUntil) return;
  const asked = Date.now();
  try {
    const raw = await api.playbackState();
    pollErrors = 0;
    // eine Aktion war schneller als diese Antwort -> verwerfen
    if (asked < quietUntil) return;
    applyState(normalize(raw));
  } catch (e) {
    handleError(e, true);
  }
}

function applyState(next) {
  const prevId = state?.id;
  state = next;
  fetchedAt = performance.now();
  render();
  if (state?.id && state.id !== prevId) onTrackChange();
  if (!state?.id && prevId) {
    setBackdrop(null);
    likeFor = null;
    el.like.setAttribute("aria-pressed", "false");
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, CONFIG.pollMs);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

// nach einer Aktion: ein bisschen warten, dann frisch nachfragen
function settle(delays = [500, 1500]) {
  quietUntil = Date.now() + delays[0] - 50;
  for (const d of delays) setTimeout(refresh, d);
}

// ------------------------------------------------------------------
// Anzeigen
// ------------------------------------------------------------------

function render() {
  const s = state;
  const hasTrack = !!s?.id;
  const root = el.player;
  root.classList.toggle("has-track", hasTrack);
  root.classList.toggle("no-track", !hasTrack);
  root.classList.toggle("is-playing", !!s?.playing);
  root.classList.toggle("is-paused", !s?.playing);

  if (hasTrack) {
    el.title.textContent = s.name;
    el.artist.textContent = s.artists;
    if (el.cover.dataset.src !== s.cover) setCover(s.cover);
    el.tDur.textContent = fmt(s.duration);
    document.title = `${s.name} · ${s.artists}`;
  } else {
    el.title.textContent = "Gerade läuft nichts";
    el.artist.textContent = s?.device ? `Bereit auf ${s.device.name}` : "Starte Spotify oder wähle ein Gerät.";
    setCover("");
    el.tDur.textContent = "0:00";
    el.tPos.textContent = "0:00";
    el.fill.style.transform = "scaleX(0)";
    document.title = "Nachklang";
  }

  el.play.setAttribute("aria-label", s?.playing ? "Pause" : "Abspielen");
  el.shuffle.setAttribute("aria-pressed", String(!!s?.shuffle));
  el.repeat.setAttribute("aria-pressed", String(!!s && s.repeat !== "off"));
  el.repeat.classList.toggle("is-one", s?.repeat === "track");

  const dev = s?.device;
  el.deviceName.textContent = dev ? dev.name : "Gerät wählen";
  el.deviceIcon.innerHTML = dev ? deviceIcon(dev.type) : icon("device");
  el.deviceBtn.classList.toggle("is-live", !!s?.playing);

  const canVolume = !!dev && dev.supports_volume !== false && dev.volume_percent != null;
  el.volumeRow.hidden = !canVolume;
  if (canVolume && document.activeElement !== el.volume && !volumeTimer) {
    el.volume.value = dev.volume_percent;
    paintRange(el.volume);
  }
}

function setCover(url) {
  el.cover.dataset.src = url;
  if (!url) {
    el.cover.classList.remove("is-loaded");
    el.cover.removeAttribute("src");
    return;
  }
  el.cover.classList.remove("is-loaded");
  const img = new Image();
  img.onload = () => {
    if (el.cover.dataset.src !== url) return;
    el.cover.src = url;
    el.cover.classList.add("is-loaded");
  };
  img.src = url;
}

function onTrackChange() {
  setBackdrop(state.cover);
  checkLiked();
  if (wide.matches || openSheetEl === el.side) loadList();
}

let bdIndex = 0;
let bdUrl = null;

function setBackdrop(url) {
  if (url === bdUrl) return;
  bdUrl = url;
  const [a, b] = [el.bdLayers[bdIndex], el.bdLayers[bdIndex ^ 1]];
  if (!url) {
    a.classList.remove("is-on");
    b.classList.remove("is-on");
    document.documentElement.style.removeProperty("--tint");
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (bdUrl !== url) return;
    b.style.backgroundImage = `url("${url}")`;
    b.classList.add("is-on");
    a.classList.remove("is-on");
    bdIndex ^= 1;
  };
  img.src = url;
  coverTint(url).then((rgb) => {
    if (bdUrl !== url) return;
    if (rgb) document.documentElement.style.setProperty("--tint", rgb.join(" "));
    else document.documentElement.style.removeProperty("--tint");
  });
}

// läuft mit der Bildwiederholrate: Fortschritt flüssig weiterzählen
function tick() {
  requestAnimationFrame(tick);
  if (!state?.id) return;
  const pos = seekMs ?? currentPosition();
  const ratio = state.duration ? Math.min(1, pos / state.duration) : 0;
  el.fill.style.transform = `scaleX(${ratio})`;
  const sec = Math.floor(pos / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    el.tPos.textContent = fmt(pos);
    el.track.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  }
  // Lied zu Ende -> gleich nachfragen statt auf die nächste Runde zu warten
  if (state.playing && pos >= state.duration && performance.now() - fetchedAt > 900) {
    fetchedAt = performance.now();
    setTimeout(refresh, 300);
  }
}

function currentPosition() {
  if (!state) return 0;
  const elapsed = state.playing ? performance.now() - fetchedAt : 0;
  return Math.min(state.duration, state.progress + elapsed);
}

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// ------------------------------------------------------------------
// Aktionen
// ------------------------------------------------------------------

const deviceId = () => state?.device?.id;

async function togglePlay() {
  if (!state?.id) return openDevices();
  const pos = currentPosition();
  const wasPlaying = state.playing;
  state.progress = pos;
  state.playing = !wasPlaying;
  fetchedAt = performance.now();
  render();
  try {
    await (wasPlaying ? api.pause(deviceId()) : api.play(deviceId()));
    settle();
  } catch (e) {
    handleError(e);
    refresh();
  }
}

async function skip(dir) {
  if (!state?.id) return;
  if (dir < 0 && currentPosition() > 3000) {
    state.progress = 0;
    fetchedAt = performance.now();
  }
  try {
    await (dir > 0 ? api.next(deviceId()) : api.previous(deviceId()));
    settle([400, 1200, 2500]);
  } catch (e) {
    handleError(e);
  }
}

async function toggleShuffle() {
  if (!state?.id) return;
  state.shuffle = !state.shuffle;
  render();
  try {
    await api.shuffle(state.shuffle, deviceId());
    settle();
    if (wide.matches || openSheetEl === el.side) setTimeout(loadList, 700);
  } catch (e) {
    handleError(e);
    refresh();
  }
}

async function cycleRepeat() {
  if (!state?.id) return;
  const order = ["off", "context", "track"];
  state.repeat = order[(order.indexOf(state.repeat) + 1) % order.length];
  render();
  try {
    await api.repeat(state.repeat, deviceId());
    settle();
  } catch (e) {
    handleError(e);
    refresh();
  }
}

async function seekTo(ms) {
  state.progress = ms;
  fetchedAt = performance.now();
  try {
    await api.seek(ms, deviceId());
    settle();
  } catch (e) {
    handleError(e);
    refresh();
  }
}

async function checkLiked() {
  const uri = state?.uri;
  likeFor = uri;
  el.like.setAttribute("aria-pressed", "false");
  if (!uri || uri.startsWith("spotify:local:")) return;
  try {
    const [saved] = await api.isSaved(uri);
    if (likeFor === uri) el.like.setAttribute("aria-pressed", String(!!saved));
  } catch {
    /* nicht schlimm: Herz bleibt leer */
  }
}

async function toggleLike() {
  const uri = state?.uri;
  if (!uri) return;
  const saved = el.like.getAttribute("aria-pressed") === "true";
  el.like.setAttribute("aria-pressed", String(!saved));
  try {
    await (saved ? api.unsave(uri) : api.save(uri));
    toast(saved ? "Aus Lieblingssongs entfernt" : "Zu Lieblingssongs hinzugefügt");
  } catch (e) {
    el.like.setAttribute("aria-pressed", String(saved));
    handleError(e);
  }
}

let volumeTimer = null;

function onVolumeInput() {
  paintRange(el.volume);
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(async () => {
    volumeTimer = null;
    const v = Number(el.volume.value);
    if (state?.device) state.device.volume_percent = v;
    try {
      await api.volume(v, deviceId());
      settle([800]);
    } catch (e) {
      handleError(e);
      refresh();
    }
  }, 250);
}

function paintRange(input) {
  input.style.setProperty("--pct", `${input.value}%`);
}

// Fortschrittsbalken ziehen
function bindSeek() {
  const toMs = (clientX) => {
    const r = el.track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return ratio * (state?.duration || 0);
  };
  el.track.addEventListener("pointerdown", (e) => {
    if (!state?.id) return;
    el.track.setPointerCapture(e.pointerId);
    el.progress.classList.add("is-seeking");
    seekMs = toMs(e.clientX);
  });
  el.track.addEventListener("pointermove", (e) => {
    if (seekMs === null) return;
    seekMs = toMs(e.clientX);
  });
  const end = (e) => {
    if (seekMs === null) return;
    const ms = e.type === "pointercancel" ? null : toMs(e.clientX);
    seekMs = null;
    el.progress.classList.remove("is-seeking");
    if (ms !== null) seekTo(ms);
  };
  el.track.addEventListener("pointerup", end);
  el.track.addEventListener("pointercancel", end);
  el.track.addEventListener("keydown", (e) => {
    if (!state?.id) return;
    const step = e.key === "ArrowRight" ? 10000 : e.key === "ArrowLeft" ? -10000 : 0;
    if (!step) return;
    e.preventDefault();
    seekTo(Math.max(0, Math.min(state.duration - 1000, currentPosition() + step)));
  });
}

// ------------------------------------------------------------------
// Listen: Warteschlange und zuletzt gehört
// ------------------------------------------------------------------

function trackRow(item, { button = false, meta = "" } = {}) {
  const episode = item.type === "episode";
  const images = (episode ? item.images || item.show?.images : item.album?.images) || [];
  const img = pickImage(images, 120);
  const sub = episode ? item.show?.name || "" : (item.artists || []).map((a) => a.name).join(", ");
  const tag = button ? "button" : "div";
  return `<li><${tag} class="row" ${button ? `data-uri="${esc(item.uri)}"` : ""}>
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb"></span>`}
      <span class="row-text"><div class="row-title">${esc(item.name)}</div><div class="row-sub">${esc(sub)}</div></span>
      ${meta ? `<span class="row-meta">${esc(meta)}</span>` : ""}
    </${tag}></li>`;
}

function skeleton(n = 6) {
  return Array.from({ length: n }, () => `<li><div class="row skeleton"><span class="thumb"></span><span class="row-text"><div class="bar" style="width:60%"></div><div class="bar" style="width:38%"></div></span></div></li>`).join("");
}

let listToken = 0;

async function loadList() {
  if (!api) return;
  const token = ++listToken;
  if (!el.list.children.length || el.list.dataset.tab !== tab) el.list.innerHTML = skeleton();
  el.list.dataset.tab = tab;
  try {
    let html = "";
    if (tab === "queue") {
      const q = await api.queue();
      const items = (q?.queue || []).filter(Boolean).slice(0, 40);
      if (q?.currently_playing) html += `<li class="list-label">Läuft gerade</li>` + trackRow(q.currently_playing, { meta: fmt(q.currently_playing.duration_ms) });
      html += items.length
        ? `<li class="list-label">Als Nächstes</li>` + items.map((t) => trackRow(t, { meta: fmt(t.duration_ms) })).join("")
        : `<li class="list-empty">Die Warteschlange ist leer.</li>`;
    } else {
      const r = await api.recent();
      const seen = new Set();
      const items = (r?.items || []).filter((i) => i.track && !seen.has(i.track.id) && seen.add(i.track.id));
      recentContext = new Map(items.map((i) => [i.track.uri, i.context]));
      html = items.length
        ? items.map((i) => trackRow(i.track, { button: true, meta: ago(i.played_at) })).join("")
        : `<li class="list-empty">Noch nichts gehört.</li>`;
    }
    if (token === listToken) el.list.innerHTML = html;
  } catch (e) {
    if (token === listToken) el.list.innerHTML = `<li class="list-empty">${esc(e.message || "Konnte nicht geladen werden.")}</li>`;
  }
}

let recentContext = new Map();

async function playFromList(uri) {
  const ctx = recentContext.get(uri);
  const body = ctx && /^(album|playlist)$/.test(ctx.type) ? { context_uri: ctx.uri, offset: { uri } } : { uris: [uri] };
  try {
    if (!deviceId()) {
      const d = await api.devices();
      const target = d?.devices?.find((x) => x.is_active) || d?.devices?.[0];
      if (!target) throw Object.assign(new Error("Kein Gerät gefunden. Öffne Spotify auf einem Gerät."), { status: 404 });
      await api.play(target.id, body);
    } else {
      await api.play(deviceId(), body);
    }
    if (!wide.matches) closeSheet();
    settle([400, 1200, 2500]);
  } catch (e) {
    handleError(e);
  }
}

function ago(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} T`;
}

// ------------------------------------------------------------------
// Geräte
// ------------------------------------------------------------------

async function openDevices() {
  openSheet(el.devices);
  el.deviceList.innerHTML = skeleton(3);
  try {
    const d = await api.devices();
    const list = d?.devices || [];
    el.deviceList.innerHTML = list.length
      ? list
          .map(
            (x) => `<li><button class="row${x.is_active ? " is-active" : ""}" data-device="${esc(x.id)}">
              <span class="dev-icon">${deviceIcon(x.type)}</span>
              <span class="row-text"><div class="row-title">${esc(x.name)}</div>
              <div class="row-sub">${x.is_active ? (state?.playing ? "Spielt gerade" : "Aktiv") : typeLabel(x.type)}</div></span>
            </button></li>`
          )
          .join("")
      : `<li class="list-empty">Kein Gerät gefunden.<br>Öffne Spotify auf deinem Handy oder PC.</li>`;
  } catch (e) {
    el.deviceList.innerHTML = `<li class="list-empty">${esc(e.message)}</li>`;
  }
}

async function chooseDevice(id) {
  closeSheet();
  if (id === deviceId()) return;
  try {
    await api.transfer(id, state?.playing ?? true);
    toast("Wiedergabe gewechselt");
    settle([600, 1600, 3000]);
  } catch (e) {
    handleError(e);
  }
}

function typeLabel(type) {
  const map = { Computer: "Computer", Smartphone: "Handy", Speaker: "Lautsprecher", TV: "Fernseher", Tablet: "Tablet", CastAudio: "Cast-Lautsprecher", CastVideo: "Chromecast", AVR: "Receiver", GameConsole: "Konsole", Automobile: "Auto" };
  return map[type] || type || "Gerät";
}

// ------------------------------------------------------------------
// Sheets, Toast, Fehler
// ------------------------------------------------------------------

function openSheet(sheet) {
  if (openSheetEl && openSheetEl !== sheet) openSheetEl.classList.remove("is-open");
  openSheetEl = sheet;
  sheet.classList.add("is-open");
  el.scrim.hidden = false;
}

function closeSheet() {
  if (!openSheetEl) return;
  openSheetEl.classList.remove("is-open");
  openSheetEl = null;
  el.scrim.hidden = true;
}

// Sheet nach unten wischen zum Schließen
function bindSheetSwipe(sheet) {
  let startY = null;
  let dy = 0;
  const grip = sheet.querySelector(".sheet-grip");
  const head = sheet.querySelector(".side-head");
  for (const handle of [grip, head]) {
    handle.addEventListener("pointerdown", (e) => {
      if (wide.matches && sheet === el.side) return;
      if (e.target.closest("button")) return;
      startY = e.clientY;
      dy = 0;
      sheet.style.transition = "none";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (dy > 80) closeSheet();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
}

let toastTimer = null;

function toast(text, ms = 2400) {
  el.toast.textContent = text;
  el.toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-on"), ms);
}

function handleError(e, fromPoll = false) {
  if (e instanceof auth.AuthError) {
    toast(e.message, 3500);
    store.remove(MODE_KEY);
    showLogin();
    return;
  }
  if (e.status === 429) {
    pausedUntil = Date.now() + (e.retryAfter || 5) * 1000;
    if (!fromPoll) toast(e.message);
    return;
  }
  if (fromPoll) {
    // beim Abfragen nur melden, wenn es mehrmals hintereinander schiefgeht
    if (++pollErrors === 3) toast(e.message || "Verbindung hakt.", 3000);
    return;
  }
  toast(e.message || "Das hat nicht geklappt.", 3000);
  if (e.status === 404 || e.reason === "NO_ACTIVE_DEVICE") openDevices();
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------------
// Ereignisse
// ------------------------------------------------------------------

function bindEvents() {
  $("#btn-login").addEventListener("click", async () => {
    const typed = el.clientId.value.trim();
    if (typed) auth.setClientId(typed);
    if (!auth.getClientId()) {
      el.clientSetup.hidden = false;
      el.clientId.focus();
      toast("Bitte zuerst die Client ID eintragen.");
      return;
    }
    try {
      await auth.login();
    } catch (e) {
      toast(e.message, 3500);
    }
  });
  $("#btn-demo").addEventListener("click", startDemo);
  $("#copy-redirect").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.redirectUri);
      toast("Redirect URI kopiert");
    } catch {
      toast("Kopieren ging nicht – bitte markieren.");
    }
  });

  el.play.addEventListener("click", togglePlay);
  $("#btn-next").addEventListener("click", () => skip(1));
  $("#btn-prev").addEventListener("click", () => skip(-1));
  el.shuffle.addEventListener("click", toggleShuffle);
  el.repeat.addEventListener("click", cycleRepeat);
  el.like.addEventListener("click", toggleLike);
  el.volume.addEventListener("input", onVolumeInput);
  bindSeek();

  el.deviceBtn.addEventListener("click", openDevices);
  $("#btn-queue").addEventListener("click", () => {
    openSheet(el.side);
    loadList();
  });
  $("#btn-menu").addEventListener("click", () => openSheet(el.menu));
  $("#btn-reload").addEventListener("click", () => location.reload());
  el.logout.addEventListener("click", () => {
    closeSheet();
    if (api?.kind === "spotify") auth.logout();
    store.remove(MODE_KEY);
    if (location.search) history.replaceState(null, "", location.pathname);
    state = null;
    showLogin();
  });

  el.scrim.addEventListener("click", closeSheet);
  for (const btn of document.querySelectorAll("[data-close]")) btn.addEventListener("click", closeSheet);
  for (const sheet of [el.side, el.devices, el.menu]) bindSheetSwipe(sheet);

  for (const btn of document.querySelectorAll(".segmented button")) {
    btn.addEventListener("click", () => {
      tab = btn.dataset.tab;
      for (const b of document.querySelectorAll(".segmented button")) {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      }
      loadList();
    });
  }
  el.list.addEventListener("click", (e) => {
    const row = e.target.closest("button[data-uri]");
    if (row) playFromList(row.dataset.uri);
  });
  el.deviceList.addEventListener("click", (e) => {
    const row = e.target.closest("button[data-device]");
    if (row) chooseDevice(row.dataset.device);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
    if (e.code === "Space" && !el.player.hidden && !/INPUT|BUTTON/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      togglePlay();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && api) refresh();
  });
  wide.addEventListener("change", () => {
    if (wide.matches) {
      if (openSheetEl === el.side) closeSheet();
      if (api) loadList();
    }
  });
}

function registerServiceWorker() {
  try {
    if (!("serviceWorker" in navigator) || !window.isSecureContext || embedded) return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch {
    /* z. B. in einer gesperrten Vorschau: ohne Offline-Cache weiter */
  }
}

init();
