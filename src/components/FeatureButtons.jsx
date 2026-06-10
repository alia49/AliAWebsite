import { FiCommand, FiMessageSquare, FiType } from 'react-icons/fi';
import { useActions } from '../lib/actions';
import { isApplePlatform, useIsTouch } from '../lib/media';
import { Kbd } from './Overlay';

/** Entry points for the interactive overlays (sidebar + mobile nav). */
export default function FeatureButtons({ large = false }) {
  const { open } = useActions();
  const touch = useIsTouch();
  const mod = isApplePlatform() ? '⌘' : 'Ctrl';
  const row = `group flex items-center gap-2.5 rounded-lg px-2 text-left text-g-600 transition-colors hover:bg-g-100 hover:text-ink ${
    large ? 'w-full py-2.5 text-base' : '-mx-2 w-[calc(100%+1rem)] py-1.5 text-[13px]'
  }`;
  const items = [
    { id: 'ask', label: 'Ask anything', Icon: FiCommand, key: 'K' },
    { id: 'typing', label: 'Typing test', Icon: FiType, key: 'J' },
    { id: 'chat', label: 'Community chat', Icon: FiMessageSquare },
  ];
  return (
    <ul className="space-y-0.5">
      {items.map(({ id, label, Icon, key }) => (
        <li key={id}>
          <button type="button" className={row} onClick={() => open(id)} aria-keyshortcuts={key ? `${isApplePlatform() ? 'Meta' : 'Control'}+${key}` : undefined}>
            <Icon aria-hidden size={large ? 16 : 13} className="shrink-0 text-g-500 group-hover:text-ink" />
            <span className="flex-1 whitespace-nowrap">{label}</span>
            {key && !touch && (
              <span aria-hidden="true">
                <Kbd>
                  {mod}
                  {mod.length > 1 ? ' ' : ''}
                  {key}
                </Kbd>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
