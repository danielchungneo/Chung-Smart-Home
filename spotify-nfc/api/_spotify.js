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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICON_PREV = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M6 6h2.2v12H6V6zm3.2 6 8.8 6.2V5.8L9.2 12z"/></svg>`;
const ICON_NEXT = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M15.8 6H18v12h-2.2V6zM6 18.2V5.8L14.8 12 6 18.2z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5L8 5.5z"/></svg>`;

const DANCING_PANDA = `
<div class="stage" aria-hidden="true">
  <span class="note n1">♪</span>
  <span class="note n2">♫</span>
  <span class="note n3">♪</span>
  <svg class="panda" viewBox="0 0 120 140" width="160" height="187" focusable="false">
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
  <p class="intro-label">Starting the vibe…</p>
</div>`;

const PLAYER = `
<div class="player" id="player">
  <div class="art-wrap">
    <img class="art" id="art" alt="" width="220" height="220" hidden>
    <div class="art-fallback" id="artFallback" aria-hidden="true">♪</div>
  </div>
  <div class="meta">
    <div class="song" id="song">Loading…</div>
    <div class="artist" id="artist"></div>
    <div class="where" id="where"></div>
  </div>
  <div class="controls" role="group" aria-label="Playback">
    <button type="button" class="icon" data-action="previous" aria-label="Previous">${ICON_PREV}</button>
    <button type="button" class="main" data-action="toggle" aria-label="Pause" id="toggle">${ICON_PAUSE}</button>
    <button type="button" class="icon" data-action="next" aria-label="Next">${ICON_NEXT}</button>
  </div>
  <div class="volume" role="group" aria-label="Volume">
    <button type="button" class="vol-btn" data-action="voldown" aria-label="Volume down">−</button>
    <span class="vol-label" id="vol">—</span>
    <button type="button" class="vol-btn" data-action="volup" aria-label="Volume up">+</button>
  </div>
</div>`;

function playerScript({ mock = false, message = '' } = {}) {
  return `
<script>
(function () {
  const mock = ${mock ? 'true' : 'false'};
  const whereText = ${JSON.stringify(message)};
  const ICON_PAUSE = ${JSON.stringify(ICON_PAUSE)};
  const ICON_PLAY = ${JSON.stringify(ICON_PLAY)};

  const song = document.getElementById('song');
  const artist = document.getElementById('artist');
  const where = document.getElementById('where');
  const art = document.getElementById('art');
  const artFallback = document.getElementById('artFallback');
  const toggle = document.getElementById('toggle');
  const vol = document.getElementById('vol');
  const intro = document.getElementById('intro');
  const player = document.getElementById('player');
  const shell = document.getElementById('shell');

  where.textContent = whereText;

  let playing = true;
  let volume = 40;
  const mockTrack = {
    ok: true,
    isPlaying: true,
    volume: 40,
    track: {
      name: 'Le Festin',
      artists: 'Camille, Michael Giacchino',
      image: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed849d26c0e354',
    },
  };

  function apply(d) {
    if (!d.ok || !d.track) {
      song.textContent = 'Nothing playing';
      artist.textContent = '';
      art.hidden = true;
      artFallback.hidden = false;
      return;
    }
    song.textContent = d.track.name;
    artist.textContent = d.track.artists;
    if (d.track.image) {
      art.src = d.track.image;
      art.hidden = false;
      artFallback.hidden = true;
    } else {
      art.hidden = true;
      artFallback.hidden = false;
    }
    playing = !!d.isPlaying;
    toggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    shell && shell.classList.toggle('is-paused', !playing);
    if (typeof d.volume === 'number') {
      volume = d.volume;
      vol.textContent = d.volume + '%';
    }
  }

  async function refresh() {
    if (mock) {
      mockTrack.isPlaying = playing;
      mockTrack.volume = volume;
      apply(mockTrack);
      return;
    }
    try {
      const r = await fetch('/api/now');
      apply(await r.json());
    } catch (e) {
      song.textContent = 'Couldn’t load track';
    }
  }

  async function control(action) {
    if (mock) {
      if (action === 'toggle') playing = !playing;
      if (action === 'volup') volume = Math.min(100, volume + 10);
      if (action === 'voldown') volume = Math.max(0, volume - 10);
      if (action === 'next') mockTrack.track.name = 'End Creditouilles';
      if (action === 'previous') mockTrack.track.name = 'Le Festin';
      await refresh();
      return;
    }
    try {
      await fetch('/api/control?action=' + encodeURIComponent(action));
      setTimeout(refresh, 250);
    } catch (_) {}
  }

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => control(btn.dataset.action));
  });

  function revealPlayer() {
    if (!intro || !player) return;
    intro.classList.add('fade-out');
    player.classList.add('fade-in');
    setTimeout(() => { intro.hidden = true; }, 700);
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    if (intro) intro.hidden = true;
    if (player) player.classList.add('fade-in', 'show-now');
  } else {
    setTimeout(revealPlayer, 3000);
  }

  refresh();
  if (!mock) setInterval(refresh, 4000);
})();
</script>`;
}

