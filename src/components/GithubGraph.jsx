import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInView } from '../lib/useInView';

// Public API (no key): { total: { lastYear }, contributions: [{ date, count, level 0-4 }] }.
const API = 'https://github-contributions-api.jogruber.de/v4';

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 28;
const TOP = 18;
const WEEKS_PLACEHOLDER = 53;
const LEVEL_FILL = ['fill-g-100', 'fill-g-300', 'fill-g-500', 'fill-g-700', 'fill-ink'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

const parseDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const levelFor = (day) => {
  if (Number.isInteger(day.level)) return Math.max(0, Math.min(4, day.level));
  if (!day.count) return 0;
  return Math.min(4, Math.ceil(day.count / 3));
};

/** Group days into Sunday-first week columns. */
export function buildWeeks(contributions) {
  const days = [...contributions].filter((d) => d && d.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const weeks = [];
  let week = new Array(7).fill(null);
  days.forEach((day) => {
    const date = parseDay(day.date);
    const dow = date.getUTCDay();
    if (dow === 0 && week.some(Boolean)) {
      weeks.push(week);
      week = new Array(7).fill(null);
    }
    week[dow] = { ...day, date, level: levelFor(day) };
  });
  if (week.some(Boolean)) weeks.push(week);
  return weeks;
}

function monthLabels(weeks) {
  const starts = [];
  weeks.forEach((week, i) => {
    const first = week.find(Boolean);
    if (!first) return;
    const month = first.date.getUTCMonth();
    if (!starts.length || starts[starts.length - 1].month !== month) starts.push({ i, month });
  });
  // drop a sliver of a month at either end so labels never collide or clip
  if (starts.length > 1 && starts[1].i - starts[0].i < 3) starts.shift();
  if (starts.length > 1 && weeks.length - starts[starts.length - 1].i < 2) starts.pop();
  return starts.map((s) => ({ x: LEFT + s.i * STEP, text: MONTHS[s.month] }));
}

const describe = (day) =>
  `${day.count === 0 ? 'No' : day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;

function Graph({ weeks, loading, label }) {
  const columns = loading ? WEEKS_PLACEHOLDER : weeks.length;
  const width = LEFT + columns * STEP - GAP;
  const height = TOP + 7 * STEP - GAP;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`block w-full min-w-[560px] ${loading ? 'skeleton' : ''}`}
      role="img"
      aria-label={label}
    >
      {!loading &&
        monthLabels(weeks).map((m) => (
          <text key={`${m.text}-${m.x}`} x={m.x} y={10} className="fill-g-500 font-mono" fontSize="9">
            {m.text}
          </text>
        ))}
      {Object.entries(DAY_LABELS).map(([row, text]) => (
        <text key={text} x={0} y={TOP + Number(row) * STEP + CELL - 1.5} className="fill-g-500 font-mono" fontSize="9">
          {text}
        </text>
      ))}
      {loading
        ? Array.from({ length: columns * 7 }, (_, i) => (
            <rect
              key={i}
              x={LEFT + Math.floor(i / 7) * STEP}
              y={TOP + (i % 7) * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              className="fill-g-100"
            />
          ))
        : weeks.map((week, wi) =>
            week.map((day, di) =>
              day ? (
                <rect
                  key={`${wi}-${di}`}
                  x={LEFT + wi * STEP}
                  y={TOP + di * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={LEVEL_FILL[day.level]}
                >
                  <title>{describe(day)}</title>
                </rect>
              ) : null
            )
          )}
    </svg>
  );
}

export default function GithubGraph({ user }) {
  const ref = useRef(null);
  const scroller = useRef(null);
  const visible = useInView(ref, '300px');
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!visible || !user) return undefined;
    if (typeof fetch !== 'function') {
      setState({ status: 'error' });
      return undefined;
    }
    const controller = new AbortController();
    fetch(`${API}/${encodeURIComponent(user)}?y=last`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.contributions)) throw new Error('Unexpected response');
        const sum = data.contributions.reduce((acc, d) => acc + (d.count || 0), 0);
        const total = data.total && Number.isFinite(data.total.lastYear) ? data.total.lastYear : sum;
        setState({ status: 'ready', total, weeks: buildWeeks(data.contributions) });
      })
      .catch((error) => {
        if (error && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [visible, user]);

  // on narrow screens the graph scrolls horizontally: start at the most recent week
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && state.status === 'ready') el.scrollLeft = el.scrollWidth;
  }, [state.status]);

  const profileUrl = `https://github.com/${user}`;

  if (state.status === 'error') {
    return (
      <div ref={ref} className="relative overflow-hidden rounded-2xl border border-dashed border-g-300 px-5 py-8 text-center">
        <div aria-hidden="true" className="ht-wide mask-circle absolute inset-0" />
        <p className="relative text-sm text-g-600">The contribution graph couldn’t be loaded right now.</p>
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="link relative mt-2 inline-block text-sm">
          see it on github.com/{user}
          <span aria-hidden="true"> ↗</span>
        </a>
      </div>
    );
  }

  const loading = state.status !== 'ready';
  const summary = loading
    ? 'Loading GitHub contributions'
    : `${state.total.toLocaleString('en-US')} contribution${state.total === 1 ? '' : 's'} in the last year`;

  return (
    <div ref={ref} aria-busy={loading}>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
        <Graph weeks={state.weeks || []} loading={loading} label={`GitHub contribution graph: ${summary}`} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="label" aria-live="polite">
          {loading ? <span className="skeleton inline-block h-3 w-44 rounded bg-g-100 align-middle" /> : summary}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="label mr-1">less</span>
          {LEVEL_FILL.map((cls) => (
            <svg key={cls} width="10" height="10" viewBox="0 0 10 10">
              <rect width="10" height="10" rx="2" className={cls} />
            </svg>
          ))}
          <span className="label ml-1">more</span>
        </div>
      </div>
    </div>
  );
}
