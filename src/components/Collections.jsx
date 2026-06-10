// Optional sections. Each renders only when its array has entries (App also
// skips the whole section, so empty ones never show a heading).
import { useState } from 'react';
import { asset } from '../lib/asset';

function Monogram({ text }) {
  const letters = String(text || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-g-200 bg-g-50 font-mono text-xs text-g-600">
      {letters}
    </span>
  );
}

function Logo({ src, name }) {
  if (!src) return <Monogram text={name} />;
  return (
    <img src={asset(src)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-g-200 bg-bg object-contain p-1" />
  );
}

function External({ href, children, className = '' }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`hover:underline ${className}`}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Posts({ posts }) {
  if (!posts || posts.length === 0) return null;
  return (
    <ul className="divide-y divide-g-200 border-y border-g-200">
      {posts.map((post) => (
        <li key={post.url || post.title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <span className="label w-20 shrink-0 pt-0.5 tabular-nums">{post.date}</span>
          <div className="min-w-0">
            <External href={post.url} className="font-medium">
              {post.title}
            </External>
            {post.summary && <p className="mt-1 text-sm leading-relaxed text-g-500">{post.summary}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Certifications({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((cert) => (
        <li key={`${cert.title}-${cert.issuer}`} className="flex items-center gap-3 rounded-xl border border-g-200 p-3">
          <Logo src={cert.logo} name={cert.issuer || cert.title} />
          <div className="min-w-0">
            <External href={cert.url} className="block text-sm font-medium leading-snug">
              {cert.title}
            </External>
            {cert.issuer && <p className="label mt-0.5 truncate">{cert.issuer}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Recommendation({ rec }) {
  const [expanded, setExpanded] = useState(false);
  const long = rec.quote.length > 320;
  return (
    <figure className="flex flex-col rounded-2xl border border-g-200 bg-gradient-to-b from-g-50 to-bg p-5">
      <blockquote className={`font-serif text-[16.5px] leading-relaxed text-g-800 ${expanded ? '' : 'line-clamp-5'}`}>
        “{rec.quote}”
      </blockquote>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="label mt-2 self-start hover:text-ink">
          {expanded ? 'show less' : 'read more'}
        </button>
      )}
      <figcaption className="mt-4 text-sm">
        <span className="font-medium">{rec.name}</span>
        {rec.title && <span className="block text-g-500">{rec.title}</span>}
      </figcaption>
    </figure>
  );
}

export function Recommendations({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((rec) => (
        <Recommendation key={`${rec.name}-${rec.quote.slice(0, 24)}`} rec={rec} />
      ))}
    </div>
  );
}

export function Affiliations({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((aff) => (
        <li key={aff.name} className="flex items-center gap-3 rounded-xl border border-g-200 p-3">
          <Logo src={aff.logo} name={aff.name} />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{aff.name}</p>
            {aff.role && <p className="label mt-0.5">{aff.role}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
