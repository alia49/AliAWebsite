import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import defaultProfile from './content/profile.json';
import { ActionsContext } from './lib/actions';
import { asset } from './lib/asset';
import { prefersReducedMotion } from './lib/media';
import Experience from './components/Experience';
import Footer, { ContactCta } from './components/Footer';
import GithubGraph from './components/GithubGraph';
import HelloModal from './components/HelloModal';
import Hero, { Highlights, Stats } from './components/Hero';
import MobileNav, { MobileHeader } from './components/MobileNav';
import ProjectDeck from './components/ProjectDeck';
import ProjectDetail from './components/ProjectDetail';
import Section, { SectionLink } from './components/Section';
import Sidebar from './components/Sidebar';
import { Affiliations, Certifications, Posts, Recommendations } from './components/Collections';
import { usePresence } from './features/chat/usePresence';
import { installSoundUnlock, play } from './features/sounds/sounds';

// Overlays are code-split: they load on first open.
const AskOverlay = lazy(() => import('./features/ask/AskOverlay'));
const TypingTest = lazy(() => import('./features/typing/TypingTest'));
const ChatOverlay = lazy(() => import('./features/chat/ChatOverlay'));

const has = (list) => Array.isArray(list) && list.length > 0;

/** Visible sections in page order, numbered 01, 02… (empty ones are skipped entirely). */
export function buildSections(profile) {
  const list = [];
  if (has(profile.posts)) list.push({ id: 'blog', label: 'blog' });
  if (has(profile.projects)) list.push({ id: 'projects', label: 'projects' });
  if (has(profile.experience) || has(profile.education) || has(profile.stack)) {
    list.push({ id: 'experience', label: 'experience' });
  }
  if (has(profile.certifications)) list.push({ id: 'certifications', label: 'certifications' });
  if (has(profile.recommendations)) list.push({ id: 'recommendations', label: 'recommendations' });
  if (has(profile.affiliations)) list.push({ id: 'affiliations', label: 'affiliations' });
  if (profile.githubUser) list.push({ id: 'github', label: 'github' });
  return list.map((section, i) => ({ ...section, num: String(i + 1).padStart(2, '0') }));
}

/** Highlights the sidebar link of the section crossing a band ~35–40 % down the viewport. */
function useActiveSection(ids) {
  const [active, setActive] = useState(null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof window.IntersectionObserver !== 'function') return undefined;
    const order = key.split('|');
    const visible = new Map();
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting));
        setActive(order.find((id) => visible.get(id)) || null);
      },
      { rootMargin: '-35% 0px -60% 0px' }
    );
    order.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [key]);
  return active;
}

export default function App({ profile = defaultProfile }) {
  const sections = useMemo(() => buildSections(profile), [profile]);
  const activeId = useActiveSection(sections.map((s) => s.id));
  const presence = usePresence();
  const [overlay, setOverlay] = useState(null); // { type, data }
  const first = profile.name.split(' ')[0];

  const open = useCallback((type, data = null) => {
    play('pop');
    setOverlay({ type, data });
  }, []);
  const close = useCallback(() => setOverlay(null), []);
  const actions = useMemo(() => ({ open, close }), [open, close]);

  useEffect(() => installSoundUnlock(), []);

  // ⌘K / Ctrl+K → ask, ⌘J / Ctrl+J → typing test (toggle)
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      let type = null;
      if (key === 'k') type = 'ask';
      else if (key === 'j') type = 'typing';
      if (!type) return;
      event.preventDefault();
      play('pop');
      setOverlay((current) => (current && current.type === type ? null : { type, data: null }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // mobile nav: close the sheet first, then scroll and move focus to the section heading
  const navigateTo = useCallback((event, id) => {
    event.preventDefault();
    setOverlay(null);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
      const heading = document.getElementById(`${id}-heading`);
      if (heading) heading.focus({ preventScroll: true });
    });
  }, []);

  const projects = useMemo(() => profile.projects || [], [profile.projects]);
  const openProject = useCallback((project) => open('project', projects.indexOf(project)), [open, projects]);

  const renderSection = (id) => {
    switch (id) {
      case 'blog':
        return <Posts posts={profile.posts} />;
      case 'projects':
        return (
          <>
            {profile.projectsIntro && <p className="-mt-2 mb-8 max-w-[60ch] text-[15px] leading-relaxed text-g-500">{profile.projectsIntro}</p>}
            <ProjectDeck projects={projects} onOpen={openProject} />
          </>
        );
      case 'experience':
        return (
          <Experience
            experience={profile.experience}
            education={profile.education}
            stack={profile.stack}
            focusAreas={profile.focusAreas}
          />
        );
      case 'certifications':
        return <Certifications items={profile.certifications} />;
      case 'recommendations':
        return <Recommendations items={profile.recommendations} />;
      case 'affiliations':
        return <Affiliations items={profile.affiliations} />;
      case 'github':
        return <GithubGraph user={profile.githubUser} />;
      default:
        return null;
    }
  };

  const sectionAction = (id) => {
    if (id === 'projects' && profile.githubUser) {
      return <SectionLink href={`https://github.com/${profile.githubUser}`}>all on github</SectionLink>;
    }
    if (id === 'experience' && profile.resume) {
      return (
        <a href={asset(profile.resume)} download={profile.resumeFileName || true} className="font-mono text-[11px] text-g-500 transition-colors hover:text-ink">
          full resume <span aria-hidden="true">↓</span>
        </a>
      );
    }
    if (id === 'github' && profile.githubUser) {
      return <SectionLink href={`https://github.com/${profile.githubUser}`}>@{profile.githubUser}</SectionLink>;
    }
    return null;
  };

  const type = overlay && overlay.type;
  const projectIndex = type === 'project' ? overlay.data : -1;

  return (
    <ActionsContext.Provider value={actions}>
      <a
        href="#main"
        className="sr-only-focusable fixed left-3 top-3 z-[60] rounded-full bg-ink px-4 py-2 text-sm text-bg"
      >
        Skip to content
      </a>

      <Sidebar profile={profile} sections={sections} activeId={activeId} presence={presence} />
      <MobileHeader profile={profile} navOpen={type === 'nav'} />

      <div className="overflow-x-clip lg:pl-56">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <main id="main" tabIndex={-1} className="focus:outline-none">
            <Hero profile={profile} />
            <Highlights items={profile.highlights} />
            <Stats items={profile.stats} />
            {sections.map((s) => (
              <Section key={s.id} id={s.id} num={s.num} label={s.label} action={sectionAction(s.id)}>
                {renderSection(s.id)}
              </Section>
            ))}
            <ContactCta firstName={first} />
          </main>
          <Footer profile={profile} />
        </div>
      </div>

      {type === 'hello' && <HelloModal profile={profile} onClose={close} />}
      {type === 'nav' && (
        <MobileNav
          profile={profile}
          sections={sections}
          activeId={activeId}
          presence={presence}
          onClose={close}
          onNavigate={navigateTo}
        />
      )}
      {projectIndex >= 0 && projects[projectIndex] && (
        <ProjectDetail
          project={projects[projectIndex]}
          index={projectIndex}
          count={projects.length}
          onClose={close}
          onNavigate={(delta) =>
            setOverlay({ type: 'project', data: (projectIndex + delta + projects.length) % projects.length })
          }
        />
      )}
      <Suspense fallback={null}>
        {type === 'ask' && <AskOverlay profile={profile} onClose={close} />}
        {type === 'typing' && <TypingTest onClose={close} />}
        {type === 'chat' && <ChatOverlay profile={profile} presence={presence} onClose={close} />}
      </Suspense>
    </ActionsContext.Provider>
  );
}
