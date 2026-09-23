# Spotify NFC → Google Home

Tap an NFC tag with any phone → a Spotify playlist starts on the Google Home.
Guests need no app, no Shortcut, no Wi-Fi, and no Spotify account.

## How it works

1. The NFC tag stores a plain URL: `https://YOUR-PROJECT.vercel.app/api/play?tag=<tag>&key=<TAG_KEY>`
2. The phone opens that URL in its browser (iPhone: tap the banner; Android: opens automatically).
3. The Vercel serverless function refreshes an access token with the owner's stored Spotify refresh token.
4. It finds the Google Home in the owner's Spotify Connect devices (by `DEVICE_NAME`, falling back to the active device).
5. It calls Spotify's Web API `PUT /v1/me/player/play` with the playlist as `context_uri`, then turns shuffle on.
6. The guest sees a simple "Now playing" page.

No always-on hardware is needed; Spotify's cloud delivers the command to the speaker.

## Project structure

```
spotify-nfc/
├── api/
│   ├── _spotify.js    # shared helpers (underscore = not a public route on Vercel)
│   ├── play.js        # the endpoint the NFC tags point to; TAGS map lives here
│   ├── devices.js     # lists Spotify Connect devices (protected by TAG_KEY)
│   ├── login.js       # one-time setup: redirect to Spotify authorization
│   └── callback.js    # one-time setup: exchanges code, displays refresh token
├── .env.example
├── .gitignore
├── package.json       # "type": "module" so the api files can use ESM imports
└── IMPLEMENTATION.md
```

Runtime: Vercel Node.js serverless functions (Node 18+, global `fetch`). No dependencies to install.

## Notes for Cursor

- Keep the code as plain Vercel Node functions in `/api`. Do not convert to Next.js, Express, or add a framework.
- Do not add npm dependencies; everything uses built-in `fetch` and `Buffer`.
- Never commit real secrets. All secrets are Vercel environment variables (see table below).
- Keep `_spotify.js` prefixed with an underscore so Vercel does not expose it as a route.
- Required Spotify scopes: `user-read-playback-state user-modify-playback-state`.
- Spotify playback control requires the account to have **Spotify Premium**.
- The only file the owner should normally edit is the `TAGS` object in `api/play.js`.

## Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Variable | Where it comes from |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify developer dashboard → your app |
| `SPOTIFY_CLIENT_SECRET` | Spotify developer dashboard → your app |
| `REDIRECT_URI` | `https://YOUR-PROJECT.vercel.app/api/callback` (must match the Spotify app exactly) |
| `SPOTIFY_REFRESH_TOKEN` | Shown on the `/api/callback` page after step 6 |
| `DEVICE_NAME` | Exact speaker name as shown in Spotify's device picker |
| `TAG_KEY` | Any long random string you make up; it's included in every tag URL |

After adding or changing any variable, redeploy (Deployments → ⋯ → Redeploy).

## Setup checklist

### Accounts needed
- [ ] Spotify **Premium** (the account the music plays from)
- [ ] Spotify Developer (same Spotify login, at developer.spotify.com)
- [ ] GitHub (hosts this repo)
- [ ] Vercel (free tier; sign in with GitHub)
- [ ] Google Home app (already set up) and an NFC writing app (e.g. NFC Tools)

### 1. Link Spotify to the Google Home
- [ ] Google Home app → Settings → Music → link Spotify Premium and set it as default.
- [ ] In Spotify, open the device picker and note the speaker's **exact** name.

### 2. Push this code to GitHub
- [ ] Commit these files to the repo and push.

### 3. Deploy on Vercel
- [ ] Vercel → Add New → Project → import the repo → Deploy with defaults (Framework preset: Other).
- [ ] Copy the production URL (e.g. `spotify-nfc-abc.vercel.app`). It won't work yet; that's expected.

### 4. Create the Spotify developer app
- [ ] developer.spotify.com/dashboard → Create app.
- [ ] Redirect URI: `https://YOUR-PROJECT.vercel.app/api/callback`
- [ ] API: check **Web API**. Save.
- [ ] Copy the Client ID and Client Secret.

### 5. Add environment variables
- [ ] Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `REDIRECT_URI`, `DEVICE_NAME`, `TAG_KEY`.
- [ ] Redeploy.

### 6. Authorize once
- [ ] Visit `https://YOUR-PROJECT.vercel.app/api/login` and approve.
- [ ] Copy the refresh token shown on the callback page.
- [ ] Add it as `SPOTIFY_REFRESH_TOKEN` and redeploy.

### 7. Add playlists
- [ ] In Spotify: playlist → Share → Copy link. The ID is the part after `/playlist/` and before `?`.
- [ ] Edit `TAGS` in `api/play.js`, e.g.:

```js
const TAGS = {
  'living-room': { name: 'Living room mix', playlist: '37i9dQZF1DXcBWIGoYBM5M' },
  'dinner':      { name: 'Dinner', playlist: 'PASTE_PLAYLIST_ID_HERE' },
};
```
- [ ] Commit and push; Vercel redeploys automatically.

### 8. Test in a browser
- [ ] `https://YOUR-PROJECT.vercel.app/api/devices?key=YOUR_TAG_KEY` lists the speaker.
- [ ] `https://YOUR-PROJECT.vercel.app/api/play?tag=living-room&key=YOUR_TAG_KEY` starts music on the Google Home.

### 9. Write the NFC tags
- [ ] NFC Tools → Write → Add a record → **URL** → paste the play URL for that tag → hold phone to tag.
- [ ] One tag per entry in `TAGS`.

### 10. Real-world tests
- [ ] Tap with a phone that has never been on your Wi-Fi.
- [ ] Tap the next morning after the speaker has been idle overnight.

### 11. Clean up (optional)
- [ ] Delete `api/login.js` and `api/callback.js` once the refresh token is saved.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| "Tag not recognized" | `key` in the URL doesn't match `TAG_KEY`. Check for typos, then redeploy if you changed the variable. |
| "Unknown tag" | The `tag` value in the URL isn't a key in `TAGS`. |
| "Speaker is asleep" | Spotify stopped listing the idle Google Home. Cast to it once from the Spotify app, then tap again. If this happens often, a local device (e.g. Raspberry Pi with Home Assistant + Spotcast) can wake it. |
| Spotify error 403 | Account isn't Premium, or the app lacks the playback scopes. Redo step 6. |
| Spotify error 404 | Device not found or the playlist ID is wrong. Check `/api/devices` and the ID. |
| `INVALID_CLIENT: Invalid redirect URI` | `REDIRECT_URI` doesn't exactly match the URI saved in the Spotify dashboard. |
| "Could not refresh Spotify token" | `SPOTIFY_REFRESH_TOKEN`, client ID, or secret is wrong or missing. Redo step 6. |
| Music plays on the wrong device | `DEVICE_NAME` doesn't match exactly, so it fell back to the active device. Copy the name from `/api/devices`. |

## Security notes

- Anyone with a tag URL can start playback, so treat `TAG_KEY` like a password. To rotate it, change the variable, redeploy, and rewrite the tags.
- Guests never see or use your Spotify credentials; they only load a web page.
- Spotify developer apps in development mode only work for the app owner and allowlisted users, so strangers can't use `/api/login` to link their own accounts.
