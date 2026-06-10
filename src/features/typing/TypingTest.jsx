import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { FiRotateCcw } from 'react-icons/fi';
import Overlay, { CloseButton, Kbd } from '../../components/Overlay';
import { readStore, writeStore } from '../../lib/storage';
import { play } from '../sounds/sounds';
import { randomWords } from './words';

const DURATIONS = [15, 30, 60];
const DEFAULT_DURATION = 30;
const BATCH = 120;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function fresh(duration) {
  return {
    status: 'idle', // idle | running | done
    duration,
    words: randomWords(BATCH),
    typed: [], // committed attempts, one per word
    input: '',
    startedAt: 0,
    correctKeys: 0,
    wrongKeys: 0,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return fresh(action.duration || state.duration);
    case 'finish':
      return state.status === 'running' ? { ...state, status: 'done' } : state;
    case 'input': {
      if (state.status === 'done') return state;
      let { value } = action;
      const target = state.words[state.typed.length] || '';
      const next = { ...state };
      if (state.status === 'idle') {
        if (!value.trim()) return state; // ignore leading spaces
        next.status = 'running';
        next.startedAt = action.now;
      }
      if (/\s$/.test(value)) {
        const attempt = value.trim();
        if (!attempt) return { ...next, input: '' };
        next.typed = [...state.typed, attempt];
        next.input = '';
        if (attempt === target) next.correctKeys += 1;
        else next.wrongKeys += 1;
        if (next.words.length - next.typed.length < 40) next.words = [...next.words, ...randomWords(BATCH)];
        return next;
      }
      value = value.slice(0, target.length + 8);
      if (value.length > state.input.length) {
        for (let i = state.input.length; i < value.length; i += 1) {
          if (value[i] === target[i]) next.correctKeys += 1;
          else next.wrongKeys += 1;
        }
      }
      next.input = value;
      return next;
    }
    default:
      return state;
  }
}

export function computeStats(state, now) {
  const elapsedMs = state.startedAt ? Math.min(state.duration * 1000, Math.max(0, now - state.startedAt)) : 0;
  const minutes = elapsedMs / 60000;
  let correctChars = 0;
  let allChars = 0;
  state.typed.forEach((attempt, i) => {
    allChars += attempt.length + 1;
    if (attempt === state.words[i]) correctChars += attempt.length + 1;
  });
  allChars += state.input.length;
  const keys = state.correctKeys + state.wrongKeys;
  return {
    elapsed: elapsedMs / 1000,
    left: Math.max(0, state.duration - elapsedMs / 1000),
    wpm: minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0,
    raw: minutes > 0 ? Math.round(allChars / 5 / minutes) : 0,
    accuracy: keys > 0 ? Math.round((state.correctKeys / keys) * 100) : 100,
    correctWords: state.typed.filter((t, i) => t === state.words[i]).length,
    wrongWords: state.typed.filter((t, i) => t !== state.words[i]).length,
  };
}

export function verdict(wpm, accuracy) {
  let line;
  if (wpm < 25) line = 'Warm-up lap. The keyboard is still getting to know you.';
  else if (wpm < 40) line = 'Steady hands. Reliable, unhurried, respectable.';
  else if (wpm < 55) line = 'Solidly quick — emails fear you a little.';
  else if (wpm < 70) line = 'Fast. Your commit messages are probably full sentences.';
  else if (wpm < 90) line = 'Very fast. The keys would like a short break.';
  else if (wpm < 110) line = 'Blistering. Are there extra fingers involved?';
  else line = 'Suspiciously fast. Please confirm you are not a robot.';
  if (accuracy < 85) line += ' (Accuracy could use some love, though.)';
  return line;
}

function Word({ word, attempt, current, input }) {
  if (!current && attempt === undefined) {
    return <span className="text-g-400">{word}</span>;
  }
  const typed = current ? input : attempt;
  const letters = [];
  const length = Math.max(word.length, typed.length);
  for (let i = 0; i < length; i += 1) {
    const expected = word[i];
    const actual = typed[i];
    let cls = 'text-g-400';
    if (actual !== undefined && expected === undefined) cls = 'text-danger opacity-70';
    else if (actual === undefined) cls = current ? 'text-g-400' : 'text-g-400 underline decoration-danger/60';
    else cls = actual === expected ? 'text-ink' : 'text-danger';
    letters.push(
      <span key={i} className={cls}>
        {expected === undefined ? actual : expected}
      </span>
    );
    if (current && i === typed.length - 1) letters.push(<span key="caret" data-caret />);
  }
  if (current && typed.length === 0) letters.unshift(<span key="caret" data-caret />);
  const wrong = !current && attempt !== word;
  return (
    <span data-current={current || undefined} className={wrong ? 'underline decoration-danger/50 underline-offset-[6px]' : undefined}>
      {letters}
    </span>
  );
}

