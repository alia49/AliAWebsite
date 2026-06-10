import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import Overlay, { CloseButton } from './Overlay';

const LINK_LABELS = { demo: 'live demo', repo: 'source code' };

export default function ProjectDetail({ project, index, count, onClose, onNavigate }) {
  const links = Object.entries(project.links || {}).filter(([, url]) => Boolean(url));
  const headingId = `project-${project.slug}-title`;
  return (
    <Overlay onClose={onClose} labelledBy={headingId} panelClassName="max-w-2xl">
      <header className="relative flex items-start justify-between gap-4 overflow-hidden border-b border-g-200 px-5 pb-5 pt-6 sm:px-7">
        <div aria-hidden="true" className="ht-dense mask-tr absolute right-0 top-0 h-full w-1/2" />
        <div className="relative">
          <p className="label">
            {project.category.toLowerCase()} · {project.date}
          </p>
          <h2 id={headingId} className="mt-1.5 text-2xl font-semibold tracking-tight">
            {project.title}
          </h2>
        </div>
        <CloseButton onClick={onClose} className="relative -mr-2 -mt-1" />
      </header>

      <div className="max-h-[62vh] overflow-y-auto px-5 py-6 sm:px-7">
        <p className="text-[15px] leading-relaxed text-g-700">{project.desc}</p>

        {project.bullets && project.bullets.length > 0 && (
          <>
            <h3 className="label mt-7">what I did</h3>
            <ul className="mt-3 space-y-3">
              {project.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="relative pl-5 text-sm leading-relaxed text-g-600 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2.5 before:bg-g-400"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </>
        )}

        {project.stack && project.stack.length > 0 && (
          <>
            <h3 className="label mt-7">stack</h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <li key={tech} className="chip">
                  {tech}
                </li>
              ))}
            </ul>
          </>
        )}

        {links.length > 0 && (
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map(([kind, url]) => (
              <li key={kind}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="link">
                  {LINK_LABELS[kind] || kind}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {count > 1 && (
        <footer className="flex items-center justify-between border-t border-g-200 px-5 py-3 sm:px-7">
          <button type="button" onClick={() => onNavigate(-1)} className="btn px-3 py-1 text-xs">
            <FiArrowLeft aria-hidden size={12} /> previous
          </button>
          <span className="label tabular-nums">
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
          <button type="button" onClick={() => onNavigate(1)} className="btn px-3 py-1 text-xs">
            next <FiArrowRight aria-hidden size={12} />
          </button>
        </footer>
      )}
    </Overlay>
  );
}
