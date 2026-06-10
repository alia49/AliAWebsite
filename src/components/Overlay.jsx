import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { isJsdom } from '../lib/media';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'canvas[tabindex]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(node) {
  const testEnv = isJsdom();
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    (el) =>
      !el.closest('[inert]') &&
      !el.closest('[hidden]') &&
      el.getAttribute('tabindex') !== '-1' &&
      (testEnv || el.getClientRects().length > 0)
  );
}

const VARIANTS = {
  // centred card, anchored near the top (command-palette feel)
  panel: {
    wrap: 'items-start justify-center px-3 pb-6 pt-[8vh] sm:px-4 sm:pt-[11vh]',
    panel: 'w-full rounded-2xl border border-g-200 bg-bg shadow-deep',
  },
  // big app-like window; full screen on phones
  window: {
    wrap: 'items-stretch justify-center sm:items-center sm:p-6',
    panel:
      'flex w-full flex-col bg-bg sm:h-[min(46rem,90vh)] sm:rounded-2xl sm:border sm:border-g-200 sm:shadow-deep',
  },
  // full-screen sheet (mobile navigation)
  full: {
    wrap: 'items-stretch justify-stretch',
    panel: 'flex h-full w-full flex-col bg-bg',
  },
};

/**
 * Accessible modal overlay rendered into <body>:
 * - role="dialog" + aria-modal, labelled via `label` or `labelledBy`
 * - focus moves inside (to [data-autofocus] or the first focusable) and is trapped
 * - Esc closes (inner handlers can call e.preventDefault() to keep it open)
 * - focus returns to the previously focused element on close
 * - the page behind is made inert and scroll-locked
 */
export default function Overlay({
  onClose,
  label,
  labelledBy,
  variant = 'panel',
  panelClassName = '',
  children,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement;
    const root = document.getElementById('root');
    const prevOverflow = document.body.style.overflow;

    if (root) {
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = 'hidden';

    const target = panel.querySelector('[data-autofocus]') || focusables(panel)[0] || panel;
    target.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (root) {
        root.removeAttribute('inert');
        root.removeAttribute('aria-hidden');
      }
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  const styles = VARIANTS[variant] || VARIANTS.panel;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex overflow-y-auto ${styles.wrap}`}>
      <div
        aria-hidden="true"
        className="overlay-backdrop fixed inset-0 bg-bg/60 backdrop-blur-[6px] dark:bg-bg/70"
        onClick={() => onCloseRef.current && onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`overlay-panel relative focus:outline-none ${styles.panel} ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function CloseButton({ onClick, label = 'Close', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-g-500 transition-colors hover:bg-g-100 hover:text-ink ${className}`}
    >
      <FiX aria-hidden size={16} />
    </button>
  );
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}
