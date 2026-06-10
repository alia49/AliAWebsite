import { useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowUp, FiCommand } from 'react-icons/fi';
import Overlay, { CloseButton, Kbd } from '../../components/Overlay';
import { postAsk } from '../../lib/api';
import { usePrefersReducedMotion } from '../../lib/media';
import { useHealth } from '../../lib/useHealth';
import { play } from '../sounds/sounds';

const MAX_QUESTION = 500;
const MAX_HISTORY = 6; // contract: history ≤ 6 turns
const MAX_TURN = 1000; // server rejects longer history turns

/** Cycles through example questions, typing and deleting them like a person would. */
function useTypedPlaceholder(phrases, active) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active || phrases.length === 0) return undefined;
    let index = 0;
    let pos = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const phrase = phrases[index % phrases.length];
      if (!deleting) {
        pos += 1;
        setText(phrase.slice(0, pos));
        if (pos >= phrase.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1700);
          return;
        }
        timer = window.setTimeout(tick, 35 + Math.random() * 45);
      } else {
        pos -= 1;
        setText(phrase.slice(0, pos));
        if (pos <= 0) {
          deleting = false;
          index += 1;
          timer = window.setTimeout(tick, 350);
          return;
        }
        timer = window.setTimeout(tick, 16);
      }
    };
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
  }, [active, phrases]);
  return active ? text : '';
}