export function page(title, message, { dance = false, mock = false } = {}) {
  if (!dance) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;
       background:radial-gradient(1200px 800px at 50% -10%,#2a4036 0%,#1c2a24 55%,#15201c 100%);
       color:#e8efe9;font-family:"SF Pro Rounded",ui-rounded,system-ui,sans-serif;
       text-align:center;padding:24px;box-sizing:border-box}
  h1{font-size:2rem;margin:0 0 .4rem;font-weight:650;letter-spacing:-.02em}
  p{font-size:1.05rem;opacity:.75;max-width:30ch;margin:0 auto;line-height:1.5}
</style></head><body><div><h1>${esc(title)}</h1><p>${esc(message)}</p></div></body></html>`;
  }

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<style>
  :root{
    --bg0:#15201c;--bg1:#1c2a24;--bg2:#2a4036;
    --ink:#f2f7f3;--muted:#b7c7bc;--line:rgba(255,255,255,.08);
  }
  *,*::before,*::after{box-sizing:border-box}
  html,body{
    margin:0;padding:0;width:100%;max-width:100%;
    overflow-x:hidden;
  }
  body{
    min-height:100dvh;min-height:100vh;
    display:flex;align-items:center;justify-content:center;
    color:var(--ink);
    background:radial-gradient(1000px 700px at 50% -20%,var(--bg2) 0%,var(--bg1) 48%,var(--bg0) 100%);
    font-family:"SF Pro Rounded",ui-rounded,"Segoe UI",system-ui,sans-serif;
    padding:max(16px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom));
  }
  .shell{
    width:100%;max-width:22rem;margin:0 auto;
    position:relative;overflow:hidden;
  }
  .intro,.player{width:100%;max-width:100%;text-align:center}
  .intro{
    position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:.5rem;
    transition:opacity .65s ease,transform .65s ease;
  }
  .intro.fade-out{opacity:0;transform:scale(.96);pointer-events:none}
  .player{
    opacity:0;transform:translateY(12px);
    transition:opacity .7s ease,transform .7s ease;
    pointer-events:none;padding:0 .25rem;
  }
  .player.fade-in,.player.show-now{opacity:1;transform:none;pointer-events:auto}
  .player.show-now{transition:none}

  .stage{position:relative;width:min(160px,70vw);margin:0 auto;overflow:hidden}
  .panda{display:block;width:100%;height:auto;margin:0 auto;transform-origin:50% 85%}
  .body{transform-origin:60px 95px;animation:boogie .55s ease-in-out infinite}
  .arm-l{transform-origin:36px 78px;animation:wave-l .55s ease-in-out infinite}
  .arm-r{transform-origin:84px 78px;animation:wave-r .55s ease-in-out infinite}
  .leg-l{transform-origin:42px 110px;animation:step-l .55s ease-in-out infinite}
  .leg-r{transform-origin:78px 110px;animation:step-r .55s ease-in-out infinite}
  .head{transform-origin:60px 52px;animation:nod .55s ease-in-out infinite}
  .shadow{animation:shadow-pulse .55s ease-in-out infinite}
  .note{position:absolute;font-size:1.4rem;color:#9fdfb3;opacity:0;
        animation:float-note 1.8s ease-in-out infinite}
  .n1{left:8px;top:40px}
  .n2{right:4px;top:24px;animation-delay:.6s;font-size:1.2rem}
  .n3{left:28px;top:8px;animation-delay:1.1s;font-size:1.1rem}
  .intro-label{margin:1rem 0 0;color:var(--muted);font-size:.95rem;letter-spacing:.01em}

  .art-wrap{
    position:relative;width:min(58vw,200px);max-width:100%;
    aspect-ratio:1;margin:0 auto 1.1rem;
  }
  .art,.art-fallback{position:absolute;inset:0;width:100%;height:100%;border-radius:18px}
  .art{object-fit:cover;box-shadow:0 18px 40px rgba(0,0,0,.35)}
  .art-fallback{display:grid;place-items:center;background:linear-gradient(145deg,#314a3e,#20332b);
                font-size:3rem;color:#9fdfb3}
  .meta{margin:0 0 1.25rem;max-width:100%;padding:0 .5rem}
  .song{font-size:clamp(1.1rem,4.5vw,1.35rem);font-weight:650;letter-spacing:-.02em;line-height:1.25;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
  .artist{margin-top:.35rem;font-size:.95rem;color:var(--muted);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
  .where{margin-top:.5rem;font-size:.8rem;color:var(--muted);opacity:.75;
         overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}

  .controls{display:flex;align-items:center;justify-content:center;gap:clamp(1.25rem,6vw,2rem);
            margin:0 0 1.1rem;width:100%}
  button{appearance:none;border:0;background:transparent;color:var(--ink);cursor:pointer;
         padding:0;display:grid;place-items:center;transition:transform .12s ease,opacity .12s ease;
         -webkit-tap-highlight-color:transparent}
  button:active{transform:scale(.92)}
  button.icon{width:2.75rem;height:2.75rem;opacity:.92;flex:0 0 auto}
  button.main{width:4rem;height:4rem;border-radius:999px;background:#fff;color:#1c2a24;
              box-shadow:0 10px 24px rgba(0,0,0,.28);flex:0 0 auto}
  button.main svg{width:28px;height:28px}

  .volume{display:flex;align-items:center;justify-content:center;gap:.85rem;
          padding-top:.35rem;border-top:1px solid var(--line);width:100%}
  .vol-btn{width:2.4rem;height:2.4rem;border-radius:999px;background:rgba(255,255,255,.06);
           font-size:1.35rem;line-height:1;color:var(--ink);flex:0 0 auto}
  .vol-label{min-width:3.25rem;font-variant-numeric:tabular-nums;color:var(--muted);font-size:.95rem}

  @media (max-height:700px){
    .art-wrap{width:min(48vw,160px);margin-bottom:.85rem}
    .meta{margin-bottom:1rem}
    .controls{margin-bottom:.85rem}
  }

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
    .intro,.player{transition:none}
  }
</style></head><body>
<div class="shell" id="shell">
  <div class="intro" id="intro">${DANCING_PANDA}</div>
  ${PLAYER}
</div>
${playerScript({ mock, message })}
</body></html>`;
}
