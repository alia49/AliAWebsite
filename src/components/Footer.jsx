import { useActions } from '../lib/actions';

/** Closing call-to-action at the end of <main>. */
export function ContactCta({ firstName }) {
  const { open } = useActions();
  return (
    <section
      aria-labelledby="contact-heading"
      className="relative mt-24 overflow-hidden rounded-2xl border border-g-200 px-6 py-10 sm:px-10"
    >
      <div aria-hidden="true" className="ht mask-tr absolute right-0 top-0 h-full w-2/3" />
      <div aria-hidden="true" className="dither mask-bl absolute bottom-0 left-0 h-28 w-48" />
      <p className="label relative">contact</p>
      <h2 id="contact-heading" className="relative mt-2 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
        Building something? I’d like to hear about it.
      </h2>
      <div className="relative mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => open('hello')} className="btn-solid px-4 py-2">
          say hello
        </button>
        <button type="button" onClick={() => open('ask')} className="btn px-4 py-2">
          ask about {firstName}
        </button>
      </div>
    </section>
  );
}

export default function Footer({ profile }) {
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-g-200 py-8">
      <p className="label">
        © {new Date().getFullYear()} {profile.name}
      </p>
      <div className="flex items-center gap-5 font-mono text-[11px] text-g-500">
        {profile.githubUser && (
          <a
            href={`https://github.com/${profile.githubUser}`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-ink"
          >
            github<span aria-hidden="true"> ↗</span>
          </a>
        )}
        <a href="#top" className="transition-colors hover:text-ink">
          back to top <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
