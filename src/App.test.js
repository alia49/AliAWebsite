import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App, { buildSections } from './App';
import profile from './content/profile.json';
import { deckPosition } from './components/ProjectDeck';
import { buildWeeks } from './components/GithubGraph';
import { mergeMessages } from './features/chat/ChatOverlay';
import { computeStats, verdict } from './features/typing/TypingTest';

const SAMPLE_CONTRIBUTIONS = {
  total: { lastYear: 25 },
  contributions: [
    { date: '2025-09-21', count: 0, level: 0 },
    { date: '2025-09-22', count: 4, level: 3 },
    { date: '2025-09-23', count: 21, level: 4 },
  ],
};

beforeEach(() => {
  delete process.env.REACT_APP_API_URL;
  window.localStorage.clear();
  document.documentElement.className = '';
  // default: GitHub graph request never settles (no network in tests)
  global.fetch = jest.fn(() => new Promise(() => {}));
});

afterEach(() => {
  delete global.fetch;
});

test('renders the owner name as the page heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Ali Altimimi' })).toBeInTheDocument();
  expect(screen.getByText(/B\.S\. in Computer Science from SJSU/)).toBeInTheDocument();
});

test('empty optional sections are hidden and numbering has no gaps', () => {
  render(<App />);
  for (const hidden of [/— certifications/, /— recommendations/, /— affiliations/, /— blog/]) {
    expect(screen.queryByRole('heading', { name: hidden })).not.toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: '01 — projects' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '02 — experience' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '03 — github' })).toBeInTheDocument();
});

test('an optional section appears once it has content', () => {
  const withCert = {
    ...profile,
    certifications: [{ title: 'Example Cert', issuer: 'Example Org', url: '', logo: '' }],
  };
  render(<App profile={withCert} />);
  expect(screen.getByRole('heading', { name: '03 — certifications' })).toBeInTheDocument();
  expect(screen.getByText('Example Cert')).toBeInTheDocument();
  expect(buildSections(withCert).map((s) => s.id)).toEqual(['projects', 'experience', 'certifications', 'github']);
});

test('clicking a side card in the deck brings it to the centre', () => {
  render(<App />);
  const slugs = profile.projects.map((p) => p.slug);
  const n = slugs.length;
  const card = (i) => screen.getByTestId(`deck-card-${slugs[((i % n) + n) % n]}`);
  expect(card(0)).toHaveAttribute('data-pos', 'center');
  expect(card(1)).toHaveAttribute('data-pos', 'right');
  expect(card(-1)).toHaveAttribute('data-pos', 'left');
  if (n > 3) expect(card(2)).toHaveAttribute('data-pos', 'hidden');

  fireEvent.click(screen.getByRole('button', { name: `Show project: ${profile.projects[1].title}` }));
  expect(card(1)).toHaveAttribute('data-pos', 'center');
  expect(card(0)).toHaveAttribute('data-pos', 'left');
  expect(card(2)).toHaveAttribute('data-pos', 'right');

  // arrow keys rotate through every project
  fireEvent.keyDown(screen.getByRole('button', { name: 'Next project' }), { key: 'ArrowRight' });
  expect(card(2)).toHaveAttribute('data-pos', 'center');
});

test('deck positions wrap around', () => {
  expect(deckPosition(0, 0, 4)).toBe('center');
  expect(deckPosition(3, 0, 4)).toBe('left');
  expect(deckPosition(1, 0, 4)).toBe('right');
  expect(deckPosition(2, 0, 4)).toBe('hidden');
  expect(deckPosition(1, 0, 2)).toBe('right');
});

test('project details show bullets and stack', async () => {
  const first = profile.projects[0];
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`details about ${first.title}`, 'i') }));
  const dialog = await screen.findByRole('dialog', { name: first.title });
  expect(within(dialog).getByText(first.bullets[0])).toBeInTheDocument();
  expect(within(dialog).getByText(first.stack[first.stack.length - 1])).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('theme switch toggles html.dark and remembers the choice', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
  expect(document.documentElement).toHaveClass('dark');
  expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.localStorage.getItem('theme')).toBe('dark');

  fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
  expect(document.documentElement).not.toHaveClass('dark');
  expect(window.localStorage.getItem('theme')).toBe('light');
});

test('chat shows the offline state when no API URL is configured', async () => {
  render(<App />);
  expect(screen.queryByText(/viewing now/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /community chat/i }));
  const dialog = await screen.findByRole('dialog', { name: /community chat/i });
  expect(within(dialog).getByText(/chat is offline/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: /email ali/i })).toHaveAttribute(
    'href',
    `mailto:${profile.email}`
  );
});

test('Ctrl+K opens Ask, which falls back to email without a backend', async () => {
  render(<App />);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const dialog = await screen.findByRole('dialog', { name: /ask me anything about ali/i });
  expect(within(dialog).getByText(/answerer is offline/i)).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: /email ali/i })).toHaveAttribute(
    'href',
    expect.stringContaining(`mailto:${profile.email}`)
  );
});

test('say hello copies the email address', async () => {
  const writeText = jest.fn(() => Promise.resolve());
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: 'say hello' })[0]);
  const dialog = await screen.findByRole('dialog', { name: /let’s talk/i });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: /copy email/i }));
  });
  expect(writeText).toHaveBeenCalledWith(profile.email);
  expect(within(dialog).getByText('Copied to your clipboard.')).toBeInTheDocument();
});

test('GitHub graph renders the yearly total', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_CONTRIBUTIONS) }));
  render(<App />);
  expect(await screen.findByText('25 contributions in the last year')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/v4/alia49?y=last'),
    expect.objectContaining({ signal: expect.anything() })
  );
});

test('GitHub graph falls back to a link when the request fails', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
  render(<App />);
  expect(await screen.findByText(/couldn’t be loaded/i)).toBeInTheDocument();
});

test('contribution days are grouped into Sunday-first weeks', () => {
  const weeks = buildWeeks(SAMPLE_CONTRIBUTIONS.contributions);
  expect(weeks).toHaveLength(1);
  expect(weeks[0][0].count).toBe(0); // 2025-09-21 is a Sunday
  expect(weeks[0][2].level).toBe(4);
});

test('chat merge appends new messages and reconciles deletes on a full refresh', () => {
  const m = (id, body = `m${id}`) => ({ id, name: 'a', body, device: 'desktop', createdAt: '', editedAt: null, mine: false });
  const first = mergeMessages([], [m(1), m(2), m(3)], true);
  const polled = mergeMessages(first, [m(4)], false);
  expect(polled.map((x) => x.id)).toEqual([1, 2, 3, 4]);
  const refreshed = mergeMessages(polled, [m(2, 'edited'), m(4)], true);
  expect(refreshed.map((x) => x.id)).toEqual([1, 2, 4]);
  expect(refreshed[1].body).toBe('edited');
});

test('typing stats count only correct words toward WPM', () => {
  const state = {
    duration: 30,
    words: ['hello', 'world', 'again'],
    typed: ['hello', 'wrld'],
    input: '',
    startedAt: 1000,
    correctKeys: 9,
    wrongKeys: 1,
  };
  const stats = computeStats(state, 1000 + 12000); // 12 s → 0.2 min
  expect(stats.wpm).toBe(6); // "hello " = 6 chars → 1.2 words / 0.2 min
  expect(stats.accuracy).toBe(90);
  expect(stats.correctWords).toBe(1);
  expect(verdict(stats.wpm, stats.accuracy)).toMatch(/warm-up/i);
});
