// Step 2 of one-time setup: Spotify sends you back here and the page shows your refresh token.
export default async function handler(req, res) {
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
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: process.env.REDIRECT_URI,
    }),
  });
  const data = await r.json();

  res.setHeader('Content-Type', 'text/html');
  res.send(data.refresh_token
    ? `<p>Copy this into Vercel as SPOTIFY_REFRESH_TOKEN:</p><textarea rows="6" cols="60">${data.refresh_token}</textarea>`
    : `<pre>Something went wrong:\n${JSON.stringify(data, null, 2)}</pre>`);
}
