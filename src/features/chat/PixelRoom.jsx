import { useEffect, useRef, useState } from 'react';
import { FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp } from 'react-icons/fi';
import { avatarFor, hash32, mulberry32 } from '../../lib/avatar';
import { useIsTouch, usePrefersReducedMotion } from '../../lib/media';
import { play } from '../sounds/sounds';

// Everything here is drawn procedurally with fillRect — no sprite sheets.
const W = 160; // logical pixels
const H = 96;
const WALL = 30;
const PLAYER_SPEED = 42; // logical px / s
const NPC_SPEED = 13;
const STEP_EVERY = 7; // px walked per footstep sound
const BOUNDS = { x0: 6, x1: W - 6, y0: WALL + 7, y1: H - 3 };
const OBSTACLES = [
  { x: 11, y: 35, w: 31, h: 10 }, // desk
  { x: 126, y: 70, w: 12, h: 10 }, // plant
];
const KEYMAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
};

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  const tone = (name) => {
    const raw = styles.getPropertyValue(`--${name}`).trim();
    return raw ? `rgb(${raw.split(/\s+/).join(',')})` : '#888';
  };
  const names = ['bg', 'ink', 'g50', 'g100', 'g200', 'g300', 'g400', 'g500', 'g600', 'g700', 'g800'];
  return Object.fromEntries(names.map((n) => [n, tone(n)]));
}

const blocked = (x, y) =>
  x < BOUNDS.x0 ||
  x > BOUNDS.x1 ||
  y < BOUNDS.y0 ||
  y > BOUNDS.y1 ||
  OBSTACLES.some((o) => x + 3 > o.x && x - 3 < o.x + o.w && y > o.y && y - 2 < o.y + o.h);

function randomSpot(rand) {
  for (let i = 0; i < 40; i += 1) {
    const x = BOUNDS.x0 + rand() * (BOUNDS.x1 - BOUNDS.x0);
    const y = BOUNDS.y0 + rand() * (BOUNDS.y1 - BOUNDS.y0);
    if (!blocked(x, y)) return { x, y };
  }
  return { x: W / 2, y: H - 12 };
}

function makeCharacter(name, spot) {
  return { name, x: spot.x, y: spot.y, dir: 1, moving: false, walked: 0, target: null, idleUntil: 0, avatar: avatarFor(name) };
}

// ---- drawing ---------------------------------------------------------------

/** Fill a logical-pixel rectangle with edges snapped to device pixels (crisp at any scale). */
function block(ctx, px, x, y, w, h, color) {
  const x0 = Math.round(x * px);
  const y0 = Math.round(y * px);
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, Math.round((x + w) * px) - x0, Math.round((y + h) * px) - y0);
}

function drawRoom(ctx, px, pal, time) {
  const rect = (x, y, w, h, color) => block(ctx, px, x, y, w, h, color);
  // floor: soft checker tiles
  rect(0, WALL, W, H - WALL, pal.bg);
  for (let ty = WALL; ty < H; ty += 8) {
    for (let tx = 0; tx < W; tx += 8) {
      if (((tx + ty) / 8) % 2 === 0) rect(tx, ty, 8, 8, pal.g50);
    }
  }
  // wall + skirting
  rect(0, 0, W, WALL, pal.g100);
  for (let y = 2; y < WALL - 3; y += 3) {
    for (let x = (y % 2) * 2; x < W; x += 4) rect(x, y, 1, 1, pal.g200); // halftone-ish wallpaper
  }
  rect(0, WALL - 2, W, 2, pal.g300);
  // window with a moon
  rect(98, 5, 34, 18, pal.g400);
  rect(99, 6, 32, 16, pal.g50);
  rect(114, 6, 1, 16, pal.g400);
  rect(99, 13, 32, 1, pal.g400);
  rect(122, 8, 4, 4, pal.g300);
  // framed pixel portrait
  rect(20, 6, 13, 13, pal.g500);
  rect(21, 7, 11, 11, pal.g50);
  const portrait = avatarFor('ali-portrait');
  portrait.cells.forEach((row, cy) =>
    row.forEach((on, cx) => {
      if (on) rect(23 + cx * 1.4, 9 + cy * 1.4, 1.4, 1.4, pal.g700);
    })
  );
  // rug (dithered)
  rect(56, 60, 44, 20, pal.g300);
  for (let y = 61; y < 79; y += 1) {
    for (let x = 57; x < 99; x += 1) if ((x + y) % 2 === 0) rect(x, y, 1, 1, pal.g100);
  }
  // desk + monitor with a blinking cursor
  rect(11, 36, 31, 3, pal.g500);
  rect(12, 39, 2, 6, pal.g600);
  rect(39, 39, 2, 6, pal.g600);
  rect(18, 26, 15, 10, pal.g800);
  rect(19, 27, 13, 8, pal.g600);
  if (Math.floor(time / 500) % 2 === 0) rect(21, 32, 2, 1, pal.g100);
  rect(24, 36, 3, 1, pal.g700);
  // plant
  rect(128, 74, 8, 6, pal.g500);
  [[129, 70], [131, 68], [133, 70], [127, 72], [135, 72], [131, 71], [132, 66]].forEach(([x, y]) => rect(x, y, 2, 3, pal.g600));
}

