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

export async function findTargetDevice(token) {
  const devices = await getDevices(token);
  const wanted = (process.env.DEVICE_NAME || '').toLowerCase();
  return (
    devices.find(d => d.name.toLowerCase() === wanted) ||
    devices.find(d => d.is_active) ||
    null
  );
}

export async function getPlayback(token) {
  const r = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 204) return null;
  if (!r.ok) return null;
  return r.json();
}

// Asks the always-on home laptop (through its Tailscale Funnel URL) to wake
// the Google Home over the LAN. The laptop replies once Spotify lists the
// speaker again. Returns true on success, false if not configured or it failed.
export async function wakeSpeaker() {
  const url = process.env.WAKE_URL;
  const secret = process.env.WAKE_SECRET;
  if (!url || !secret) return false;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(25000),
    });
    const data = await r.json().catch(() => ({}));
    return r.ok && data.ok === true;
  } catch {
    return false;
  }
}

const DANCING_PANDA = `
<div class="stage" aria-hidden="true">
  <span class="note n1">♪</span>
  <span class="note n2">♫</span>
  <span class="note n3">♪</span>
  <svg class="panda" viewBox="0 0 120 140" width="140" height="163">
    <ellipse class="shadow" cx="60" cy="132" rx="28" ry="6" fill="#000" opacity=".25"/>
    <g class="body">
      <ellipse cx="60" cy="95" rx="32" ry="28" fill="#f5f5f5"/>
      <ellipse cx="60" cy="95" rx="18" ry="16" fill="#1a1a1a"/>
      <g class="arm-l">
        <ellipse cx="28" cy="88" rx="10" ry="16" fill="#1a1a1a" transform="rotate(-20 28 88)"/>
      </g>
      <g class="arm-r">
        <ellipse cx="92" cy="88" rx="10" ry="16" fill="#1a1a1a" transform="rotate(20 92 88)"/>
      </g>
      <g class="leg-l">
        <ellipse cx="42" cy="118" rx="11" ry="14" fill="#1a1a1a"/>
      </g>
      <g class="leg-r">
        <ellipse cx="78" cy="118" rx="11" ry="14" fill="#1a1a1a"/>
      </g>
      <g class="head">
        <circle cx="38" cy="38" r="14" fill="#1a1a1a"/>
        <circle cx="82" cy="38" r="14" fill="#1a1a1a"/>
        <circle cx="60" cy="52" r="28" fill="#f5f5f5"/>
        <ellipse cx="48" cy="50" rx="10" ry="11" fill="#1a1a1a"/>
        <ellipse cx="72" cy="50" rx="10" ry="11" fill="#1a1a1a"/>
        <circle cx="50" cy="48" r="3.5" fill="#fff"/>
        <circle cx="74" cy="48" r="3.5" fill="#fff"/>
        <ellipse cx="60" cy="60" rx="7" ry="5" fill="#1a1a1a"/>
        <ellipse cx="60" cy="66" rx="5" ry="3" fill="#3a3a3a"/>
        <path d="M54 68 Q60 72 66 68" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>
      </g>
    </g>
  </svg>
</div>`;

const PLAYER = `
<div class="track">
  <img class="art" id="art" alt="" width="72" height="72" hidden>
  <div class="track-text">
    <div class="song" id="song">Loading…</div>
    <div class="artist" id="artist"></div>
  </div>
</div>
<div class="controls" role="group" aria-label="Playback">
  <button type="button" data-action="previous" aria-label="Previous">⏮</button>
  <button type="button" class="main" data-action="toggle" aria-label="Play or pause" id="toggle">⏸</button>
  <button type="button" data-action="next" aria-label="Next">⏭</button>
</div>
<div class="volume" role="group" aria-label="Volume">
  <button type="button" data-action="voldown" aria-label="Volume down">−</button>
  <span class="vol-label" id="vol">—</span>
  <button type="button" data-action="volup" aria-label="Volume up">+</button>
</div>`;

const PLAYER_SCRIPT = `
<script>
(function () {
  const song = document.getElementById('song');
  const artist = document.getElementById('artist');
  const art = document.getElementById('art');
  const toggle = document.getElementById('toggle');
  const vol = document.getElementById('vol');
  const stage = document.querySelector('.stage');

  async function refresh() {
    try {
      const r = await fetch('/api/now');
      const d = await r.json();
      if (!d.ok || !d.track) {
        song.textContent = 'Nothing playing';
        artist.textContent = '';
        art.hidden = true;
        return;
      }
      song.textContent = d.track.name;
      artist.textContent = d.track.artists;
      if (d.track.image) {
        art.src = d.track.image;
        art.hidden = false;
      } else {
        art.hidden = true;
      }
      toggle.textContent = d.isPlaying ? '⏸' : '▶';
      toggle.setAttribute('aria-label', d.isPlaying ? 'Pause' : 'Play');
      if (stage) stage.classList.toggle('paused', !d.isPlaying);
      if (typeof d.volume === 'number') vol.textContent = d.volume + '%';
    } catch (e) {
      song.textContent = 'Couldn’t load track';
    }
  }

  async function control(action) {
    try {
      await fetch('/api/control?action=' + encodeURIComponent(action));
      await refresh();
    } catch (_) {}
  }

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => control(btn.dataset.action));
  });

  refresh();
  setInterval(refresh, 4000);
})();
</script>`;

