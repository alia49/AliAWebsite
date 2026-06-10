import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { readStore, writeStore } from './storage';
import { matches, prefersReducedMotion } from './media';

// Keep in sync with the inline no-flash script in public/index.html.
const KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
export const THEMES = ['light', 'dark', 'system'];
const THEME_COLOR = { light: '#ffffff', dark: '#0a0a0b' };

const listeners = new Set();
let current = null;
let crossfadeTimer = 0;
let systemListenerAttached = false;

function readPref() {
  const saved = readStore(KEY);
  return THEMES.includes(saved) ? saved : 'system';
}

export function getThemePref() {
  if (current === null) current = readPref();
  return current;
}

export function resolveTheme(pref) {
  if (pref === 'system') return matches(DARK_QUERY) ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
}

function emit() {
  listeners.forEach((fn) => fn());
}

function attachSystemListener() {
  if (systemListenerAttached || typeof window.matchMedia !== 'function') return;
  systemListenerAttached = true;
  const list = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getThemePref() === 'system') {
      crossfade(() => applyTheme('system'));
    }
  };
  if (list.addEventListener) list.addEventListener('change', onChange);
  else if (list.addListener) list.addListener(onChange);
}

function crossfade(commit) {
  if (prefersReducedMotion()) {
    commit();
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-anim');
  commit();
  window.clearTimeout(crossfadeTimer);
  crossfadeTimer = window.setTimeout(() => root.classList.remove('theme-anim'), 520);
}

/**
 * Switch theme. With the View Transitions API the new theme is revealed as a
 * circle growing from `origin` (the click point); otherwise a 0.5 s crossfade.
 * Reduced motion switches instantly.
 */
export function setTheme(next, origin) {
  if (!THEMES.includes(next)) return;
  const root = document.documentElement;
  const before = root.classList.contains('dark') ? 'dark' : 'light';
  const commit = () => {
    current = next;
    writeStore(KEY, next);
    applyTheme(next);
    emit();
  };

  if (resolveTheme(next) === before || prefersReducedMotion()) {
    commit();
    return;
  }

  if (typeof document.startViewTransition === 'function') {
    const x = origin && Number.isFinite(origin.x) ? origin.x : window.innerWidth / 2;
    const y = origin && Number.isFinite(origin.y) ? origin.y : 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => flushSync(commit));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    return;
  }

  crossfade(commit);
}

function subscribe(fn) {
  attachSystemListener();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current theme preference ('light' | 'dark' | 'system'), shared by every switch. */
export function useThemePref() {
  return useSyncExternalStore(subscribe, getThemePref, () => 'system');
}
