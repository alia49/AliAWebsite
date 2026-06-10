import { useEffect, useState } from 'react';
import { fetchHealth, hasApi, postPresence } from '../../lib/api';

const HEARTBEAT_MS = 20000;

/**
 * Presence heartbeat: POST /presence now and every 20 s while the tab is visible.
 * Returns { count, avatars } or null when presence is unavailable (hidden in UI).
 */
export function usePresence() {
  const [presence, setPresence] = useState(null);

  useEffect(() => {
    if (!hasApi()) return undefined;
    let alive = true;
    let timer = 0;
    let enabled = false;

    const beat = async () => {
      window.clearTimeout(timer);
      if (!alive || !enabled) return;
      if (document.visibilityState === 'visible') {
        try {
          const data = await postPresence();
          if (alive && data && Number.isFinite(data.count)) {
            setPresence({ count: data.count, avatars: Array.isArray(data.avatars) ? data.avatars.slice(0, 5) : [] });
          }
        } catch {
          if (alive) setPresence(null);
        }
      }
      if (alive) timer = window.setTimeout(beat, HEARTBEAT_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
      else window.clearTimeout(timer);
    };

    fetchHealth().then((health) => {
      if (!alive || !health.ok || health.features.presence === false) return;
      enabled = true;
      beat();
      document.addEventListener('visibilitychange', onVisibility);
    });

    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return presence;
}
