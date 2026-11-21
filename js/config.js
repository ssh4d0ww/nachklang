// Nachklang – settings
//
// clientId: the Client ID of your app from the Spotify Developer Dashboard.
// You can leave it empty: the app then asks for it on first start
// and remembers it in the browser.
export const CONFIG = {
  clientId: "",

  // Must be registered exactly like this as a Redirect URI in the Spotify Dashboard.
  // Default: the address the app runs at (without index.html and without ?...).
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

  // how often the playback state is polled (ms)
  pollMs: 2000,
};
