"use client";

import { useI18n } from "@/i18n";

const LINK_KEYS = [
  { key: "about", href: "/about", external: true },
  { key: "docs", href: "/docs", external: true },
  { key: "github", href: "https://github.com/AmazingAng/balloon-encounters", external: true },
  { key: "x", href: "https://x.com/balloon_maps", external: true },
];

export default function Footer() {
  const { t } = useI18n();

  const linkLabels: Record<string, string> = {
    about: t("footer.about"),
    docs: t("footer.docs"),
    github: t("footer.github"),
    x: "X",
  };

  return (
    <footer className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--surface)] font-mono text-[12px] text-[var(--text-dim)] shrink-0">
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400 shrink-0" aria-hidden="true">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.3-1.3 4.5-3.5 5.8l-1 0.6c-0.3 0.2-0.5 0.5-0.5 0.9v0.7M12 2a7 7 0 0 0-7 7c0 2.3 1.3 4.5 3.5 5.8l1 0.6c0.3 0.2 0.5 0.5 0.5 0.9v0.7" />
          <path d="M12 17l-1 2 2 2-2 1" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, letterSpacing: '-0.02em' }} className="text-[13px] text-[var(--text-secondary)]">Balloon Encounters</span>
      </div>
      <div className="flex items-center gap-5">
        {LINK_KEYS.map(({ key, href, external }) => (
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="hover:text-[var(--accent)] transition-colors"
          >
            {linkLabels[key]}
          </a>
        ))}
      </div>
    </footer>
  );
}
