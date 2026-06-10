import { useActions } from '../lib/actions';
import { asset } from '../lib/asset';
import GazePortrait from '../features/gaze/GazePortrait';

function Portrait({ profile }) {
  const { portrait = {}, gaze = {} } = profile;
  const alt = portrait.alt || profile.name;

  if (gaze.enabled) {
    return (
      <figure className="fade-up relative w-48 sm:w-56">
        <GazePortrait
          dir={gaze.dir || 'images/gaze'}
          alt={alt}
          className="relative"
          imgClassName="photo-dissolve block aspect-[4/5] w-full rounded-t-2xl object-cover"
        />
      </figure>
    );
  }

  if (!portrait.src) return null;
  return (
    <figure className="fade-up relative">
      <img
        src={asset(portrait.src)}
        alt={alt}
        width={portrait.width}
        height={portrait.height}
        fetchPriority="high"
        decoding="async"
        className="photo-dissolve relative block aspect-[4/3] w-full rounded-t-2xl object-cover object-[50%_40%] sm:aspect-[3/2]"
      />
    </figure>
  );
}

export function SocialLinks({ profile, className = '', withHello = true }) {
  const { open } = useActions();
  return (
    <ul className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${className}`}>
      {profile.socials.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="link">
            {s.label}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
      {profile.resume && (
        <li>
          <a href={asset(profile.resume)} download={profile.resumeFileName || true} className="link">
            resume<span aria-hidden="true"> ↓</span>
            <span className="sr-only"> (PDF download)</span>
          </a>
        </li>
      )}
      {withHello && (
        <li>
          <button type="button" onClick={() => open('hello')} className="link">
            say hello
          </button>
        </li>
      )}
    </ul>
  );
}

export default function Hero({ profile }) {
  const meta = [profile.role, profile.location].filter(Boolean).join(' · ').toLowerCase();
  return (
    <section id="top" aria-labelledby="hero-name" className="scroll-mt-20 pt-6 sm:pt-10 lg:scroll-mt-10 lg:pt-16">
      <Portrait profile={profile} />
      <div className="relative mt-6">
        {meta && <p className="label fade-up d1">{meta}</p>}
        <h1 id="hero-name" className="fade-up d1 mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          {profile.name}
        </h1>
        {profile.now && (
          <p className="fade-up d2 mt-4 flex items-center gap-2 text-sm text-g-600">
            <span aria-hidden="true" className="live-dot" />
            {profile.now}
          </p>
        )}
        {profile.bio && (
          <p className="fade-up d2 mt-5 max-w-[62ch] text-[17px] leading-relaxed text-g-700">{profile.bio}</p>
        )}
        {profile.about && (
          <p className="fade-up d3 mt-3 max-w-[62ch] text-[15px] leading-relaxed text-g-500">{profile.about}</p>
        )}
        <SocialLinks profile={profile} className="fade-up d4 mt-6" />
      </div>
    </section>
  );
}

export function Highlights({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="fade-up d5 mt-10 border-y border-g-200 py-3">
      <p className="sr-only">Highlights</p>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11.5px] leading-5 text-g-600">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-1 shrink-0 bg-g-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Stats({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <dl className="fade-up d6 grid grid-cols-3 divide-x divide-g-200 border-b border-g-200">
      {items.slice(0, 3).map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col-reverse gap-1 px-3 py-5 first:pl-0 sm:px-5">
          <dt className="label">{stat.label}</dt>
          <dd className="break-words text-lg font-semibold leading-tight tracking-tight sm:text-2xl">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
