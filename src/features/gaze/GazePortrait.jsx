import { useEffect, useRef, useState } from 'react';
import { asset } from '../../lib/asset';
import { usePrefersReducedMotion } from '../../lib/media';

// Sector order starts at 0° (pointing right) and goes clockwise in screen space.
const SECTORS = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
export const GAZE_FRAMES = ['center', ...SECTORS];

/**
 * Portrait that looks toward the pointer. Nine photos live in `${dir}/<frame>.webp`.
 * The angle from the face (≈45 % down the image) to the cursor is snapped to a 45°
 * sector; near the face, or when the pointer leaves the window, it shows `center`.
 * Pointer handling is rAF-throttled and disabled under prefers-reduced-motion.
 */
export default function GazePortrait({ dir, alt, className = '', imgClassName = '' }) {
  const reduced = usePrefersReducedMotion();
  const imgRef = useRef(null);
  const [frame, setFrame] = useState('center');
  const src = (name) => asset(`${dir}/${name}.webp`);

  // preload every frame so swaps are instant
  useEffect(() => {
    if (reduced) return;
    GAZE_FRAMES.forEach((name) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = asset(`${dir}/${name}.webp`);
    });
  }, [dir, reduced]);

  useEffect(() => {
    if (reduced) {
      setFrame('center');
      return undefined;
    }
    let raf = 0;
    let last = null;

    const update = () => {
      raf = 0;
      const el = imgRef.current;
      if (!el || !last) return;
      const rect = el.getBoundingClientRect();
      const fx = rect.left + rect.width / 2;
      const fy = rect.top + rect.height * 0.45;
      const dx = last.x - fx;
      const dy = last.y - fy;
      const deadZone = Math.max(40, rect.width * 0.18);
      if (Math.hypot(dx, dy) < deadZone) {
        setFrame('center');
        return;
      }
      const angle = Math.atan2(dy, dx); // radians, 0 = right, clockwise positive
      const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
      setFrame(SECTORS[sector]);
    };

    const onMove = (event) => {
      last = { x: event.clientX, y: event.clientY };
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    const onLeave = (event) => {
      if (!event.relatedTarget) {
        last = null;
        setFrame('center');
      }
    };
    const onBlur = () => setFrame('center');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onLeave);
    window.addEventListener('blur', onBlur);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onLeave);
      window.removeEventListener('blur', onBlur);
    };
  }, [reduced]);

  return (
    <div className={className}>
      <img ref={imgRef} src={src(frame)} alt={alt} className={imgClassName} draggable="false" decoding="async" />
    </div>
  );
}
