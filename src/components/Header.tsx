import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { EVENT_DETAILS } from '../utils/constants';
import { ShieldCheck, LogOut, Globe, Calendar, MapPin } from 'lucide-react';

export const Header: React.FC = () => {
  const { adminUser, logout } = useAuth();
  const { language, t, toggleLanguage } = useLanguage();

  return (
    <header className="bg-burgundy-950 border-b border-burgundy-800/60 text-beige-50 sticky top-0 z-30 shadow-md">
      {/* Top micro bar for event date & venue */}
      <div className="bg-black/35 border-b border-burgundy-900/80 py-1.5 px-4 text-xs text-beige-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-olive-400" />
              {language === 'ar' ? EVENT_DETAILS.dateFormattedAr : EVENT_DETAILS.dateFormattedEn} • {language === 'ar' ? EVENT_DETAILS.timeFormattedAr : EVENT_DETAILS.timeFormattedEn}
            </span>
            <span className="hidden sm:inline-block text-burgundy-700">|</span>
            <span className="hidden sm:flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-olive-400" />
              {language === 'ar' 
                ? `${EVENT_DETAILS.venueAr} — ${EVENT_DETAILS.hotelAr}، الكويت`
                : `${EVENT_DETAILS.venueEn} — ${EVENT_DETAILS.hotelEn}, Kuwait`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-beige-300/80">
              {language === 'ar' ? 'السعة:' : 'Capacity:'} {EVENT_DETAILS.capacity} {language === 'ar' ? 'ضيف' : 'guests'}
            </span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg border border-burgundy-700 hover:border-beige-300 hover:text-white transition-colors bg-burgundy-900/80 text-beige-200"
              title="Change Language"
            >
              <Globe className="w-3 h-3 text-olive-400" />
              <span>{t.switchLang}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main branding & admin controls */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-burgundy-500/60 bg-gradient-to-br from-burgundy-800 via-burgundy-900 to-black flex items-center justify-center shadow-inner">
            <span className="font-display text-beige-200 font-bold text-sm sm:text-base tracking-wider">
              S&amp;A
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-arabic font-bold text-lg sm:text-xl text-beige-100 tracking-wide">
                {language === 'ar' ? EVENT_DETAILS.coupleNamesAr : EVENT_DETAILS.coupleNamesEn}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-burgundy-800/80 text-beige-200 border border-burgundy-600/60 font-medium">
                {language === 'ar' ? EVENT_DETAILS.titleAr : EVENT_DETAILS.titleEn}
              </span>
            </div>
            <p className="text-xs text-beige-300/80 hidden sm:block">
              {language === 'ar' ? 'نظام التحضير وإدارة الدعوات الخاصة' : 'Private Wedding Invitation & Entrance Management'}
            </p>
          </div>
        </div>

        {/* Admin info & logout */}
        <div className="flex items-center gap-3">
          {adminUser && (
            <div className="hidden md:flex items-center gap-2 bg-burgundy-900/70 border border-burgundy-700/60 px-3 py-1.5 rounded-xl text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-right">
                <p className="font-medium text-beige-100 leading-tight">
                  {adminUser.displayName || adminUser.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-olive-300 font-medium">{t.adminBadge}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-beige-200 hover:text-white bg-burgundy-900/80 hover:bg-burgundy-800 border border-burgundy-700 hover:border-red-400/60 transition-all shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 text-olive-300" />
            <span className="hidden sm:inline">{t.logout}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
