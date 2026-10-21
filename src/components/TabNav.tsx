import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LayoutDashboard, Users, QrCode } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'guests' | 'scanner';

interface TabNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  checkedInCount: number;
  totalGuests: number;
}

export const TabNav: React.FC<TabNavProps> = ({
  activeTab,
  setActiveTab,
  checkedInCount,
  totalGuests,
}) => {
  const { t } = useLanguage();

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: t.tabDashboard,
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: `${checkedInCount}/${totalGuests}`,
    },
    {
      id: 'guests',
      label: t.tabGuests,
      icon: <Users className="w-4 h-4" />,
      badge: `${totalGuests}`,
    },
    {
      id: 'scanner',
      label: t.tabScanner,
      icon: <QrCode className="w-4 h-4" />,
    },
  ];

  return (
    <div className="bg-warmwhite/95 border-b border-beige-300/80 sticky top-[73px] sm:top-[85px] z-20 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex space-x-2 sm:space-x-4 rtl:space-x-reverse" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3.5 sm:px-5 border-b-2 font-medium text-xs sm:text-sm transition-all relative ${
                  isActive
                    ? 'border-burgundy-600 text-burgundy-900 font-bold bg-burgundy-50/70'
                    : 'border-transparent text-charcoal-600 hover:text-burgundy-800 hover:border-burgundy-300'
                }`}
              >
                <span className={isActive ? 'text-burgundy-600' : 'text-olive-600'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-sans ${
                      isActive
                        ? 'bg-burgundy-600 text-white font-bold shadow-xs'
                        : 'bg-beige-200 text-charcoal-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {tab.id === 'scanner' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
