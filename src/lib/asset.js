// Resolve a path relative to /public (e.g. "images/profile.webp") against PUBLIC_URL,
// so assets work both on localhost and under /AliAWebsite on GitHub Pages.
export function asset(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('mailto:')) return path;
  return `${process.env.PUBLIC_URL || ''}/${path.replace(/^\/+/, '')}`;
}
