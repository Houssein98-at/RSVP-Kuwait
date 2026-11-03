import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { EVENT_DETAILS } from '../utils/constants';
import { validateToken } from '../services/firestore';
import { Calendar, MapPin, Clock, ShieldCheck, Heart } from 'lucide-react';
import { MeetHubFooter } from '../components/MeetHubFooter';
import { QrCardBackground, QURAN_VERSE_TEXT } from '../components/QrCardBackground';
import { getEventCountdown, buildGoogleCalendarUrl } from '../utils/helpers';

export const PublicInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [guestName, setGuestName] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(getEventCountdown());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getEventCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Generate QR Code data URL representing the exact URL
    const currentUrl = window.location.href;
    QRCode.toDataURL(currentUrl, {
      width: 400,
      margin: 1,
      color: {
        dark: '#252522',
        light: '#FAF8F4',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR render error:', err);
      });

    // Lookup guest details safely without exposing private notes or check-in mutations
    validateToken(token)
      .then((res) => {
        if (res.guest) {
          setGuestName(res.guest.guestName);
        }
        if (res.status === 'REVOKED') {
          setStatusMessage('تم إلغاء هذه الدعوة رسمياً من قبل الإدارة.');
        }
      })
      .catch((err) => {
        console.warn('Invitation lookup error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-arabesque-subtle flex flex-col justify-between p-4 sm:p-6 text-charcoal-800">
      {/* Top Bar with Admin Portal Link */}
      <div className="max-w-md w-full mx-auto flex justify-between items-center text-xs text-charcoal-600">
        <span className="font-semibold text-burgundy-800">
          {EVENT_DETAILS.titleAr}
        </span>
        <Link
          to="/"
          className="text-burgundy-700 hover:text-burgundy-900 underline text-[11px] font-medium"
        >
          بوابة الإدارة
        </Link>
      </div>

      {/* Luxury Digital Pass */}
      <div className="max-w-md w-full mx-auto my-auto animate-fade-in">
        <QrCardBackground
          className="luxury-card rounded-3xl p-6 sm:p-8 border-2 border-burgundy-500/40"
          innerClassName="border border-burgundy-300/60 rounded-2xl p-5"
        >
          {/* Quran Verse Calligraphy Header */}
          <p className="font-arabic text-xs sm:text-sm text-burgundy-900 font-bold leading-relaxed mb-2 px-1" dir="rtl">
            {QURAN_VERSE_TEXT}
          </p>

          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-burgundy-500 to-transparent mx-auto mb-3" />

          {/* Guest Name Honor Box */}
          <div className="my-3 p-3 border border-burgundy-300/70 rounded-xl" dir="rtl">
            <span className="text-[12px] text-olive-800 block font-medium">
              نتشرّف بدعوة الكريمة:
            </span>
            <span className="text-xl font-bold font-arabic text-burgundy-900 block mt-1">
              {loading ? '...' : guestName || 'الكريمة'}
            </span>
          </div>

          <span className="text-xs text-olive-700 font-semibold block mt-3">
            لحضور حفل عقد قران:
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold font-arabic text-burgundy-950 mt-1 mb-2">
            {EVENT_DETAILS.coupleNamesAr}
          </h1>

          {/* Event Time & Location Details */}
          <div className="space-y-1.5 text-xs text-charcoal-700 font-medium my-4 p-3 rounded-xl border border-burgundy-300/60">
            <div className="flex items-center justify-center gap-1.5 font-bold text-charcoal-900">
              <Calendar className="w-3.5 h-3.5 text-olive-600" />
              <span>{EVENT_DETAILS.dateFormattedAr}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-burgundy-800 font-semibold">
              <Clock className="w-3.5 h-3.5 text-olive-600" />
              <span>الساعة {EVENT_DETAILS.timeFormattedAr}</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-charcoal-600 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-olive-600" />
              <span>{EVENT_DETAILS.venueAr} — {EVENT_DETAILS.hotelAr}، الكويت</span>
            </div>
          </div>

          {/* Event Countdown Timer (Target: 29 December 2026 at 7:00 PM Kuwait Time) */}
          <div
            className="my-3 py-2 px-3 border border-burgundy-300/60 rounded-xl text-center"
            data-testid="event-countdown-timer"
          >
            <span className="text-[11px] text-olive-800 font-semibold block mb-1">
              العد التنازلي لموعد الحفل:
            </span>
            <div className="flex justify-center items-center gap-1.5 text-xs font-mono font-bold text-burgundy-900" dir="ltr">
              <span className="px-1.5 py-0.5 rounded border border-burgundy-300/60">
                {countdown.days} <span className="text-[10px] text-charcoal-600 font-sans">يوم</span>
              </span>
              <span>:</span>
              <span className="px-1.5 py-0.5 rounded border border-burgundy-300/60">
                {String(countdown.hours).padStart(2, '0')} <span className="text-[10px] text-charcoal-600 font-sans">س</span>
              </span>
              <span>:</span>
              <span className="px-1.5 py-0.5 rounded border border-burgundy-300/60">
                {String(countdown.minutes).padStart(2, '0')} <span className="text-[10px] text-charcoal-600 font-sans">د</span>
              </span>
              <span>:</span>
              <span className="px-1.5 py-0.5 rounded border border-burgundy-300/60">
                {String(countdown.seconds).padStart(2, '0')} <span className="text-[10px] text-charcoal-600 font-sans">ث</span>
              </span>
            </div>
          </div>

          {/* Calendar Integration */}
          <div className="my-2.5 flex justify-center">
            <a
              href={buildGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-burgundy-800 hover:text-burgundy-950 font-semibold py-1 px-3 rounded-xl border border-burgundy-300/80 hover:bg-warmwhite/30 transition-colors"
              title="إضافة موعد الحفل إلى تقويم Google"
            >
              <Calendar className="w-3.5 h-3.5 text-olive-600" />
              <span>إضافة إلى التقويم (Google Calendar)</span>
            </a>
          </div>

          {/* QR Pass */}
          <div className="my-4 flex flex-col items-center">
            {qrDataUrl ? (
              <div className="p-3 bg-warmwhite border-2 border-burgundy-500/40 rounded-2xl shadow-md">
                <img src={qrDataUrl} alt="Invitation QR" className="w-48 h-48 object-contain" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-beige-200 rounded-2xl flex items-center justify-center text-xs text-charcoal-500">
                جاري تحميل الرمز...
              </div>
            )}

            <p className="text-xs font-bold text-burgundy-800 mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-olive-600 inline" />
              <span>يرجى إبراز هذا الرمز عند مدخل القاعة</span>
            </p>

            <span className="text-[10px] text-charcoal-400 font-mono mt-1">
              {token}
            </span>
          </div>

          {statusMessage && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">
              {statusMessage}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-beige-300 text-[11px] text-charcoal-600 flex items-center justify-center gap-1">
            <Heart className="w-3 h-3 text-burgundy-600 inline fill-burgundy-600" />
            <span>حضوركم يشرفنا ويسعدنا — الدعوة شخصية</span>
          </div>
        </QrCardBackground>
      </div>

      {/* Footer */}
      <MeetHubFooter variant="subtle" />
    </div>
  );
};
