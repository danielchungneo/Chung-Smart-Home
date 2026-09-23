// Lists your Spotify Connect devices so you can confirm the Google Home's exact name.
// Visit /api/devices
import { getAccessToken, getDevices } from './_spotify.js';

export default async function handler(req, res) {
  const devices = await getDevices(await getAccessToken());
  res.json(devices.map(d => ({ name: d.name, type: d.type, active: d.is_active })));
}
