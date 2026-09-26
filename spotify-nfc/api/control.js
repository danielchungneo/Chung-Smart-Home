// Playback controls for the Now playing page.
// GET /api/control?action=toggle|play|pause|next|previous|volup|voldown
import { findTargetDevice, getAccessToken, getPlayback } from './_spotify.js';

const ACTIONS = new Set(['toggle', 'play', 'pause', 'next', 'previous', 'volup', 'voldown']);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = String(req.query.action || '').toLowerCase();
  if (!ACTIONS.has(action)) {
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  try {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };
    const device = await findTargetDevice(token);
    const q = device ? `?device_id=${encodeURIComponent(device.id)}` : '';

    if (action === 'volup' || action === 'voldown') {
      const playback = await getPlayback(token);
      const current = playback?.device?.volume_percent ?? Number(process.env.VOLUME_PERCENT) ?? 40;
      const next = Math.max(0, Math.min(100, current + (action === 'volup' ? 10 : -10)));
      const id = device?.id || playback?.device?.id;
      if (!id) return res.status(404).json({ ok: false, error: 'no device' });
      const r = await fetch(
        `https://api.spotify.com/v1/me/player/volume?volume_percent=${next}&device_id=${id}`,
        { method: 'PUT', headers },
      );
      if (r.status >= 300 && r.status !== 204) {
        return res.status(200).json({ ok: false, error: `volume ${r.status}` });
      }
      return res.status(200).json({ ok: true, volume: next });
    }

    let path;
    let method = 'POST';
    if (action === 'next') {
      path = 'next';
    } else if (action === 'previous') {
      path = 'previous';
    } else if (action === 'pause') {
      path = 'pause';
      method = 'PUT';
    } else if (action === 'play') {
      path = 'play';
      method = 'PUT';
    } else {
      const playback = await getPlayback(token);
      path = playback?.is_playing ? 'pause' : 'play';
      method = 'PUT';
    }

    const r = await fetch(`https://api.spotify.com/v1/me/player/${path}${q}`, {
      method,
      headers,
    });
    if (r.status >= 300 && r.status !== 204) {
      return res.status(200).json({ ok: false, error: `spotify ${r.status}` });
    }
    return res.status(200).json({ ok: true, action });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
