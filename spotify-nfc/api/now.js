// Current track / playback state for the Now playing page.
// GET /api/now
import { getAccessToken, getPlayback } from './_spotify.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const token = await getAccessToken();
    const playback = await getPlayback(token);

    if (!playback || !playback.item) {
      return res.status(200).json({ ok: true, track: null, isPlaying: false, volume: null });
    }

    const item = playback.item;
    const images = item.album?.images || [];
    const image = images[images.length - 1]?.url || images[0]?.url || null;

    return res.status(200).json({
      ok: true,
      isPlaying: Boolean(playback.is_playing),
      volume: playback.device?.volume_percent ?? null,
      track: {
        name: item.name,
        artists: (item.artists || []).map(a => a.name).join(', '),
        image,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
