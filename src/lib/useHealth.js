import { useEffect, useState } from 'react';
import { fetchHealth, hasApi } from './api';

/**
 * { status: 'loading' | 'ready', ok, features } — ok=false when no backend is reachable.
 * Pass a changing `nonce` (> 0) to force a fresh /health check (e.g. a "try again" button).
 */
export function useHealth(nonce = 0) {
  const [state, setState] = useState(() =>
    hasApi() ? { status: 'loading', ok: false, features: {} } : { status: 'ready', ok: false, features: {} }
  );
  useEffect(() => {
    if (!hasApi()) return undefined;
    let alive = true;
    fetchHealth({ force: nonce > 0 }).then((health) => {
      if (alive) setState({ status: 'ready', ...health });
    });
    return () => {
      alive = false;
    };
  }, [nonce]);
  return state;
}
