import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiMonitor, FiSend, FiSmartphone, FiTrash2 } from 'react-icons/fi';
import Overlay, { CloseButton } from '../../components/Overlay';
import PixelAvatar from '../../components/PixelAvatar';
import { deleteChat, getChat, getChatIdentity, hasApi, patchChat, postChat, resetHealthCache } from '../../lib/api';
import { readStore, writeStore } from '../../lib/storage';
import { absoluteTime, relativeTime } from '../../lib/time';
import { useHealth } from '../../lib/useHealth';
import { play } from '../sounds/sounds';

const PixelRoom = lazy(() => import('./PixelRoom'));

// Mirrors the API contract (docs/redesign-plan.md §3).
const POLL_MS = 5000;
const FULL_REFRESH_EVERY = 6; // every ~30 s re-fetch the latest 50 to pick up edits/deletes
const COOLDOWN_S = 15;
const MAX_BODY = 280;
const MAX_NAME = 24;
const KEEP = 200;
const NAME_KEY = 'chatName';

const ERRORS = {
  empty: 'Say something first.',
  too_long: `Keep it under ${MAX_BODY} characters.`,
  link: 'Links aren’t allowed in the chat.',
  offensive: 'Let’s keep it friendly — try rewording that.',
  bad_name: `Names need to be 1–${MAX_NAME} characters, no links or rude words.`,
  no_client: 'Your browser didn’t send an id. Try reloading the page.',
  cooldown: 'Easy there — wait a moment before posting again.',
  forbidden: 'You can only change your own messages.',
  not_found: 'That message no longer exists.',
  network: 'Couldn’t reach the chat server. Try again in a moment.',
  timeout: 'The chat server took too long to answer.',
};

// The server counts Unicode code points (an emoji is one character).
export const charCount = (text) => Array.from(text).length;

const errorText = (error) => ERRORS[error && error.code] || 'Something went wrong. Try again?';

/** Merge incoming messages. A full refresh reconciles the window it covers (edits + deletes). */
export function mergeMessages(prev, incoming, full) {
  let base = prev;
  if (full) {
    if (incoming.length === 0) return [];
    const oldest = Math.min(...incoming.map((m) => m.id));
    base = prev.filter((m) => m.id < oldest);
  }
  const byId = new Map(base.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEEP);
}

function DeviceIcon({ device }) {
  if (device === 'desktop') return <FiMonitor aria-label="on desktop" role="img" size={10} className="text-g-400" />;
  if (device === 'mobile') return <FiSmartphone aria-label="on mobile" role="img" size={10} className="text-g-400" />;
  return null;
}

function Message({ message, now, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const body = draft.trim();
    if (!body) return setError(ERRORS.empty);
    if (charCount(body) > MAX_BODY) return setError(ERRORS.too_long);
    if (body === message.body) return setEditing(false);
    setBusy(true);
    setError('');
    const result = await onSave(message.id, body);
    setBusy(false);
    if (result === true) setEditing(false);
    else setError(result);
    return undefined;
  };

  const remove = async () => {
    setBusy(true);
    const result = await onDelete(message.id);
    if (result !== true) {
      setBusy(false);
      setConfirming(false);
      setError(result);
    }
  };

  return (
    <li className="group flex gap-3">
      <PixelAvatar seed={message.name} size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{message.name}</span>
          {message.mine && <span className="chip px-1.5 py-0 text-[10px]">you</span>}
          <DeviceIcon device={message.device} />
          <time dateTime={message.createdAt} title={absoluteTime(message.createdAt)} className="label text-[11px]">
            {relativeTime(message.createdAt, now)}
          </time>
          {message.editedAt && <span className="label text-[11px]">(edited)</span>}
        </p>

        {editing ? (
          <div className="mt-1.5">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault(); // keep the overlay open
                  setEditing(false);
                  setDraft(message.body);
                  setError('');
                } else if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  save();
                }
              }}
              rows={2}
              aria-label="Edit message"
              autoFocus
              className="input resize-none"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" onClick={save} disabled={busy} className="btn-solid px-3 py-1 text-xs">
                save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.body);
                  setError('');
                }}
                className="btn px-3 py-1 text-xs"
              >
                cancel
              </button>
              <span className="label ml-auto tabular-nums">{MAX_BODY - charCount(draft)}</span>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-g-800">{message.body}</p>
        )}

        {message.mine && !editing && (
          <div className="mt-1 flex items-center gap-3 text-[11px] opacity-100 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
            {confirming ? (
              <>
                <span className="text-g-600">delete this message?</span>
                <button type="button" onClick={remove} disabled={busy} className="font-medium text-danger hover:underline">
                  yes, delete
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-g-500 hover:text-ink">
                  keep
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.body);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1 text-g-500 hover:text-ink"
                >
                  <FiEdit2 aria-hidden size={10} /> edit
                </button>
                <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 text-g-500 hover:text-ink">
                  <FiTrash2 aria-hidden size={10} /> delete
                </button>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function NamePrompt({ initial, error, onSubmit }) {
  const [value, setValue] = useState(initial || '');
  const [localError, setLocalError] = useState('');
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim();
        if (charCount(name) < 1 || charCount(name) > MAX_NAME) {
          setLocalError(ERRORS.bad_name);
          return;
        }
        onSubmit(name);
      }}
    >
      <label htmlFor="chat-name" className="text-sm text-g-600 sm:shrink-0">
        Pick a display name
      </label>
      <input
        id="chat-name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={MAX_NAME}
        autoComplete="nickname"
        placeholder="e.g. night owl"
        className="input sm:flex-1"
        data-autofocus
      />
      <button type="submit" className="btn-solid px-4 py-2 text-sm">
        join chat
      </button>
      {(localError || error) && (
        <p className="text-xs text-danger sm:basis-full" role="alert">
          {localError || error}
        </p>
      )}
    </form>
  );
}

