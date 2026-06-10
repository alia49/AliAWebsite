import { FiMenu } from 'react-icons/fi';
import { useActions } from '../lib/actions';
import PresencePill from '../features/chat/PresencePill';
import SoundToggle from '../features/sounds/SoundToggle';
import FeatureButtons from './FeatureButtons';
import Overlay, { CloseButton } from './Overlay';
import { SectionLinks } from './Sidebar';
import ThemeSwitch from './ThemeSwitch';

/** Sticky mobile header (< lg). */
export function MobileHeader({ profile, navOpen }) {
  const { open } = useActions();
  return (
    <header className="sticky top-0 z-30 border-b border-g-200 bg-bg/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <a href="#top" className="rounded-md text-[15px] font-semibold tracking-tight">
          {profile.name}
        </a>
        <button
          type="button"
          onClick={() => open('nav')}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={navOpen}
          className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-g-600 hover:bg-g-100 hover:text-ink"
        >
          <FiMenu aria-hidden size={18} />
        </button>
      </div>
    </header>
  );
}

/** Full-screen mobile navigation. */
export default function MobileNav({ profile, sections, activeId, presence, onClose, onNavigate }) {
  const { open } = useActions();
  return (
    <Overlay onClose={onClose} label="Menu" variant="full">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-g-200 px-4 sm:px-6">
        <span className="text-[15px] font-semibold tracking-tight">{profile.name}</span>
        <CloseButton onClick={onClose} label="Close menu" className="-mr-1" />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-6">
        <nav aria-label="Sections">
          <SectionLinks sections={sections} activeId={activeId} onNavigate={onNavigate} large />
        </nav>
        <div className="mt-8 border-t border-g-200 pt-5">
          <FeatureButtons large />
        </div>
        <PresencePill presence={presence} className="mt-5 self-start" />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-10">
          <button type="button" onClick={() => open('hello')} className="font-mono text-xs text-g-500 hover:text-ink">
            {profile.email}
          </button>
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <SoundToggle />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
