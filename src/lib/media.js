import { useCallback, useSyncExternalStore } from 'react';

function mql(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

export function matches(query) {
  const list = mql(query);
  return list ? list.matches : false;
}

/** Subscribe to a CSS media query. Returns false where matchMedia is unavailable. */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = mql(query);
      if (!list) return () => {};
      if (list.addEventListener) list.addEventListener('change', onChange);
      else if (list.addListener) list.addListener(onChange);
      return () => {
        if (list.removeEventListener) list.removeEventListener('change', onChange);
        else if (list.removeListener) list.removeListener(onChange);
      };
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => matches(query), () => false);
}

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const TOUCH_ONLY = '(hover: none) and (pointer: coarse)';

export const prefersReducedMotion = () => matches(REDUCED_MOTION);
export const usePrefersReducedMotion = () => useMediaQuery(REDUCED_MOTION);
export const useIsTouch = () => useMediaQuery(TOUCH_ONLY);

export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X/.test(navigator.userAgent || '');
}

export const isJsdom = () => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
