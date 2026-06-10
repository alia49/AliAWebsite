import { useActions } from '../lib/actions';
import PresencePill from '../features/chat/PresencePill';
import SoundToggle from '../features/sounds/SoundToggle';
import FeatureButtons from './FeatureButtons';
import ThemeSwitch from './ThemeSwitch';

export function SectionLinks({ sections, activeId, onNavigate, large = false }) {
  return (
    <ul className={large ? 'space-y-1' : 'space-y-0.5'}>
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={onNavigate ? (event) => onNavigate(event, s.id) : undefined}
            aria-current={activeId === s.id ? 'location' : undefined}
            className={`group flex items-baseline gap-2.5 transition-colors hover:text-ink aria-[current=location]:text-ink ${
              large ? 'py-1.5 text-2xl font-medium tracking-tight text-g-600' : 'py-1 text-[13px] text-g-500'
            }`}
          >
            <span className={`font-mono tabular-nums text-g-400 group-aria-[current=location]:text-ink ${large ? 'text-xs' : 'text-[10px]'}`}>
              {s.num}
            </span>
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Fixed desktop sidebar (lg+). */
export default function Sidebar({ profile, sections, activeId, presence }) {
  const { open } = useActions();
  return (
    <aside
      aria-label="Site"
      className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-g-200 bg-bg lg:block"
    >
      <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-9 scrollbar-none">
        <a href="#top" className="block rounded-md">
          <span className="block text-[15px] font-semibold tracking-tight">{profile.name}</span>
          <span className="label mt-0.5 block">{profile.role.toLowerCase()}</span>
        </a>

        <nav aria-label="Sections" className="mt-10">
          <SectionLinks sections={sections} activeId={activeId} />
        </nav>

        <div className="mt-8 border-t border-g-200 pt-5">
          <FeatureButtons />
        </div>

        <PresencePill presence={presence} className="mt-5" />

        <div className="mt-auto space-y-4 pt-8">
          <button
            type="button"
            onClick={() => open('hello')}
            className="block max-w-full truncate text-left font-mono text-[11px] text-g-500 transition-colors hover:text-ink"
            title="Say hello"
          >
            {profile.email}
          </button>
          <div className="flex items-center justify-between">
            <ThemeSwitch />
            <SoundToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