/** Reveals `text` character by character; screen readers get the full text at once. */
function TypeReveal({ text, animate }) {
  const [count, setCount] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) {
      setCount(text.length);
      return undefined;
    }
    const perSecond = Math.max(80, text.length / 3); // long answers finish in ~3 s
    const start = performance.now();
    let raf = 0;
    const frame = (now) => {
      const next = Math.min(text.length, Math.floor(((now - start) / 1000) * perSecond));
      setCount(next);
      if (next < text.length) raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [text, animate]);
  const done = count >= text.length;
  return (
    <>
      <span aria-hidden="true" className="whitespace-pre-line">
        {text.slice(0, count)}
        {!done && <span className="caret-blink ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-ink" />}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

function errorMessage(error, first) {
  switch (error && error.code) {
    case 'bad_question':
      return `I couldn’t quite read that one — try rephrasing it as a question about ${first}.`;
    case 'rate_limited': {
      const wait = error.data && Number(error.data.retryAfter);
      return `You’re asking faster than I can think. Try again in ${wait > 0 ? `${Math.ceil(wait)}s` : 'a moment'}.`;
    }
    case 'ask_disabled':
      return `The AI answerer is switched off right now — email ${first} instead.`;
    case 'upstream':
      return 'The answer service hiccuped. Give it another go in a moment.';
    case 'timeout':
      return 'That took too long to answer. Try again?';
    case 'network':
    case 'offline':
      return 'Couldn’t reach the server. The answerer may be offline.';
    default:
      return 'Something went wrong on my side. Try again?';
  }
}

export default function AskOverlay({ profile, onClose }) {
  const first = profile.name.split(' ')[0];
  const health = useHealth();
  const reduced = usePrefersReducedMotion();
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]); // { id, q, a?, status: pending|done|error, error? }
  const [disabled, setDisabled] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const suggestions = useMemo(() => {
    const list = [`What has ${first} built?`, `What’s in ${first}’s stack?`];
    if (profile.projects[0]) list.push(`Tell me about ${profile.projects[0].title}`);
    if (profile.education[0]) list.push(`Where did ${first} study?`);
    return list;
  }, [first, profile.projects, profile.education]);

  const unavailable = disabled || (health.status === 'ready' && (!health.ok || health.features.ask === false));
  const pending = thread.some((t) => t.status === 'pending');
  const typed = useTypedPlaceholder(suggestions, !question && !reduced && !unavailable && thread.length === 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  const ask = async (raw) => {
    const q = raw.trim();
    if (!q || pending || unavailable) return;
    const history = thread
      .filter((t) => t.status === 'done')
      .flatMap((t) => [
        { role: 'user', content: t.q.slice(0, MAX_TURN) },
        { role: 'assistant', content: t.a.slice(0, MAX_TURN) },
      ])
      .slice(-MAX_HISTORY);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setThread((list) => [...list, { id, q, status: 'pending' }]);
    setQuestion('');
    try {
      const data = await postAsk(q.slice(0, MAX_QUESTION), history);
      const answer = (data && typeof data.answer === 'string' && data.answer.trim()) || 'I don’t have an answer for that one.';
      setThread((list) => list.map((t) => (t.id === id ? { ...t, status: 'done', a: answer } : t)));
      play('tick');
    } catch (error) {
      if (error.code === 'ask_disabled' || error.code === 'offline') setDisabled(true);
      setThread((list) => list.map((t) => (t.id === id ? { ...t, status: 'error', error: errorMessage(error, first) } : t)));
      play('error');
    } finally {
      if (inputRef.current) inputRef.current.focus({ preventScroll: true });
    }
  };

  const mailto = `mailto:${profile.email}?subject=${encodeURIComponent('A question from your website')}${
    question.trim() ? `&body=${encodeURIComponent(question.trim())}` : ''
  }`;

  return (
    <Overlay onClose={onClose} label={`Ask me anything about ${first}`} panelClassName="max-w-xl overflow-hidden">
      <form
        className="flex items-center gap-2 border-b border-g-200 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <FiCommand aria-hidden size={15} className="shrink-0 text-g-500" />
        <input
          ref={inputRef}
          data-autofocus
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={MAX_QUESTION}
          aria-label={`Ask a question about ${first}`}
          placeholder={typed || `Ask me anything about ${first}…`}
          autoComplete="off"
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent py-1 text-[16px] text-ink placeholder:text-g-500 focus:outline-none sm:text-[15px]"
        />
        <button
          type="submit"
          disabled={!question.trim() || pending || unavailable}
          aria-label="Ask"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25"
        >
          <FiArrowUp aria-hidden size={15} />
        </button>
        <CloseButton onClick={onClose} className="-mr-1.5 sm:hidden" />
      </form>

      <div ref={scrollRef} className="max-h-[min(26rem,60vh)] overflow-y-auto px-4 py-4" aria-live="polite">
        {thread.length === 0 && (
          <div className="relative overflow-hidden">
            <div aria-hidden="true" className="ht mask-tr absolute right-0 top-0 h-24 w-40" />
            <p className="label relative">ask me anything about {first.toLowerCase()}</p>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-g-600">
              An AI answerer that only knows what’s on this site — projects, experience, stack and education.
            </p>
            {!unavailable && (
              <ul className="relative mt-4 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)} disabled={pending} className="btn px-3 py-1 text-xs">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ol className="space-y-5">
          {thread.map((t) => (
            <li key={t.id}>
              <p className="font-mono text-xs text-g-500">
                <span aria-hidden="true">› </span>
                <span className="sr-only">You asked: </span>
                {t.q}
              </p>
              <div className="mt-2 text-[15px] leading-relaxed text-g-800">
                {t.status === 'pending' && (
                  <span className="loader-dots inline-flex items-center text-g-500" role="status">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">Thinking…</span>
                  </span>
                )}
                {t.status === 'done' && <TypeReveal text={t.a} animate={!reduced} />}
                {t.status === 'error' && <p className="text-sm text-danger">{t.error}</p>}
              </div>
            </li>
          ))}
        </ol>

        {unavailable && (
          <div className="mt-4 rounded-xl border border-dashed border-g-300 p-4">
            <p className="text-sm font-medium">The AI answerer is offline right now.</p>
            <p className="mt-1 text-sm text-g-500">
              You can still ask {first} directly{question.trim() ? ' — your question will be pre-filled' : ''}.
            </p>
            <a href={mailto} className="btn-solid mt-3 px-3.5 py-1.5 text-xs">
              email {first.toLowerCase()} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
        {health.status === 'loading' && thread.length === 0 && (
          <p className="label mt-4" role="status">
            connecting…
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-g-200 px-4 py-2.5">
        <p className="label">answers are generated from {first.toLowerCase()}’s profile and can be imperfect</p>
        <span className="hidden items-center gap-1 sm:flex" aria-hidden="true">
          <Kbd>esc</Kbd>
          <span className="label">close</span>
        </span>
      </div>
    </Overlay>
  );
}
