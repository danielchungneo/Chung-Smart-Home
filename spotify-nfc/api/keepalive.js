// Pinged every ~5 minutes to try to keep DEVICE_NAME in Spotify's Connect list.
// Auth: Authorization: Bearer <CRON_SECRET>  (or ?key=<CRON_SECRET>)
//
// Limits: only works while the speaker is still listed. Once Spotify drops an
// idle Google Home, this cannot wake it — only a local Cast wake (or a native
// Connect speaker like Sonos) can. Skips if another device is actively playing
// so we don't steal your phone/computer's playback.
import { getAccessToken, getDevices } from './_spotify.js';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const queryKey = String(req.query.key || '');
  return bearer === secret || queryKey === secret;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    const token = await getAccessToken();
    const devices = await getDevices(token);
    const wanted = (process.env.DEVICE_NAME || '').toLowerCase();
    const device = devices.find(d => d.name.toLowerCase() === wanted);

    if (!device) {
      return res.status(200).json({
        ok: false,
        status: 'asleep',
        message: 'Speaker not in Spotify device list; cannot wake from the cloud.',
      });
    }

    const active = devices.find(d => d.is_active);
    if (active && active.id !== device.id) {
      return res.status(200).json({
        ok: true,
        status: 'skipped',
        message: `Left active device alone (${active.name}).`,
        device: device.name,
      });
    }

    if (device.is_active) {
      return res.status(200).json({
        ok: true,
        status: 'already_active',
        device: device.name,
      });
    }

    // Touch the speaker without starting music (avoids a volume blip when possible).
    const transfer = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [device.id], play: false }),
    });

    if (transfer.status >= 300 && transfer.status !== 204) {
      return res.status(200).json({
        ok: false,
        status: 'transfer_failed',
        http: transfer.status,
        device: device.name,
      });
    }

    return res.status(200).json({
      ok: true,
      status: 'touched',
      device: device.name,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
