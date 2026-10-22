import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { EVENT_DETAILS } from '../utils/constants';
import { validateToken } from '../services/firestore';
import { Calendar, MapPin, Clock, ShieldCheck, Heart } from 'lucide-react';
import { MeetHubFooter } from '../components/MeetHubFooter';

export const PublicInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [guestName, setGuestName] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
        <div className="luxury-card rounded-3xl p-6 sm:p-8 shadow-luxury border-2 border-burgundy-500/40 bg-gradient-to-b from-warmwhite via-beige-50 to-beige-100 text-center relative overflow-hidden">
          {/* Inner Ornate Frame */}
          <div className="border border-burgundy-300/60 rounded-2xl p-5 relative">
            {/* Calligraphy Bismillah */}
            <p className="font-arabic text-sm text-burgundy-900 font-bold mb-2">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>

            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-burgundy-500 to-transparent mx-auto mb-3" />

            {/* Guest Name Honor Box */}
            <div className="my-3 p-3 bg-warmwhite border border-burgundy-300/70 rounded-xl shadow-xs" dir="rtl">
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
            <div className="space-y-1.5 text-xs text-charcoal-700 font-medium my-4 bg-warmwhite/80 p-3 rounded-xl border border-beige-300/80">
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

            <div className="mt-4 pt-3 border-t border-beige-300 text-[11px] text-charcoal-500 flex items-center justify-center gap-1">
              <Heart className="w-3 h-3 text-burgundy-600 inline fill-burgundy-600" />
              <span>حضوركم يشرفنا ويسعدنا — الدعوة شخصية</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <MeetHubFooter variant="subtle" />
    </div>
  );
};
