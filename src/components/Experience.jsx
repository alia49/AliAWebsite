function Timeline({ items }) {
  return (
    <ol className="relative ml-[3px] border-l border-g-200">
      {items.map((item) => (
        <li key={item.key} className="relative pb-6 pl-6 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute -left-[4.5px] top-[0.42rem] h-2 w-2 rounded-full border border-g-400 bg-bg"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-[15px] font-medium leading-snug">
              {item.title}
              {item.sub && <span className="font-normal text-g-500"> · {item.sub}</span>}
            </p>
            {item.meta && <p className="label shrink-0 tabular-nums">{item.meta}</p>}
          </div>
          {item.note && <p className="mt-0.5 text-sm text-g-500">{item.note}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-block text-sm">
              {item.url.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
          {item.desc && <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-g-500">{item.desc}</p>}
          {item.bullets?.length > 0 && (
            <ul className="mt-2 max-w-[60ch] list-disc space-y-1 pl-4 text-sm leading-relaxed text-g-500">
              {item.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {item.stack?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {item.stack.map((tech) => (
                <li key={tech} className="chip px-2.5 py-0.5 text-[11px]">
                  {tech}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function Experience({ experience = [], education = [], stack = [], focusAreas = [] }) {
  return (
    <div className="space-y-12">
      {experience.length > 0 && (
        <Timeline
          items={experience.map((e) => ({
            key: `${e.role}-${e.org}`,
            title: e.role,
            sub: e.org,
            meta: e.dates,
            note: e.location,
            url: e.url,
            desc: e.desc,
            bullets: e.bullets,
            stack: e.stack,
          }))}
        />
      )}

      {education.length > 0 && (
        <div>
          <h3 className="label mb-4">education</h3>
          <Timeline
            items={education.map((e) => ({ key: `${e.degree}-${e.school}`, title: e.degree, sub: e.school, meta: e.date }))}
          />
        </div>
      )}

      {stack.length > 0 && (
        <div>
          <h3 className="label mb-4">stack</h3>
          <ul className="flex flex-wrap gap-1.5">
            {stack.map((tech) => (
              <li key={tech} className="chip px-3 py-1 text-xs">
                {tech}
              </li>
            ))}
          </ul>
        </div>
      )}

      {focusAreas.length > 0 && (
        <div>
          <h3 className="label mb-4">focus areas</h3>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {focusAreas.map((area) => (
              <div key={area.title}>
                <dt className="text-sm font-medium">{area.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-g-500">{area.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