export function page(title, message, { dance = false } = {}) {
  const funCss = dance ? `
  .stage{position:relative;width:180px;height:190px;margin:0 auto 1.2rem}
  .stage.paused .body,.stage.paused .arm-l,.stage.paused .arm-r,
  .stage.paused .leg-l,.stage.paused .leg-r,.stage.paused .head,
  .stage.paused .shadow,.stage.paused .note{animation-play-state:paused}
  .panda{display:block;margin:0 auto;transform-origin:50% 85%}
  .body{transform-origin:60px 95px;animation:boogie .55s ease-in-out infinite}
  .arm-l{transform-origin:36px 78px;animation:wave-l .55s ease-in-out infinite}
  .arm-r{transform-origin:84px 78px;animation:wave-r .55s ease-in-out infinite}
  .leg-l{transform-origin:42px 110px;animation:step-l .55s ease-in-out infinite}
  .leg-r{transform-origin:78px 110px;animation:step-r .55s ease-in-out infinite}
  .head{transform-origin:60px 52px;animation:nod .55s ease-in-out infinite}
  .shadow{animation:shadow-pulse .55s ease-in-out infinite}
  .note{position:absolute;font-size:1.6rem;color:#9fdfb3;opacity:0;
        animation:float-note 1.8s ease-in-out infinite}
  .n1{left:8px;top:40px;animation-delay:0s}
  .n2{right:4px;top:24px;animation-delay:.6s;font-size:1.35rem}
  .n3{left:28px;top:8px;animation-delay:1.1s;font-size:1.2rem}
  .track{display:flex;align-items:center;gap:14px;justify-content:center;
         margin:1.1rem auto .2rem;max-width:22rem;text-align:left}
  .art{border-radius:12px;object-fit:cover;background:#24352e;flex-shrink:0}
  .track-text{min-width:0}
  .song{font-size:1.15rem;font-weight:600;line-height:1.25;margin:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:16rem}
  .artist{font-size:.95rem;opacity:.7;margin:.15rem 0 0;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:16rem}
  .controls,.volume{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:1.1rem}
  .volume{margin-top:.75rem}
  .vol-label{min-width:3.2rem;font-variant-numeric:tabular-nums;opacity:.85}
  button{appearance:none;border:0;background:#2a3d34;color:#e8efe9;width:3rem;height:3rem;
         border-radius:999px;font-size:1.15rem;cursor:pointer;line-height:1}
  button.main{width:3.6rem;height:3.6rem;background:#3d6b52;font-size:1.35rem}
  button:active{transform:scale(.94)}
  @keyframes boogie{
    0%,100%{transform:rotate(-6deg) translateY(0)}
    50%{transform:rotate(6deg) translateY(-10px)}
  }
  @keyframes wave-l{
    0%,100%{transform:rotate(15deg)}
    50%{transform:rotate(-45deg)}
  }
  @keyframes wave-r{
    0%,100%{transform:rotate(-15deg)}
    50%{transform:rotate(45deg)}
  }
  @keyframes step-l{
    0%,100%{transform:rotate(8deg)}
    50%{transform:rotate(-12deg)}
  }
  @keyframes step-r{
    0%,100%{transform:rotate(-8deg)}
    50%{transform:rotate(12deg)}
  }
  @keyframes nod{
    0%,100%{transform:rotate(-4deg)}
    50%{transform:rotate(4deg)}
  }
  @keyframes shadow-pulse{
    0%,100%{transform:scaleX(1);opacity:.25}
    50%{transform:scaleX(.7);opacity:.15}
  }
  @keyframes float-note{
    0%{transform:translateY(20px) scale(.6);opacity:0}
    30%{opacity:.9}
    100%{transform:translateY(-50px) scale(1.1);opacity:0}
  }
  @media (prefers-reduced-motion:reduce){
    .body,.arm-l,.arm-r,.leg-l,.leg-r,.head,.shadow,.note{animation:none}
  }` : '';

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1c2a24;color:#e8efe9;
       font-family:ui-rounded,"SF Pro Rounded",system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
  h1{font-size:2.2rem;margin:0 0 .4rem;font-weight:700}
  p{font-size:1.05rem;opacity:.8;max-width:30ch;margin:0 auto;line-height:1.5}
  ${funCss}
</style></head><body><div>
${dance ? DANCING_PANDA : ''}
<h1>${title}</h1><p>${message}</p>
${dance ? PLAYER : ''}
</div>
${dance ? PLAYER_SCRIPT : ''}
</body></html>`;
}
