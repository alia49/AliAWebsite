import { useEffect, useState } from 'react';

/** True once the element has come within `rootMargin` of the viewport (or immediately without IntersectionObserver). */
export function useInView(ref, rootMargin = '200px') {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current;
    if (!el || typeof window.IntersectionObserver !== 'function') {
      setSeen(true);
      return undefined;
    }
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);
  return seen;
}
