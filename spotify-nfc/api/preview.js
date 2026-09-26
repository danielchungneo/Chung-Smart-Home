// Local / staging UI preview — no Spotify calls.
// Visit /api/preview (or open via `vercel dev`)
import { page } from './_spotify.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    page('Now playing', 'Kitchen speaker · preview mode', { dance: true, mock: true }),
  );
}