function Offline({ profile, onRetry }) {
  const first = profile.name.split(' ')[0].toLowerCase();
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div aria-hidden="true" className="ht-wide mask-circle absolute inset-0" />
      <p className="label relative">status</p>
      <h3 className="relative mt-2 text-xl font-semibold tracking-tight">chat is offline</h3>
      <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-g-500">
        The community chat server isn’t reachable right now. You can still say hello by email.
      </p>
      <div className="relative mt-6 flex flex-wrap justify-center gap-2">
        <a href={`mailto:${profile.email}`} className="btn-solid px-4 py-2">
          email {first} <span aria-hidden="true">↗</span>
        </a>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn px-4 py-2">
            try again
          </button>
        )}
      </div>
    </div>
  );
}

function ChatRoom({ onOffline, tab }) {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [feed, setFeed] = useState('loading'); // loading | ready
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState(() => readStore(NAME_KEY) || '');
  const [nameConfirmed, setNameConfirmed] = useState(() => Boolean(readStore(NAME_KEY)));
  const [nameError, setNameError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const lastId = useRef(0);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);
  const composerRef = useRef(null);

  const apply = useCallback((incoming, full) => {
    setMessages((prev) => {
      const next = mergeMessages(prev, incoming, full);
      lastId.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
  }, []);

  // initial load + polling with ?after=<lastId> while open and the tab is visible
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let polls = 0;
    let failures = 0;
    let loaded = false;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === 'visible' || !loaded) {
        const full = polls % FULL_REFRESH_EVERY === 0;
        polls += 1;
        try {
          const data = await getChat(full ? undefined : lastId.current || undefined);
          if (!alive) return;
          failures = 0;
          loaded = true;
          setStale(false);
          apply(Array.isArray(data && data.messages) ? data.messages : [], full);
          if (data && Number.isFinite(data.total)) setTotal(data.total);
          setFeed('ready');
        } catch {
          if (!alive) return;
          failures += 1;
          if (!loaded) {
            onOffline();
            return;
          }
          if (failures >= 2) setStale(true);
        }
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [apply, onOffline]);

  // who am I? (server remembers the last name used by this X-Client-Id)
  useEffect(() => {
    let alive = true;
    getChatIdentity()
      .then((data) => {
        if (!alive || !data || !data.name) return;
        setName(data.name);
        setNameConfirmed(true);
        writeStore(NAME_KEY, data.name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // relative times + cooldown countdown
  const cooling = cooldownUntil > now;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), cooling ? 1000 : 30000);
    return () => window.clearInterval(id);
  }, [cooling]);

  // keep pinned to the newest message unless the reader scrolled up
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, tab]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return setError(ERRORS.empty);
    if (charCount(body) > MAX_BODY) return setError(ERRORS.too_long);
    if (cooldownLeft > 0 || sending) return undefined;
    setSending(true);
    setError('');
    try {
      const data = await postChat(name, body);
      if (data && data.message) apply([data.message], false);
      setDraft('');
      stickToBottom.current = true;
      setCooldownUntil(Date.now() + COOLDOWN_S * 1000);
      setNow(Date.now());
      writeStore(NAME_KEY, name);
      play('chime');
    } catch (err) {
      play('error');
      if (err.code === 'cooldown') {
        const wait = Number(err.data && err.data.retryAfter) || COOLDOWN_S;
        setCooldownUntil(Date.now() + wait * 1000);
        setNow(Date.now());
      }
      if (err.code === 'bad_name') {
        setNameConfirmed(false);
        setNameError(ERRORS.bad_name);
      } else {
        setError(errorText(err));
      }
    } finally {
      setSending(false);
      if (composerRef.current) composerRef.current.focus({ preventScroll: true });
    }
    return undefined;
  };

  const saveEdit = async (id, body) => {
    try {
      const data = await patchChat(id, body);
      if (data && data.message) apply([data.message], false);
      return true;
    } catch (err) {
      if (err.code === 'not_found') setMessages((prev) => prev.filter((m) => m.id !== id));
      return errorText(err);
    }
  };

  const remove = async (id) => {
    try {
      await deleteChat(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      play('tick');
      return true;
    } catch (err) {
      if (err.code === 'not_found') {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        return true;
      }
      return errorText(err);
    }
  };

  const npcs = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (let i = messages.length - 1; i >= 0 && list.length < 8; i -= 1) {
      const m = messages[i];
      const key = m.name.toLowerCase();
      if (!m.mine && key !== name.toLowerCase() && !seen.has(key)) {
        seen.add(key);
        list.push(m.name);
      }
    }
    return list;
  }, [messages, name]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {tab === 'room' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <Suspense fallback={<p className="label">loading room…</p>}>
            <PixelRoom me={nameConfirmed && name ? name : 'you'} npcs={npcs} />
          </Suspense>
        </div>
      ) : (
        <ol
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label="Chat messages"
          aria-busy={feed === 'loading'}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {feed === 'loading' &&
            [0, 1, 2].map((i) => (
              <li key={i} className="skeleton flex gap-3" aria-hidden="true">
                <span className="h-7 w-7 rounded-md bg-g-100" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-28 rounded bg-g-100" />
                  <span className="block h-3 w-3/4 rounded bg-g-100" />
                </span>
              </li>
            ))}
          {feed === 'ready' && messages.length === 0 && (
            <li className="py-10 text-center text-sm text-g-500">No messages yet — say the first hello.</li>
          )}
          {messages.map((m) => (
            <Message key={m.id} message={m} now={now} onSave={saveEdit} onDelete={remove} />
          ))}
        </ol>
      )}

      <div className="border-t border-g-200 px-4 py-3 sm:px-6">
        {stale && (
          <p className="label mb-2" role="status">
            reconnecting…
          </p>
        )}
        {!nameConfirmed ? (
          <NamePrompt
            initial={name}
            error={nameError}
            onSubmit={(value) => {
              setName(value);
              setNameConfirmed(true);
              setNameError('');
              writeStore(NAME_KEY, value);
              window.setTimeout(() => composerRef.current && composerRef.current.focus(), 0);
            }}
          />
        ) : (
          <form onSubmit={send}>
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                data-autofocus
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
                }}
                rows={1}
                aria-label="Message"
                placeholder="Write a message…"
                className="input max-h-32 min-h-[2.5rem] resize-none"
              />
              <button
                type="submit"
                disabled={sending || cooldownLeft > 0 || !draft.trim()}
                className="btn-solid h-10 min-w-[4.5rem] shrink-0 px-3 tabular-nums"
                aria-label={cooldownLeft > 0 ? `Wait ${cooldownLeft} seconds` : 'Send message'}
              >
                {cooldownLeft > 0 ? `${cooldownLeft}s` : <FiSend aria-hidden size={14} />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="label truncate">
                posting as <span className="text-ink">{name}</span> ·{' '}
                <button type="button" className="underline-offset-2 hover:text-ink hover:underline" onClick={() => setNameConfirmed(false)}>
                  change
                </button>
                {total > 0 && (
                  <span className="hidden sm:inline">
                    {' '}
                    · {total} {total === 1 ? 'message' : 'messages'}
                  </span>
                )}
              </p>
              <span className={`label tabular-nums ${MAX_BODY - charCount(draft) < 20 ? 'text-danger' : ''}`}>
                {MAX_BODY - charCount(draft)}
              </span>
            </div>
            <p className="mt-1 text-xs text-danger" role="alert">
              {error}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ChatOverlay({ profile, presence, onClose }) {
  const [attempt, setAttempt] = useState(0);
  const health = useHealth(attempt);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('messages');
  const onOffline = useCallback(() => setFailed(true), []);

  const offline = !hasApi() || failed || (health.status === 'ready' && (!health.ok || health.features.chat === false));
  const retry = hasApi()
    ? () => {
        resetHealthCache();
        setFailed(false);
        setAttempt((n) => n + 1);
      }
    : null;

  return (
    <Overlay onClose={onClose} labelledBy="chat-title" variant="window" panelClassName="sm:max-w-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-g-200 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <h2 id="chat-title" className="font-mono text-[13px] text-g-500">
            <span className="text-ink">community chat</span>
          </h2>
          {!offline && presence && presence.count > 0 && (
            <span className="label flex items-center gap-1.5">
              <span className="live-dot" aria-hidden="true" /> {presence.count} here
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!offline && health.status === 'ready' && (
            <div role="group" aria-label="View" className="flex rounded-full border border-g-200 p-0.5">
              {['messages', 'room'].map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                  className="rounded-full px-2.5 py-0.5 font-mono text-[11px] text-g-500 hover:text-ink aria-pressed:bg-g-100 aria-pressed:text-ink"
                >
                  {id}
                </button>
              ))}
            </div>
          )}
          <CloseButton onClick={onClose} />
        </div>
      </header>

      {offline ? (
        <Offline profile={profile} onRetry={retry} />
      ) : health.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center py-16" role="status">
          <span className="loader-dots inline-flex text-g-500">
            <span />
            <span />
            <span />
          </span>
          <span className="sr-only">Connecting to chat…</span>
        </div>
      ) : (
        <ChatRoom key={attempt} onOffline={onOffline} tab={tab} />
      )}
    </Overlay>
  );
}
