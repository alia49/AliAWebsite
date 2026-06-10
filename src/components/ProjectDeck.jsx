import { useRef, useState } from 'react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { asset } from '../lib/asset';
import { useIsTouch } from '../lib/media';
import { play } from '../features/sounds/sounds';

const pad = (n) => String(n).padStart(2, '0');

/** Which slot a card occupies relative to the active index. */
export function deckPosition(index, active, count) {
  if (index === active) return 'center';
  if (count === 2) return 'right';
  if (count >= 3) {
    if (index === (active - 1 + count) % count) return 'left';
    if (index === (active + 1) % count) return 'right';
  }
  return 'hidden';
}

function DeckCard({ project, index, position, onSelect, onOpen }) {
  const isCenter = position === 'center';
  const shown = project.stack.slice(0, 2);
  const extra = project.stack.length - shown.length;
  return (
    <article
      data-pos={position}
      data-testid={`deck-card-${project.slug}`}
      aria-hidden={position === 'hidden' ? true : undefined}
      className="deck-card border border-g-200 bg-bg"
    >
      <div className="deck-card-body relative flex h-full flex-col overflow-hidden rounded-[inherit] p-5" inert={!isCenter}>
        {project.image ? (
          <img
            src={asset(project.image)}
            alt=""
            loading="lazy"
            className="mask-down absolute inset-x-0 top-0 h-28 w-full object-cover opacity-80"
          />
        ) : (
          <div aria-hidden="true" className="ht mask-tr absolute right-0 top-0 h-28 w-40" />
        )}
        <p className="label relative">
          {pad(index + 1)} · {project.category.toLowerCase()}
        </p>
        <h3 className={`relative text-xl font-semibold tracking-tight ${project.image ? 'mt-12' : 'mt-6'}`}>
          {project.title}
          {project.badge && <span className="chip ml-2 align-middle">{project.badge}</span>}
        </h3>
        <p className="label relative mt-0.5">{project.date}</p>
        <p className={`relative mt-3 text-sm leading-relaxed text-g-600 ${project.image ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {project.desc}
        </p>
        <div className="relative mt-auto flex items-end justify-between gap-3 pt-4">
          <ul className="flex min-w-0 flex-nowrap gap-1 overflow-hidden" aria-label="Stack">
            {shown.map((tech) => (
              <li key={tech} className="chip shrink-0">
                {tech}
              </li>
            ))}
            {extra > 0 && <li className="chip shrink-0">+{extra}</li>}
          </ul>
          <button type="button" className="btn-solid shrink-0 px-3 py-1 text-xs" onClick={() => onOpen(project)}>
            details <span aria-hidden="true">→</span>
            <span className="sr-only"> about {project.title}</span>
          </button>
        </div>
      </div>
      {!isCenter && position !== 'hidden' && (
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Show project: ${project.title}`}
          className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-offset-4"
        />
      )}
    </article>
  );
}

/**
 * Spotlight card deck: centre card in focus, neighbours fanned out left/right.
 * Click a side card (or use ←/→, the buttons, or swipe) to rotate through all projects.
 */
export default function ProjectDeck({ projects, onOpen }) {
  const count = projects.length;
  const [active, setActive] = useState(0);
  const touch = useIsTouch();
  const swipe = useRef({ x: 0, y: 0, id: null, swiped: false });

  const select = (index) => {
    if (index === active) return;
    play('tick');
    setActive(index);
  };
  const step = (delta) => {
    play('tick');
    setActive((current) => (current + delta + count) % count);
  };

  if (count === 0) return null;

  const onKeyDown = (event) => {
    if (count < 2 || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse') return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId, swiped: false };
  };
  const onPointerUp = (event) => {
    const s = swipe.current;
    if (s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    s.id = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      s.swiped = true;
      step(dx < 0 ? 1 : -1);
    }
  };
  const onClickCapture = (event) => {
    if (swipe.current.swiped) {
      swipe.current.swiped = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const current = projects[active];

  return (
    <div className="deck" onKeyDown={onKeyDown}>
      <div
        className="deck-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label="Projects"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {projects.map((project, index) => (
          <DeckCard
            key={project.slug || project.title}
            project={project}
            index={index}
            position={deckPosition(index, active, count)}
            onSelect={select}
            onOpen={onOpen}
          />
        ))}
      </div>

      {count > 1 && (
        <div className="mt-1 flex items-center justify-center gap-3">
          <button type="button" onClick={() => step(-1)} aria-label="Previous project" className="btn h-8 w-8 p-0">
            <FiArrowLeft aria-hidden size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            {projects.map((project, index) => (
              <button
                key={project.slug || project.title}
                type="button"
                onClick={() => select(index)}
                aria-label={`Go to project ${index + 1}: ${project.title}`}
                aria-current={index === active ? 'true' : undefined}
                className="group grid h-6 w-4 place-items-center"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-g-300 transition-all group-hover:bg-g-500 group-aria-[current=true]:w-4 group-aria-[current=true]:bg-ink" />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => step(1)} aria-label="Next project" className="btn h-8 w-8 p-0">
            <FiArrowRight aria-hidden size={14} />
          </button>
        </div>
      )}
      <p className="label mt-2 text-center" aria-hidden="true">
        {pad(active + 1)} / {pad(count)}
        {!touch && count > 1 && <span className="hidden sm:inline"> · ← → to browse</span>}
      </p>
      <p className="sr-only" aria-live="polite">
        {`Project ${active + 1} of ${count}: ${current.title}`}
      </p>
    </div>
  );
}
