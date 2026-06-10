import { useEffect, useRef, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { copyText } from '../lib/clipboard';
import { play } from '../features/sounds/sounds';
import Overlay, { CloseButton } from './Overlay';

export default function HelloModal({ profile, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed
  const timer = useRef(0);
  const emailRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(profile.email);
    window.clearTimeout(timer.current);
    if (ok) {
      play('chime');
      setStatus('copied');
    } else {
      play('error');
      setStatus('failed');
      // select the address so it can be copied by hand
      const range = document.createRange();
      if (emailRef.current) {
        range.selectNodeContents(emailRef.current);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    timer.current = window.setTimeout(() => setStatus('idle'), 1800);
  };

  return (
    <Overlay onClose={onClose} labelledBy="hello-title" panelClassName="max-w-md overflow-hidden">
      <div className="relative p-6 sm:p-7">
        <div aria-hidden="true" className="ht-dense mask-tr absolute right-0 top-0 h-40 w-56" />
        <CloseButton onClick={onClose} className="absolute right-3 top-3" />
        <p className="label relative">say hello</p>
        <h2 id="hello-title" className="relative mt-2 text-2xl font-semibold tracking-tight">
          Let’s talk.
        </h2>
        {profile.contactIntro && (
          <p className="relative mt-3 text-sm leading-relaxed text-g-600">{profile.contactIntro}</p>
        )}

        <div className="relative mt-6 flex items-center gap-2 rounded-xl border border-g-200 bg-g-50 p-1.5 pl-3.5">
          <span ref={emailRef} className="min-w-0 flex-1 truncate font-mono text-xs sm:text-[13px]">
            {profile.email}
          </span>
          <button
            type="button"
            onClick={copy}
            data-autofocus
            className="btn-solid min-w-[4.75rem] px-3 py-1.5 text-xs"
            aria-label={status === 'copied' ? 'Email copied' : 'Copy email address'}
          >
            {status === 'copied' ? (
              <>
                <FiCheck aria-hidden size={12} /> copied
              </>
            ) : (
              <>
                <FiCopy aria-hidden size={12} /> copy
              </>
            )}
          </button>
        </div>
        <p className="relative mt-2 h-4 font-mono text-[11px] text-g-500" aria-live="polite">
          {status === 'copied' && 'Copied to your clipboard.'}
          {status === 'failed' && 'Couldn’t copy automatically — it’s selected, press ⌘/Ctrl + C.'}
        </p>

        <ul className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li>
            <a href={`mailto:${profile.email}`} className="link">
              open mail app<span aria-hidden="true"> ↗</span>
            </a>
          </li>
          {profile.socials.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="link">
                {s.label}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Overlay>
  );
}
