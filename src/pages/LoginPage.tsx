import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { EVENT_DETAILS } from '../utils/constants';
import {
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Calendar,
  MapPin,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { MeetHubFooter } from '../components/MeetHubFooter';

export const LoginPage: React.FC = () => {
  const { login, error, loading, isConfigured, clearError } = useAuth();
  const { t, toggleLanguage } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(!isConfigured);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLocalLoading(true);
    try {
      await login(email, password);
    } catch {
      // Error handled in AuthContext
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-arabesque-subtle flex flex-col justify-between p-4 sm:p-6 text-charcoal-800">
      {/* Top Language Toggle */}
      <div className="max-w-md w-full mx-auto flex justify-end">
        <button
          onClick={toggleLanguage}
          className="text-xs px-3.5 py-1.5 rounded-xl border border-burgundy-400/40 bg-warmwhite/90 hover:bg-white text-burgundy-900 font-semibold shadow-sm transition-all"
        >
          {t.switchLang}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto animate-fade-in">
        <div className="luxury-card rounded-3xl p-6 sm:p-8 shadow-luxury border-2 border-burgundy-500/25 bg-warmwhite/98 backdrop-blur-md">
          {/* Monogram & Title */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-burgundy-500 bg-gradient-to-br from-burgundy-900 via-burgundy-800 to-black flex items-center justify-center shadow-lg mb-3">
              <span className="font-display text-beige-200 font-bold text-xl tracking-wider">
                S&amp;A
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-olive-700 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-burgundy-600" />
              <span>{EVENT_DETAILS.titleAr}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-arabic text-burgundy-900">
              {EVENT_DETAILS.coupleNamesAr}
            </h1>

            <div className="flex items-center justify-center gap-3 text-xs text-charcoal-600 mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-olive-600" />
                29.12.2026
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-olive-600" />
                {EVENT_DETAILS.venueAr}
              </span>
            </div>

            <p className="text-xs text-charcoal-500 mt-2 font-medium">
              {t.loginSubtitle}
            </p>
          </div>

          {/* Firebase unconfigured banner */}
          {!isConfigured && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  مفتاح Firebase غير مهيأ بعد
                </span>
                <button
                  onClick={() => setShowConfigGuide(!showConfigGuide)}
                  className="underline text-[11px] text-amber-800"
                >
                  {showConfigGuide ? 'إخفاء الدليل' : 'عرض الدليل'}
                </button>
              </div>
              <p className="text-[11px] text-amber-800">
                يرجى نسخ ملف <code>.env.example</code> إلى <code>.env</code> وإضافة إعدادات مشروع Firebase.
              </p>
            </div>
          )}

          {/* Configuration Guide Accordion */}
          {showConfigGuide && (
            <div className="mb-5 p-3.5 bg-charcoal-900 text-beige-100 rounded-2xl text-xs font-mono space-y-2 border border-burgundy-500/40">
              <div className="flex items-center gap-1.5 text-beige-200 font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-olive-400" />
                <span>خطوات التهيئة السريعة:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-beige-200/90 font-sans">
                <li>أنشئ مشروعاً جديداً في Firebase Console.</li>
                <li>فعّل خدمة Firebase Authentication بالبريد وكلمة المرور.</li>
                <li>أنشئ قاعدة بيانات Cloud Firestore.</li>
                <li>املأ قيم <code>.env</code> بالمفاتيح المطلوبة.</li>
              </ol>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                <button
                  onClick={clearError}
                  className="text-[10px] text-red-600 underline mt-1 block"
                >
                  إغلاق التنبيه
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-burgundy-600" />
                  {t.emailLabel}
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@rsvp-kuwait.com"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-warmwhite border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 text-left font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-burgundy-600" />
                  {t.passwordLabel}
                </span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-warmwhite border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 text-left font-mono"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={localLoading || loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white shadow-luxury hover:shadow-luxury-hover transition-all disabled:opacity-50 mt-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {localLoading || loading ? t.signingIn : t.signInBtn}
              </span>
            </button>
          </form>

          {/* Footer Notice */}
          <div className="mt-6 pt-4 border-t border-beige-200 text-center">
            <p className="text-[11px] text-charcoal-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
              <span>{t.adminOnlyNotice}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <MeetHubFooter variant="subtle" />
    </div>
  );
};
