import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { TabNav, type ActiveTab } from './components/TabNav';
import { DashboardPage } from './pages/DashboardPage';
import { GuestsPage } from './pages/GuestsPage';
import { ScannerPage } from './pages/ScannerPage';
import { LoginPage } from './pages/LoginPage';
import { PublicInvitationPage } from './pages/PublicInvitationPage';
import { MeetHubFooter } from './components/MeetHubFooter';
import { subscribeToGuests, subscribeToRecentArrivals } from './services/firestore';
import type { Guest } from './types';

// Admin Portal Wrapper with Real-time Firestore Subscriptions
const AdminPortal: React.FC = () => {
  const { adminUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [recentArrivals, setRecentArrivals] = useState<Guest[]>([]);

  // Subscribe to live Firestore updates when admin is authenticated
  useEffect(() => {
    if (!adminUser) return;

    const unsubGuests = subscribeToGuests((liveGuests) => {
      setGuests(liveGuests);
    });

    const unsubArrivals = subscribeToRecentArrivals((liveArrivals) => {
      setRecentArrivals(liveArrivals);
    });

    return () => {
      unsubGuests();
      unsubArrivals();
    };
  }, [adminUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-arabesque-subtle flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-burgundy-600 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-charcoal-800 font-arabic">
          جاري التحقق من صلاحيات المسؤول...
        </p>
      </div>
    );
  }

  if (!adminUser) {
    return <LoginPage />;
  }

  const checkedInCount = guests.filter((g) => g.attendanceStatus === 'CHECKED_IN').length;

  return (
    <div className="min-h-screen bg-arabesque-subtle flex flex-col selection:bg-burgundy-600/20 selection:text-burgundy-900">
      {/* Event Header */}
      <Header />

      {/* Primary 3-Tab Navigation */}
      <TabNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        checkedInCount={checkedInCount}
        totalGuests={guests.length}
      />

      {/* Tab Page Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            guests={guests}
            recentArrivals={recentArrivals}
            onNavigateToGuests={() => setActiveTab('guests')}
            onNavigateToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'guests' && (
          <GuestsPage guests={guests} />
        )}

        {activeTab === 'scanner' && (
          <ScannerPage
            guests={guests}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
          />
        )}
      </main>

      {/* Global Admin Footer */}
      <MeetHubFooter variant="dark" />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Admin App Root */}
            <Route path="/" element={<AdminPortal />} />

            {/* Public read-only QR pass reader (when opened by normal mobile camera) */}
            <Route path="/invitation/:token" element={<PublicInvitationPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
