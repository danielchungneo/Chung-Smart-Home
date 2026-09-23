// Shared helpers (files starting with _ are not exposed as URLs).
export async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Could not refresh Spotify token');
  return data.access_token;
}

export async function getDevices(token) {
  const r = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json();
  return data.devices || [];
}

export function page(title, message) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1c2a24;color:#e8efe9;
       font-family:ui-rounded,"SF Pro Rounded",system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
  h1{font-size:2.2rem;margin:0 0 .4rem;font-weight:700}
  p{font-size:1.05rem;opacity:.8;max-width:30ch;margin:0 auto;line-height:1.5}
</style></head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