function Keyboard({ active }) {
  return (
    <div className="hidden select-none flex-col items-center gap-1.5 sm:flex" aria-hidden="true">
      {KEY_ROWS.map((row, r) => (
        <div key={row} className="flex gap-1.5" style={{ paddingLeft: `${r * 0.9}rem` }}>
          {row.split('').map((key) => (
            <span
              key={key}
              className={`grid h-8 w-8 place-items-center rounded-md border font-mono text-[11px] transition-colors duration-75 ${
                active.has(key) ? 'border-ink bg-ink text-bg' : 'border-g-200 text-g-500'
              }`}
            >
              {key}
            </span>
          ))}
        </div>
      ))}
      <span
        className={`mt-0.5 h-8 w-64 rounded-md border transition-colors duration-75 ${
          active.has(' ') ? 'border-ink bg-ink' : 'border-g-200'
        }`}
      />
    </div>
  );
}

export default function TypingTest({ onClose }) {
  const [duration, setDuration] = useState(() => {
    const saved = Number(readStore('typingDuration'));
    return DURATIONS.includes(saved) ? saved : DEFAULT_DURATION;
  });
  const [state, dispatch] = useReducer(reducer, duration, fresh);
  const [now, setNow] = useState(() => Date.now());
  const [focused, setFocused] = useState(true);
  const [activeKeys, setActiveKeys] = useState(() => new Set());
  const [offset, setOffset] = useState(0);
  const [caret, setCaret] = useState(null);
  const [best, setBest] = useState(() => Number(readStore(`typingBest:${duration}`)) || 0);
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef(null);
  const innerRef = useRef(null);
  const restartRef = useRef(null);

  const focusInput = () => inputRef.current && inputRef.current.focus({ preventScroll: true });

  const restart = useCallback(
    (nextDuration = duration) => {
      dispatch({ type: 'reset', duration: nextDuration });
      setOffset(0);
      setNewBest(false);
      setBest(Number(readStore(`typingBest:${nextDuration}`)) || 0);
      window.setTimeout(() => inputRef.current && inputRef.current.focus({ preventScroll: true }), 0);
    },
    [duration]
  );

  // clock
  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - state.startedAt >= state.duration * 1000) dispatch({ type: 'finish' });
    }, 100);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt, state.duration]);

  // results: personal best + sound, then move focus to "restart"
  useEffect(() => {
    if (state.status !== 'done') return;
    const final = computeStats(state, state.startedAt + state.duration * 1000);
    const key = `typingBest:${state.duration}`;
    const previous = Number(readStore(key)) || 0;
    if (final.wpm > previous) {
      writeStore(key, final.wpm);
      setBest(final.wpm);
      setNewBest(previous > 0);
    }
    play('chime');
    window.setTimeout(() => restartRef.current && restartRef.current.focus({ preventScroll: true }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per finished test
  }, [state.status]);

  // caret position + keep the current line in view (3 visible lines)
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || state.status === 'done') return;
    const word = inner.querySelector('[data-current]');
    const anchor = inner.querySelector('[data-caret]');
    if (!word || !anchor) return;
    const lineHeight = word.offsetHeight || 38;
    const nextOffset = Math.max(0, word.offsetTop - lineHeight);
    setOffset((prev) => (prev === nextOffset ? prev : nextOffset));
    // both are measured against the translated inner layer (their offsetParent)
    setCaret({ left: anchor.offsetLeft, top: word.offsetTop, height: lineHeight });
  }, [state.input, state.typed.length, state.words, state.status]);

  // "press any key to focus" when the hidden input has lost focus
  useEffect(() => {
    if (focused || state.status === 'done') return undefined;
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      const target = event.target;
      if (target && target.closest && target.closest('button, a, input, textarea, select')) return;
      if (inputRef.current) inputRef.current.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focused, state.status]);

  const onKeyDown = (event) => {
    const key = event.key === ' ' ? ' ' : event.key.toLowerCase();
    if (key.length === 1) {
      setActiveKeys((prev) => new Set(prev).add(key));
      if (!event.repeat) play('key');
    }
  };
  const onKeyUp = (event) => {
    const key = event.key === ' ' ? ' ' : event.key.toLowerCase();
    setActiveKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const stats = computeStats(state, state.status === 'done' ? state.startedAt + state.duration * 1000 : now);
  const done = state.status === 'done';
  const visibleWords = state.words.slice(0, state.typed.length + 60);

  return (
    <Overlay onClose={onClose} labelledBy="typing-title" panelClassName="max-w-3xl overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-g-200 px-5 py-3">
        <h2 id="typing-title" className="font-mono text-[13px] text-g-500">
          <span className="text-ink">typing test</span> — {state.duration}s
        </h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Test length" className="flex rounded-full border border-g-200 p-0.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={state.duration === d}
                onClick={() => {
                  setDuration(d);
                  writeStore('typingDuration', d);
                  restart(d);
                }}
                className="rounded-full px-2.5 py-0.5 font-mono text-[11px] text-g-500 hover:text-ink aria-pressed:bg-g-100 aria-pressed:text-ink"
              >
                {d}s
              </button>
            ))}
          </div>
          <CloseButton onClick={onClose} />
        </div>
      </header>

      {!done ? (
        <div className="px-5 pb-6 pt-5 sm:px-8">
          <div className="flex items-end justify-between gap-4 font-mono">
            <p className="text-3xl font-medium tabular-nums" aria-label={`${Math.ceil(stats.left)} seconds left`}>
              {Math.ceil(stats.left)}
            </p>
            <dl className="flex gap-5 text-right text-xs text-g-500">
              <div>
                <dt>wpm</dt>
                <dd className="text-base tabular-nums text-ink">{stats.wpm}</dd>
              </div>
              <div>
                <dt>acc</dt>
                <dd className="text-base tabular-nums text-ink">{stats.accuracy}%</dd>
              </div>
              <div>
                <dt>time</dt>
                <dd className="text-base tabular-nums text-ink">{Math.floor(stats.elapsed)}s</dd>
              </div>
            </dl>
          </div>

          {/* The text: three visible lines, the current one kept on line two. */}
          <div
            onClick={focusInput}
            className="relative mt-5 h-[7.2rem] cursor-text overflow-hidden font-mono text-[19px] leading-[2.4rem] sm:text-[21px]"
          >
            <div ref={innerRef} className="relative transition-transform duration-150 ease-out" style={{ transform: `translateY(${-offset}px)` }}>
              <p className="flex flex-wrap gap-x-[0.6em]" aria-hidden="true">
                {visibleWords.map((word, i) => (
                  <Word
                    key={`${i}-${word}`}
                    word={word}
                    attempt={state.typed[i]}
                    current={i === state.typed.length}
                    input={state.input}
                  />
                ))}
              </p>
              {caret && focused && (
                <span
                  aria-hidden="true"
                  className={`type-caret ${state.status === 'idle' ? 'caret-blink' : ''}`}
                  style={{ left: caret.left - 1, top: caret.top + caret.height * 0.18, height: caret.height * 0.64 }}
                />
              )}
            </div>
            {!focused && (
              <div className="absolute inset-0 grid place-items-center bg-bg/70 backdrop-blur-[2px]">
                <p className="label">click here or press any key to focus</p>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            data-autofocus
            value={state.input}
            onChange={(event) => dispatch({ type: 'input', value: event.target.value, now: Date.now() })}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setActiveKeys(new Set());
            }}
            aria-label={`Typing test input. Type the words shown; the timer starts on your first key. Next word: ${
              state.words[state.typed.length]
            }`}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="absolute h-px w-px opacity-0"
            style={{ left: 0, top: 0, fontSize: 16 }}
          />

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="label">{state.status === 'idle' ? 'start typing — the clock starts with your first key' : 'space moves to the next word'}</p>
            <button type="button" onClick={() => restart()} className="btn px-3 py-1 text-xs">
              <FiRotateCcw aria-hidden size={12} /> restart
            </button>
          </div>

          <div className="mt-6">
            <Keyboard active={activeKeys} />
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden px-5 pb-7 pt-6 sm:px-8" aria-live="polite">
          <div aria-hidden="true" className="ht-wide mask-tr absolute right-0 top-0 h-48 w-2/3" />
          <p className="label relative">result</p>
          <div className="relative mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-6xl font-semibold tracking-tight tabular-nums">{stats.wpm}</p>
              <p className="label mt-1">words per minute{newBest ? ' · new personal best' : ''}</p>
            </div>
            <dl className="grid grid-cols-3 gap-x-8 gap-y-1 font-mono text-xs text-g-500">
              <dt>accuracy</dt>
              <dt>raw</dt>
              <dt>words</dt>
              <dd className="text-lg tabular-nums text-ink">{stats.accuracy}%</dd>
              <dd className="text-lg tabular-nums text-ink">{stats.raw}</dd>
              <dd className="text-lg tabular-nums text-ink">
                {stats.correctWords}
                <span className="text-g-500">/{stats.correctWords + stats.wrongWords}</span>
              </dd>
            </dl>
          </div>
          <p className="relative mt-6 max-w-lg text-[15px] leading-relaxed text-g-700">{verdict(stats.wpm, stats.accuracy)}</p>
          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <button ref={restartRef} type="button" onClick={() => restart()} className="btn-solid px-4 py-2">
              <FiRotateCcw aria-hidden size={13} /> try again
            </button>
            {best > 0 && <span className="label">best at {state.duration}s: {best} wpm</span>}
            <span className="label ml-auto hidden items-center gap-1 sm:flex" aria-hidden="true">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </div>
      )}
    </Overlay>
  );
}
