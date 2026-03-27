import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#fb7185' }}>
          <path d="M12 2a7 7 0 0 1 7 7c0 2.3-1.3 4.5-3.5 5.8l-1 0.6c-0.3 0.2-0.5 0.5-0.5 0.9v0.7M12 2a7 7 0 0 0-7 7c0 2.3 1.3 4.5 3.5 5.8l1 0.6c0.3 0.2 0.5 0.5 0.5 0.9v0.7" />
          <path d="M12 17l-1 2 2 2-2 1" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 800, letterSpacing: '-0.02em', fontSize: '15px' }}>
          Balloon Encounters
        </span>
      </div>
    ),
  },
  links: [
    {
      text: 'Dashboard',
      url: '/',
      external: true,
    },
  ],
};
