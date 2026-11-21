// Nachklang – Einstellungen
//
// clientId: die Client ID deiner App aus dem Spotify Developer Dashboard.
// Leer lassen geht auch: Dann fragt die App beim ersten Start danach
// und merkt sie sich im Browser.
export const CONFIG = {
  clientId: "",

  // Muss exakt so im Spotify Dashboard als Redirect URI eingetragen sein.
  // Standard: die Adresse, unter der die App läuft (ohne index.html und ohne ?...).
  redirectUri: location.origin + location.pathname.replace(/index\.html$/, ""),

  scopes: [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-read-recently-played",
    "user-library-read",
    "user-library-modify",
    "playlist-read-private",
    "playlist-read-collaborative",
  ],

  // wie oft der Wiedergabe-Status abgefragt wird (ms)
  pollMs: 2000,
};
