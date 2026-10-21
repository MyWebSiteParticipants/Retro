import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEEDBACK_URL, GITHUB_REPO_URL, MY_WEBSITE_URL, STATEHOUSE_HOME_URL } from "../config/env";
import type { Viewer } from "../github/auth";
import type { View } from "../app/routes";

const VIEWS: { view: View; label: string }[] = [
  { view: "sessions", label: "Sessions" },
  { view: "board", label: "Board" },
  { view: "history", label: "History" },
];

interface Props {
  view: View;
  boardAvailable: boolean;
  teamRepo: string;
  viewer: Viewer | null;
  onView: (v: View) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onSignOut: () => void;
}

/**
 * Hamburger accordion menu (left of the title), same pattern as the rest of
 * the fleet. Sections: View, Tools, Status, Links. Section headers collapse;
 * the collapsed set persists while the app is open. Opens on click; closes
 * on outside click / Escape.
 */
export function MainMenu({ view, boardAvailable, teamRepo, viewer, onView, onOpenSettings, onOpenHelp, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["Links"]));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleSection = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const Section = ({ title, children }: { title: string; children: ReactNode }) => {
    const isOpen = !collapsed.has(title);
    return (
      <>
        <button type="button" className="menu-section-label menu-section-toggle" aria-expanded={isOpen} onClick={() => toggleSection(title)}>
          <span>{title}</span>
          <span className="menu-chevron" aria-hidden="true">
            {isOpen ? "▾" : "▸"}
          </span>
        </button>
        {isOpen && children}
      </>
    );
  };

  const link = (label: string, href: string) => (
    <a role="menuitem" className="menu-item menu-link" href={href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
      {label} &#8599;
    </a>
  );

  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div id="main-menu" ref={ref}>
      <button id="main-menu-btn" type="button" aria-label="Menu" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="menu-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <div id="main-menu-dropdown" role="menu">
          <Section title="View">
            {VIEWS.map((v) => (
              <button
                key={v.view}
                type="button"
                role="menuitemradio"
                aria-checked={view === v.view}
                disabled={v.view === "board" && !boardAvailable}
                className={`menu-item${view === v.view ? " active" : ""}`}
                onClick={pick(() => onView(v.view))}
              >
                {v.label}
              </button>
            ))}
          </Section>

          <Section title="Tools">
            <button type="button" role="menuitem" className="menu-item" onClick={pick(onOpenHelp)}>
              Help &amp; how a retro runs
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={pick(onOpenSettings)}>
              Settings · team &amp; sign-in
            </button>
            {viewer && (
              <button type="button" role="menuitem" className="menu-item danger" onClick={pick(onSignOut)}>
                Sign out of GitHub
              </button>
            )}
          </Section>

          <Section title="Status">
            <div className="menu-info">{viewer ? `Signed in as ${viewer.login}` : "Not signed in"}</div>
            <div className="menu-info">Team: {teamRepo}</div>
            <div className="menu-info">Store: GitHub Discussions · votes: 👍 reactions</div>
          </Section>

          <Section title="Links">
            {link("Report feedback", FEEDBACK_URL)}
            {link("Team repository", `https://github.com/${teamRepo}`)}
            {link("Team discussions", `https://github.com/${teamRepo}/discussions`)}
            {link("GitHub Actions", `${GITHUB_REPO_URL}/actions`)}
            {link("Retro repository", GITHUB_REPO_URL)}
            {link("MyWebSite", MY_WEBSITE_URL)}
            {link("Statehouse Home", STATEHOUSE_HOME_URL)}
          </Section>
        </div>
      )}
    </div>
  );
}
