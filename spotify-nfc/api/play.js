// The URL that goes on each NFC tag:
//   https://YOUR-PROJECT.vercel.app/api/play?tag=living-room&key=YOUR_TAG_KEY
import { getAccessToken, getDevices, page } from './_spotify.js';

// One entry per NFC tag. Paste the playlist ID from its share link
// (open.spotify.com/playlist/THIS_PART?si=...).
const TAGS = {
  'living-room': { name: 'Living room mix', playlist: 'PASTE_PLAYLIST_ID_HERE' },
  'dinner':      { name: 'Dinner', playlist: 'PASTE_PLAYLIST_ID_HERE' },
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');

  if (req.query.key !== process.env.TAG_KEY) {
    return res.status(403).send(page('Tag not recognized', 'This link is missing its key.'));
  }
  const tag = TAGS[req.query.tag];
  if (!tag) {
    return res.status(404).send(page('Unknown tag', 'No playlist is set up for this tag yet.'));
  }

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

    const play = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${device.id}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_uri: `spotify:playlist:${tag.playlist}` }),
      }
    );

    if (play.status >= 300) {
      return res.send(page('Couldn’t start music', `Spotify returned an error (${play.status}).`));
    }

    // Optional: shuffle on
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${device.id}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` },
    });

    res.send(page('Now playing', `${tag.name} on ${device.name}. You can put your phone away.`));
  } catch (e) {
    res.status(500).send(page('Couldn’t start music', e.message));
  }
}
