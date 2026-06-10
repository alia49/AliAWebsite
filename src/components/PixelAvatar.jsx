import { memo } from 'react';
import { avatarFor } from '../lib/avatar';

const TONE_CLASS = ['fill-g-500', 'fill-g-600', 'fill-g-700', 'fill-ink'];

/** 5×5 mirrored pixel identicon drawn from `seed`. */
function PixelAvatar({ seed, size = 24, className = '', title }) {
  const { cells, tone } = avatarFor(seed || 'anonymous');
  return (
    <svg
      viewBox="-1 -1 7 7"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`shrink-0 rounded-md bg-g-100 ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g className={TONE_CLASS[tone]}>
        {cells.flatMap((row, y) =>
          row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null))
        )}
      </g>
    </svg>
  );
}

export default memo(PixelAvatar);