function drawCharacter(ctx, px, pal, c, isMe, time, fontScale) {
  const ox = Math.round(c.x);
  const oy = Math.round(c.y);
  const rect = (x, y, w, h, color) => block(ctx, px, ox + x, oy + y, w, h, color);
  const step = c.moving ? Math.floor(time / 140) % 2 : 0;
  const bob = c.moving && step ? -1 : 0;
  rect(-3, 0, 7, 1, pal.g200); // shadow
  // legs
  rect(-2, -2 + (step ? -1 : 0), 1, 2, pal.g700);
  rect(1, -2 + (step ? 0 : -1), 1, 2, pal.g700);
  // body
  const shirt = [pal.g500, pal.g600, pal.g700, pal.ink][c.avatar.tone];
  rect(-2, -6 + bob, 4, 4, shirt);
  rect(-3, -5 + bob, 1, 2, shirt);
  rect(2, -5 + bob, 1, 2, shirt);
  // head: framed 5×5 identicon
  rect(-3, -13 + bob, 7, 7, isMe ? pal.ink : pal.g600);
  rect(-2, -12 + bob, 5, 5, pal.bg);
  c.avatar.cells.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) rect(-2 + (c.dir < 0 ? 4 - x : x), -12 + y + bob, 1, 1, pal.g700);
    })
  );
  // name tag
  const label = isMe ? `${c.name} (you)` : c.name;
  const text = label.length > 16 ? `${label.slice(0, 15)}…` : label;
  ctx.font = `${Math.round(10 * fontScale)}px "Geist Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const tx = (ox + 0.5) * px;
  const ty = (oy - 15) * px;
  const width = ctx.measureText(text).width + 8 * fontScale;
  ctx.fillStyle = isMe ? pal.ink : pal.bg;
  ctx.globalAlpha = isMe ? 1 : 0.85;
  ctx.fillRect(tx - width / 2, ty - 13 * fontScale, width, 13 * fontScale);
  ctx.globalAlpha = 1;
  ctx.fillStyle = isMe ? pal.bg : pal.g700;
  ctx.fillText(text, tx, ty - 1.5 * fontScale);
}

// ---- component -------------------------------------------------------------

export default function PixelRoom({ me, npcs }) {
  const canvasRef = useRef(null);
  const keys = useRef(new Set());
  const world = useRef(null);
  const reduced = usePrefersReducedMotion();
  const touch = useIsTouch();
  const [supported, setSupported] = useState(true);

  if (!world.current) {
    world.current = { me: makeCharacter(me, { x: W / 2, y: H - 14 }), npcs: new Map() };
  }

  // keep the cast in sync with recent chatters
  useEffect(() => {
    const w = world.current;
    w.me.name = me;
    w.me.avatar = avatarFor(me);
    const next = new Map();
    npcs.forEach((name) => {
      next.set(name, w.npcs.get(name) || makeCharacter(name, randomSpot(mulberry32(hash32(name)))));
    });
    w.npcs = next;
  }, [me, npcs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) {
      setSupported(false);
      return undefined;
    }
    let palette = readPalette();
    let px = 4;
    let fontScale = 1;
    let raf = 0;
    let last = performance.now();
    const rand = mulberry32(Date.now() >>> 0);

    // backing store = CSS size × DPR, so name tags render crisp; pixel art is snapped per block
    const resize = () => {
      const cssWidth = canvas.clientWidth || 480;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round((cssWidth * dpr * H) / W);
      px = canvas.width / W;
      fontScale = dpr;
      ctx.imageSmoothingEnabled = false;
    };
    resize();

    const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize);

    const themeWatcher = new MutationObserver(() => {
      palette = readPalette();
    });
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = world.current;

      // player
      const held = keys.current;
      let vx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      let vy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      if (vx && vy) {
        vx *= Math.SQRT1_2;
        vy *= Math.SQRT1_2;
      }
      const p = w.me;
      p.moving = Boolean(vx || vy);
      if (p.moving) {
        const nx = p.x + vx * PLAYER_SPEED * dt;
        const ny = p.y + vy * PLAYER_SPEED * dt;
        const before = { x: p.x, y: p.y };
        if (!blocked(nx, p.y)) p.x = nx;
        if (!blocked(p.x, ny)) p.y = ny;
        if (vx) p.dir = vx > 0 ? 1 : -1;
        p.walked += Math.hypot(p.x - before.x, p.y - before.y);
        if (p.walked >= STEP_EVERY) {
          p.walked = 0;
          play('step');
        }
      }

      // NPCs wander (they stand still under reduced motion)
      w.npcs.forEach((c) => {
        if (reduced) {
          c.moving = false;
          return;
        }
        if (!c.target) {
          c.moving = false;
          if (now > c.idleUntil) c.target = randomSpot(rand);
          return;
        }
        const dx = c.target.x - c.x;
        const dy = c.target.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) {
          c.target = null;
          c.idleUntil = now + 1200 + rand() * 3500;
          c.moving = false;
          return;
        }
        const nx = c.x + (dx / dist) * NPC_SPEED * dt;
        const ny = c.y + (dy / dist) * NPC_SPEED * dt;
        if (blocked(nx, ny)) {
          c.target = null;
          return;
        }
        c.x = nx;
        c.y = ny;
        c.dir = dx >= 0 ? 1 : -1;
        c.moving = true;
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRoom(ctx, px, palette, now);
      const cast = [...w.npcs.values(), p].sort((a, b) => a.y - b.y);
      cast.forEach((c) => drawCharacter(ctx, px, palette, c, c === p, now, fontScale));
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resize);
      themeWatcher.disconnect();
    };
  }, [reduced]);

  const onKeyDown = (event) => {
    const dir = KEYMAP[event.key] || KEYMAP[event.key.toLowerCase()];
    if (!dir || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    keys.current.add(dir);
  };
  const onKeyUp = (event) => {
    const dir = KEYMAP[event.key] || KEYMAP[event.key.toLowerCase()];
    if (dir) keys.current.delete(dir);
  };

  const pad = (dir, Icon, label, className) => (
    <button
      type="button"
      aria-label={label}
      className={`grid h-10 w-10 place-items-center rounded-lg border border-g-200 bg-bg text-g-600 active:bg-g-100 ${className}`}
      onPointerDown={(event) => {
        event.preventDefault();
        keys.current.add(dir);
      }}
      onPointerUp={() => keys.current.delete(dir)}
      onPointerLeave={() => keys.current.delete(dir)}
      onPointerCancel={() => keys.current.delete(dir)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Icon aria-hidden size={16} />
    </button>
  );

  if (!supported) {
    return <p className="text-sm text-g-500">The pixel room needs a browser with canvas support.</p>;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => keys.current.clear()}
        aria-label={`Pixel room with you and ${npcs.length} recent ${npcs.length === 1 ? 'chatter' : 'chatters'}. Use the arrow keys or W A S D to walk.`}
        role="application"
        className="block aspect-[160/96] w-full rounded-xl border border-g-200 bg-bg"
      />
      <p className="sr-only">In the room: {npcs.length ? npcs.join(', ') : 'nobody else yet'}.</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label">
          {touch ? 'hold the arrows to walk' : 'click the room, then use ← ↑ → ↓ or WASD'} · {npcs.length} recent{' '}
          {npcs.length === 1 ? 'chatter' : 'chatters'} wandering
        </p>
        {touch && (
          <div className="grid grid-cols-3 gap-1">
            {pad('up', FiArrowUp, 'Walk up', 'col-start-2')}
            {pad('left', FiArrowLeft, 'Walk left', 'col-start-1 row-start-2')}
            {pad('down', FiArrowDown, 'Walk down', 'col-start-2 row-start-2')}
            {pad('right', FiArrowRight, 'Walk right', 'col-start-3 row-start-2')}
          </div>
        )}
      </div>
    </div>
  );
}
