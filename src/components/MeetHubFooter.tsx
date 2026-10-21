import React from 'react';
import meethubLogo from '../assets/meethub-logo.jpg';
import { MEETHUB_BRAND } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';

interface MeetHubFooterProps {
  className?: string;
  variant?: 'dark' | 'light' | 'subtle';
  showEventInfo?: boolean;
}

export const MeetHubFooter: React.FC<MeetHubFooterProps> = ({
  className = '',
  variant = 'dark',
  showEventInfo = true,
}) => {
  const { language } = useLanguage();

  const isLight = variant === 'light' || variant === 'subtle';

  return (
    <footer
      className={`w-full py-4 px-4 transition-all duration-300 ${
        isLight
          ? 'bg-transparent text-charcoal-700'
          : 'bg-charcoal-950 text-beige-200 border-t border-burgundy-900/40 shadow-inner'
      } ${className}`}
    >
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-2.5 text-center">
        {/* Optional Event Info Line */}
        {showEventInfo && (
          <p className="text-[11px] sm:text-xs opacity-75 font-arabic">
            {language === 'ar'
              ? 'حفل عقد قران ساره وعبدالله — النرجس، فندق والدورف أستوريا، الكويت 2026'
              : 'Sara & Abdullah Wedding Contract — AL NARJIS, WALDORF ASTORIA, Kuwait 2026'}
          </p>
        )}

        {/* MeetHub Branding Bar */}
        <a
          href={MEETHUB_BRAND.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-charcoal-900/90 hover:bg-black text-white border border-charcoal-700/80 hover:border-olive-500/70 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          title={`${MEETHUB_BRAND.name} — ${MEETHUB_BRAND.tagline}`}
        >
          {/* Official MeetHub Logo Image (Square aspect ratio preserved, crisp dark badge) */}
          <div className="w-6 h-6 rounded-md overflow-hidden bg-black flex-shrink-0 border border-charcoal-700/50 flex items-center justify-center">
            <img
              src={meethubLogo}
              alt="MeetHub Logo"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          </div>

          {/* Powered by Text & Brand Name */}
          <div className="flex items-center gap-1.5 text-xs font-sans">
            <span className="text-[10px] sm:text-[11px] text-beige-300/80 font-medium">
              Powered by
            </span>
            <span className="font-bold tracking-tight text-white group-hover:text-olive-300 transition-colors">
              {MEETHUB_BRAND.name}
            </span>
          </div>

          <span className="text-charcoal-600 text-[10px] hidden sm:inline">•</span>

          {/* Tagline (Desktop) */}
          <span className="text-[9px] tracking-wider text-charcoal-400 uppercase font-semibold hidden sm:inline">
            {MEETHUB_BRAND.tagline}
          </span>

          {/* Instagram Icon & Handle */}
          <span className="inline-flex items-center gap-1 text-[10px] text-olive-400 group-hover:text-olive-300 font-mono transition-colors pl-1 rtl:pr-1 rtl:pl-0 border-l rtl:border-l-0 rtl:border-r border-charcoal-700/80">
            <svg
              className="w-3 h-3 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
            <span className="hidden md:inline font-sans text-[10px]">
              {MEETHUB_BRAND.instagramHandle}
            </span>
          </span>
        </a>
      </div>
    </footer>
  );
};
