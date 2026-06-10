import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { setTheme, useThemePref } from '../lib/theme';
import { play } from '../features/sounds/sounds';

const OPTIONS = [
  { value: 'light', label: 'Light theme', Icon: FiSun },
  { value: 'dark', label: 'Dark theme', Icon: FiMoon },
  { value: 'system', label: 'System theme', Icon: FiMonitor },
];

export default function ThemeSwitch({ className = '' }) {
  const pref = useThemePref();
  return (
    <div role="group" aria-label="Theme" className={`inline-flex items-center gap-0.5 rounded-full border border-g-200 p-0.5 ${className}`}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={pref === value}
          title={label}
          onClick={(event) => {
            // keyboard "clicks" have no pointer position: reveal from the button centre
            const rect = event.currentTarget.getBoundingClientRect();
            const fromPointer = event.detail > 0 && (event.clientX || event.clientY);
            const origin = fromPointer
              ? { x: event.clientX, y: event.clientY }
              : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            if (pref !== value) play('tick');
            setTheme(value, origin);
          }}
          className="grid h-7 w-7 place-items-center rounded-full text-g-500 transition-colors hover:text-ink aria-pressed:bg-g-100 aria-pressed:text-ink"
        >
          <Icon aria-hidden size={13} />
        </button>
      ))}
    </div>
  );
}
