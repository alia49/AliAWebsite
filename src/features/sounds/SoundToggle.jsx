import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import { play, setMuted, useMuted } from './sounds';

export default function SoundToggle({ className = '' }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label="Sound effects"
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={() => {
        setMuted(!muted);
        if (muted) window.setTimeout(() => play('tick'), 30);
      }}
      className={`grid h-8 w-8 place-items-center rounded-full border border-g-200 text-g-500 transition-colors hover:text-ink ${className}`}
    >
      {muted ? <FiVolumeX aria-hidden size={14} /> : <FiVolume2 aria-hidden size={14} />}
    </button>
  );
}
