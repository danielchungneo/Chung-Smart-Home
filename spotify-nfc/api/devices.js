// Lists your Spotify Connect devices so you can confirm the Google Home's exact name.
// Visit /api/devices?key=YOUR_TAG_KEY
import { getAccessToken, getDevices } from './_spotify.js';

export default async function handler(req, res) {
  if (req.query.key !== process.env.TAG_KEY) return res.status(403).send('Forbidden');
  const devices = await getDevices(await getAccessToken());
  res.json(devices.map(d => ({ name: d.name, type: d.type, active: d.is_active })));
}
