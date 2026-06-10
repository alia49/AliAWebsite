import PixelAvatar from '../../components/PixelAvatar';

/** "N people viewing now" with up to five pixel avatars. Renders nothing when offline. */
export default function PresencePill({ presence, className = '' }) {
  if (!presence || presence.count < 1) return null;
  const { count, avatars } = presence;
  const label = `${count} ${count === 1 ? 'person' : 'people'} viewing now`;
  return (
    <div className={`rounded-xl border border-g-200 px-3 py-2 ${className}`}>
      <p className="flex items-center gap-2 font-mono text-[11px] text-g-600">
        <span className="live-dot" aria-hidden="true" />
        {label}
      </p>
      {avatars.length > 0 && (
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {avatars.map((seed, i) => (
            <PixelAvatar key={`${seed}-${i}`} seed={seed} size={20} />
          ))}
        </div>
      )}
    </div>
  );
}
