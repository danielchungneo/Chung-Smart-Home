// Step 1 of one-time setup: sends you to Spotify to approve access.
export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.REDIRECT_URI,
    scope: 'user-read-playback-state user-modify-playback-state',
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
