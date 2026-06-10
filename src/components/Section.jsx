/** Numbered page section: heading reads "01 — projects" with an optional right-aligned link. */
export default function Section({ id, num, label, action, children, className = '' }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`scroll-mt-20 pt-20 lg:scroll-mt-10 ${className}`}>
      <div className="mb-7 flex items-baseline justify-between gap-4">
        <h2 id={`${id}-heading`} tabIndex={-1} className="font-mono text-[13px] text-g-500 focus:outline-none">
          <span className="text-ink">{num}</span> — {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionLink({ href, children }) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="font-mono text-[11px] text-g-500 transition-colors hover:text-ink"
    >
      {children} <span aria-hidden="true">→</span>
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
