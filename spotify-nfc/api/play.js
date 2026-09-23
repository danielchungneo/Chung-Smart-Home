// The URL that goes on each NFC tag:
//   https://YOUR-PROJECT.vercel.app/api/play?playlist=PLAYLIST_ID
// Optional: &name=Dinner  (shown on the "Now playing" page)
import { getAccessToken, getDevices, page } from './_spotify.js';

// Spotify playlist IDs are base62 (letters, digits). Reject anything else.
const PLAYLIST_ID = /^[A-Za-z0-9]{10,40}$/;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  const playlist = String(req.query.playlist || '').trim();
  if (!PLAYLIST_ID.test(playlist)) {
    return res.status(400).send(page('Missing playlist',
      'This link needs a valid Spotify playlist ID in the URL.'));
  }

  const name = String(req.query.name || 'Playlist').slice(0, 80);

  try {
    const token = await getAccessToken();
    const devices = await getDevices(token);
    const wanted = (process.env.DEVICE_NAME || '').toLowerCase();
    const device =
      devices.find(d => d.name.toLowerCase() === wanted) ||
      devices.find(d => d.is_active);

    if (!device) {
      return res.send(page('Speaker is asleep',
        'Open Spotify, cast to the speaker once, then tap the tag again.'));
    }

    const headers = { Authorization: `Bearer ${token}` };
    const id = device.id;

    // Start the playlist, then turn shuffle on and skip once so the first
    // audible track is random (shuffle alone keeps the playlist's first song).
    const play = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${id}`,
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_uri: `spotify:playlist:${playlist}` }),
      }
    );

    if (play.status >= 300) {
      return res.send(page('Couldn’t start music', `Spotify returned an error (${play.status}).`));
    }

    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${id}`, {
      method: 'PUT', headers,
    });
    await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${id}`, {
      method: 'POST', headers,
    });

    res.send(page('Now playing', `${name} on ${device.name}. You can put your phone away.`));
  } catch (e) {
    res.status(500).send(page('Couldn’t start music', e.message));
  }
}
