import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Guest, Invitation } from '../types';
import { EVENT_DETAILS, MEETHUB_BRAND, PRODUCTION_HOSTING_URL } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';
import { buildWhatsAppMessage } from '../utils/helpers';
import { Download, Share2, MessageCircle, Copy, Check, X, ShieldAlert, Sparkles, RotateCcw } from 'lucide-react';
import { ResetTestModal } from './ResetTestModal';

interface InvitationCardModalProps {
  guest: Guest;
  invitation: Invitation | null;
  onClose: () => void;
  onReissue?: (guest: Guest) => Promise<void>;
  onRevoke?: (guest: Guest) => Promise<void>;
  onResetTestInvitation?: (guest: Guest) => void;
}

// Centralized Theme Color Constants matching the Arabic عقد قران Palette
const PALETTE = {
  burgundy: '#6B2337',
  burgundyDark: '#431422',
  burgundyLight: '#832B43',
  beige: '#EDE1CF',
  beigeLight: '#F5EFE5',
  beigeDark: '#DFCBB2',
  olive: '#667044',
  oliveLight: '#78844F',
  oliveDark: '#505835',
  warmWhite: '#FAF8F4',
  charcoal: '#252522',
  charcoalMuted: '#52524C',
};

export const InvitationCardModal: React.FC<InvitationCardModalProps> = ({
  guest,
  invitation,
  onClose,
  onReissue,
  onRevoke,
  onResetTestInvitation,
}) => {
  const { t, language } = useLanguage();
  const [currentGuest, setCurrentGuest] = useState<Guest>(guest);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [isReissuing, setIsReissuing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Generate invitation public link pointing to canonical Firebase Hosting domain
  const invitationToken = currentGuest.activeToken || invitation?.token || '';
  const isLocalOrTest =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('github.io'));
  const baseOrigin = isLocalOrTest
    ? PRODUCTION_HOSTING_URL
    : (typeof window !== 'undefined' ? window.location.origin : PRODUCTION_HOSTING_URL);
  const invitationUrl = `${baseOrigin}/#/invitation/${invitationToken}`;

  // Generate QR Code data URL with Dark Charcoal on solid Warm White for 100% scannability
  useEffect(() => {
    if (!invitationToken) {
      setGenerating(false);
      return;
    }

    setGenerating(true);
    QRCode.toDataURL(invitationUrl, {
      width: 480,
      margin: 1,
      color: {
        dark: PALETTE.charcoal, // High contrast Dark Charcoal
        light: PALETTE.warmWhite, // Solid Warm White quiet zone
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation error:', err);
      })
      .finally(() => {
        setGenerating(false);
      });
  }, [invitationToken, invitationUrl]);

  // Render luxurious high-resolution 1080 x 1500 px invitation card onto Canvas
  useEffect(() => {
    if (!qrDataUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution card: 1080 x 1500 px
    canvas.width = 1080;
    canvas.height = 1500;

    // 1. Background: Warm Luxury Parchment Gradient (Warm White & Beige)
    const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1500);
    bgGradient.addColorStop(0, '#FAF8F4');
    bgGradient.addColorStop(0.3, '#EDE1CF');
    bgGradient.addColorStop(0.7, '#F5EFE5');
    bgGradient.addColorStop(1, '#EDE1CF');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1500);

    // Subtle arabesque diagonal texture lines
    ctx.save();
    ctx.strokeStyle = 'rgba(107, 35, 55, 0.025)';
    ctx.lineWidth = 1;
    for (let i = -1500; i < 2500; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 1500, 1500);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Ornate Outer Burgundy Border
    ctx.strokeStyle = PALETTE.burgundy;
    ctx.lineWidth = 7;
    ctx.strokeRect(44, 44, 992, 1412);

    // Secondary Delicate Olive Green Border
    ctx.strokeStyle = PALETTE.olive;
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 58, 964, 1384);

    // Delicate inner dotted Burgundy guideline
    ctx.save();
    ctx.strokeStyle = 'rgba(107, 35, 55, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(68, 68, 944, 1364);
    ctx.restore();

    // Helper: Draw decorative Arabesque / Floral corner flourishes
    const drawCornerFlourish = (cx: number, cy: number, flipX: number, flipY: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(flipX, flipY);

      // Central corner diamond in Burgundy
      ctx.fillStyle = PALETTE.burgundy;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();

      // Flanking olive petals
      ctx.fillStyle = PALETTE.olive;
      ctx.beginPath();
      ctx.ellipse(18, 0, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 18, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Filigree arc
      ctx.strokeStyle = PALETTE.olive;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI / 2);
      ctx.stroke();

      // Outer accent bead
      ctx.fillStyle = PALETTE.burgundy;
      ctx.beginPath();
      ctx.arc(28, 28, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    drawCornerFlourish(58, 58, 1, 1);
    drawCornerFlourish(1022, 58, -1, 1);
    drawCornerFlourish(58, 1442, 1, -1);
    drawCornerFlourish(1022, 1442, -1, -1);

    // 3. Header: Bismillah in Calligraphy styling
    ctx.fillStyle = PALETTE.burgundy;
    ctx.font = 'bold 36px Amiri, Cairo, serif';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 540, 150);

    // Arabesque Botanical Center Divider (Olive Leaves + Burgundy Diamond)
    ctx.save();
    // Horizontal divider lines
    ctx.strokeStyle = 'rgba(107, 35, 55, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(340, 185);
    ctx.lineTo(495, 185);
    ctx.moveTo(585, 185);
    ctx.lineTo(740, 185);
    ctx.stroke();

    // Center burgundy diamond
    ctx.fillStyle = PALETTE.burgundy;
    ctx.beginPath();
    ctx.moveTo(540, 177);
    ctx.lineTo(548, 185);
    ctx.lineTo(540, 193);
    ctx.lineTo(532, 185);
    ctx.closePath();
    ctx.fill();

    // Two olive leaf accents
    ctx.fillStyle = PALETTE.olive;
    ctx.beginPath();
    ctx.ellipse(516, 185, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(564, 185, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Event Title in Olive Green
    ctx.fillStyle = PALETTE.olive;
    ctx.font = '600 36px Amiri, Cairo, sans-serif';
    ctx.fillText('حفل عقد قران', 540, 245);

    // 5. Couple Names in Majestic Burgundy
    ctx.fillStyle = PALETTE.burgundy;
    ctx.font = 'bold 68px Amiri, Playfair Display, serif';
    ctx.fillText('ساره وعبدالله', 540, 335);

    // 6. Date & Time
    ctx.fillStyle = PALETTE.charcoal;
    ctx.font = 'bold 30px Cairo, Tajawal, sans-serif';
    ctx.fillText('الثلاثاء ٢٩ ديسمبر ٢٠٢٦', 540, 415);

    ctx.fillStyle = PALETTE.burgundy;
    ctx.font = '600 26px Cairo, Tajawal, sans-serif';
    ctx.fillText('الساعة 7:30 مساءً', 540, 460);

    // 7. Venue (Arabic in Olive & English in Dark Charcoal)
    ctx.fillStyle = PALETTE.olive;
    ctx.font = '600 28px Cairo, sans-serif';
    ctx.fillText('النرجس — فندق والدورف أستوريا، الكويت', 540, 520);

    ctx.fillStyle = PALETTE.charcoalMuted;
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.direction = 'ltr';
    ctx.fillText('AL NARJIS — WALDORF ASTORIA, KUWAIT', 540, 555);
    ctx.direction = 'rtl';

    // Thin separator line
    ctx.strokeStyle = 'rgba(102, 112, 68, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(260, 600);
    ctx.lineTo(820, 600);
    ctx.stroke();

    // 8. Guest Honorific Banner & Name Box
    ctx.fillStyle = PALETTE.olive;
    ctx.font = '500 24px Cairo, sans-serif';
    ctx.fillText('يتشرفون بدعوة الكريم / الكريمة لحضور الحفل:', 540, 660);

    // Guest Name in elegant luxury box
    const guestBoxWidth = 800;
    const guestBoxX = (1080 - guestBoxWidth) / 2;
    const guestBoxY = 690;
    const guestBoxHeight = 92;

    // Fill Warm White background
    ctx.fillStyle = PALETTE.warmWhite;
    ctx.fillRect(guestBoxX, guestBoxY, guestBoxWidth, guestBoxHeight);

    // Outer Burgundy border
    ctx.strokeStyle = PALETTE.burgundy;
    ctx.lineWidth = 2;
    ctx.strokeRect(guestBoxX, guestBoxY, guestBoxWidth, guestBoxHeight);

    // Inner Olive fine border
    ctx.strokeStyle = PALETTE.olive;
    ctx.lineWidth = 1;
    ctx.strokeRect(guestBoxX + 4, guestBoxY + 4, guestBoxWidth - 8, guestBoxHeight - 8);

    // Corner decorative notches on guest box
    ctx.fillStyle = PALETTE.burgundy;
    ctx.fillRect(guestBoxX - 3, guestBoxY - 3, 6, 6);
    ctx.fillRect(guestBoxX + guestBoxWidth - 3, guestBoxY - 3, 6, 6);
    ctx.fillRect(guestBoxX - 3, guestBoxY + guestBoxHeight - 3, 6, 6);
    ctx.fillRect(guestBoxX + guestBoxWidth - 3, guestBoxY + guestBoxHeight - 3, 6, 6);

    // Guest Name
    ctx.fillStyle = PALETTE.burgundy;
    ctx.font = 'bold 40px Amiri, Cairo, serif';
    ctx.fillText(guest.guestName, 540, 752);

    // 9. QR Code Image centered
    const qrImg = new Image();
    qrImg.onload = () => {
      const qrSize = 380;
      const qrBoxSize = 424;
      const qrBoxX = (1080 - qrBoxSize) / 2;
      const qrBoxY = 818;
      const qrX = (1080 - qrSize) / 2;
      const qrY = qrBoxY + (qrBoxSize - qrSize) / 2;

      // Solid light container for pristine quiet zone
      ctx.fillStyle = PALETTE.warmWhite;
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      // Frame: Outer Burgundy
      ctx.strokeStyle = PALETTE.burgundy;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      // Frame: Inner Olive
      ctx.strokeStyle = PALETTE.olive;
      ctx.lineWidth = 1;
      ctx.strokeRect(qrBoxX + 6, qrBoxY + 6, qrBoxSize - 12, qrBoxSize - 12);

      // Corner accent diamonds on QR frame
      const qrCorners = [
        [qrBoxX, qrBoxY],
        [qrBoxX + qrBoxSize, qrBoxY],
        [qrBoxX, qrBoxY + qrBoxSize],
        [qrBoxX + qrBoxSize, qrBoxY + qrBoxSize],
      ];
      qrCorners.forEach(([cx, cy]) => {
        ctx.fillStyle = PALETTE.olive;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw high-contrast QR code
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 10. Footer Notice
      ctx.fillStyle = PALETTE.burgundy;
      ctx.font = 'bold 24px Cairo, sans-serif';
      ctx.fillText('يرجى إبراز رمز الدعوة عند الدخول — الدعوة شخصية', 540, 1285);

      ctx.fillStyle = PALETTE.olive;
      ctx.font = '600 18px Outfit, sans-serif';
      ctx.direction = 'ltr';
      ctx.fillText(`TOKEN: ${invitationToken}`, 540, 1325);

      // Bottom center flourish
      ctx.fillStyle = PALETTE.burgundy;
      ctx.beginPath();
      ctx.arc(540, 1360, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = PALETTE.olive;
      ctx.beginPath();
      ctx.ellipse(522, 1360, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(558, 1360, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // 11. Subtle & Elegant Powered by MeetHub credit on downloadable invitation
      ctx.save();
      ctx.fillStyle = 'rgba(107, 35, 55, 0.45)';
      ctx.font = '500 15px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.direction = 'ltr';
      ctx.fillText('POWERED BY MEETHUB', 540, 1400);
      ctx.restore();

      // Generate Downloadable PNG Data URL
      try {
        const dataUrl = canvas.toDataURL('image/png');
        setDownloadUrl(dataUrl);
      } catch (e) {
        console.warn('Canvas export notice:', e);
      }
    };
    qrImg.src = qrDataUrl;
  }, [qrDataUrl, guest.guestName, invitationToken]);

  // Handle PNG Download
  const handleDownload = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Invitation_${guest.guestName.replace(/\s+/g, '_')}_Sara_Abdullah.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Mobile Web Share API
  const handleNativeShare = async () => {
    if (!downloadUrl || typeof navigator === 'undefined' || !navigator.share) {
      handleCopyLink();
      return;
    }

    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const file = new File([blob], `Invitation_${guest.guestName}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'حفل عقد قران ساره وعبدالله',
          text: `بطاقة دعوة حفل عقد قران ساره وعبدالله — ${guest.guestName}`,
          url: invitationUrl,
        });
      } else {
        await navigator.share({
          title: 'حفل عقد قران ساره وعبدالله',
          text: `بطاقة دعوة حفل عقد قران ساره وعبدالله — ${guest.guestName}\n${invitationUrl}`,
          url: invitationUrl,
        });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('Share error, falling back to copy:', err);
        handleCopyLink();
      }
    }
  };

  // Handle WhatsApp
  const handleWhatsApp = () => {
    const message = buildWhatsAppMessage(guest.guestName, invitationUrl);
    let phoneDigits = '';
    if (guest.phone) {
      phoneDigits = guest.phone.replace(/[^0-9]/g, '');
    }
    const waUrl = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(waUrl, '_blank');
  };

  // Copy Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-warmwhite rounded-2xl border border-beige-300 shadow-2xl max-w-xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto animate-fade-in">
        {/* Modal Top Bar */}
        <div className="bg-burgundy-950 text-beige-50 p-4 flex items-center justify-between border-b border-burgundy-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-olive-400" />
            <h3 className="font-bold text-sm sm:text-base text-beige-100 font-arabic">
              {language === 'ar' ? 'بطاقة الدعوة الرسمية والرمز' : 'Official Invitation Card & QR'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-beige-300 hover:text-white p-1 rounded-lg hover:bg-burgundy-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Invitation Card Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col items-center">
          {/* Status Badge */}
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <span className="text-charcoal-600 font-medium">
              {language === 'ar' ? 'حالة الدعوة:' : 'Status:'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold ${
                guest.invitationStatus === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : guest.invitationStatus === 'USED'
                  ? 'bg-blue-50 text-blue-800 border border-blue-300'
                  : guest.invitationStatus === 'REVOKED'
                  ? 'bg-red-50 text-red-800 border border-red-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}
            >
              {guest.invitationStatus === 'ACTIVE' && t.statusActive}
              {guest.invitationStatus === 'USED' && t.statusUsed}
              {guest.invitationStatus === 'REVOKED' && t.statusRevoked}
              {guest.invitationStatus === 'NOT_GENERATED' && t.statusNotGenerated}
            </span>
          </div>

          {/* Invitation Card Visual Representation */}
          <div className="relative w-full max-w-[380px] bg-gradient-to-b from-warmwhite via-beige-50 to-beige-100 rounded-xl border-2 border-burgundy-600/70 p-5 shadow-luxury text-center my-2">
            {/* Ornate Inner Frame */}
            <div className="border border-olive-600/50 rounded-lg p-4 relative bg-warmwhite/60">
              <div className="text-olive-700 text-xs font-arabic mb-1">
                {EVENT_DETAILS.titleAr}
              </div>
              <h2 className="font-arabic font-bold text-2xl text-burgundy-950 mb-1">
                {EVENT_DETAILS.coupleNamesAr}
              </h2>

              <div className="text-xs text-charcoal-700 font-medium my-2">
                <div>{EVENT_DETAILS.dateFormattedAr}</div>
                <div className="text-burgundy-800 font-bold">{EVENT_DETAILS.timeFormattedAr}</div>
                <div className="text-[11px] text-olive-800 font-semibold mt-1">
                  {EVENT_DETAILS.venueAr} — {EVENT_DETAILS.hotelAr}
                </div>
              </div>

              {/* Guest Honor Box */}
              <div className="my-3 py-2 px-3 bg-warmwhite border border-burgundy-300/80 rounded-md shadow-xs">
                <span className="text-[10px] text-olive-800 font-medium block">
                  {language === 'ar' ? 'يتشرفون بدعوة الكريم / الكريمة:' : 'Cordially invites:'}
                </span>
                <span className="font-bold text-base text-burgundy-900 block font-arabic mt-0.5">
                  {guest.guestName}
                </span>
              </div>

              {/* QR Code Container */}
              <div className="my-3 flex flex-col items-center justify-center">
                {generating ? (
                  <div className="w-44 h-44 bg-beige-200/60 rounded-lg flex items-center justify-center text-xs text-charcoal-500">
                    جاري إعداد الرمز...
                  </div>
                ) : qrDataUrl ? (
                  <div className="p-2.5 bg-warmwhite border border-burgundy-400/60 rounded-lg shadow-xs">
                    <img src={qrDataUrl} alt="Invitation QR" className="w-40 h-40 object-contain" />
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center justify-center text-xs p-3">
                    لم يتم توليد رمز لهذا الضيف بعد
                  </div>
                )}
                <span className="text-[11px] text-burgundy-800 font-semibold mt-2">
                  {t.cardNotice}
                </span>
                <span className="text-[9px] text-charcoal-400 font-mono mt-0.5">
                  {invitationToken}
                </span>

                {/* Subtle MeetHub branding */}
                <div className="mt-2 pt-2 border-t border-beige-200/60 flex items-center justify-center">
                  <a
                    href={MEETHUB_BRAND.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-charcoal-400 hover:text-burgundy-900 transition-colors"
                  >
                    <span>Powered by</span>
                    <span className="font-bold text-burgundy-900">{MEETHUB_BRAND.name}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden Canvas used for generating the high-res 1080x1500 PNG download */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Actions: Download, Share, WhatsApp, Copy Link */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <button
              onClick={handleDownload}
              disabled={!downloadUrl}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-burgundy-600 hover:bg-burgundy-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadInvitation}</span>
            </button>

            <button
              onClick={handleNativeShare}
              disabled={!downloadUrl}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-charcoal-800 hover:bg-charcoal-900 text-beige-100 shadow-sm transition-all disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5 text-olive-300" />
              <span>{t.shareNative}</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{t.shareWhatsApp}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-beige-200 hover:bg-beige-300 text-charcoal-800 border border-beige-300 shadow-sm transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-olive-700" />
                  <span>{t.copyLink}</span>
                </>
              )}
            </button>
          </div>

          {/* Admin Maintenance Controls (Reissue / Revoke / Reset Test) */}
          <div className="w-full mt-4 pt-3 border-t border-beige-300 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-charcoal-500">
              {language === 'ar' ? 'إجراءات الأمان المتقدمة:' : 'Security Actions:'}
            </span>

            <div className="flex items-center gap-2">
              {/* Reset Test Invitation Action */}
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-amber-800 hover:text-amber-900 border border-amber-400/60 rounded-lg hover:bg-amber-50 transition-colors"
                title={t.resetTestInvitationTooltip}
              >
                <RotateCcw className="w-3 h-3 text-amber-700" />
                <span>{t.resetTestInvitation}</span>
              </button>

              {onReissue && (
                <button
                  onClick={async () => {
                    if (window.confirm(t.confirmReissueDesc)) {
                      setIsReissuing(true);
                      try {
                        await onReissue(currentGuest);
                      } finally {
                        setIsReissuing(false);
                      }
                    }
                  }}
                  disabled={isReissuing}
                  className="px-2.5 py-1 text-xs text-burgundy-800 hover:text-burgundy-900 border border-burgundy-400/50 rounded-lg hover:bg-burgundy-50 transition-colors disabled:opacity-50"
                >
                  {isReissuing ? 'جاري الإصدار...' : t.reissueQr}
                </button>
              )}

              {onRevoke && currentGuest.invitationStatus === 'ACTIVE' && (
                <button
                  onClick={async () => {
                    if (window.confirm(t.confirmRevokeDesc)) {
                      setIsRevoking(true);
                      try {
                        await onRevoke(currentGuest);
                      } finally {
                        setIsRevoking(false);
                      }
                    }
                  }}
                  disabled={isRevoking}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>{isRevoking ? 'جاري الإلغاء...' : t.revokeQr}</span>
                </button>
              )}
            </div>
          </div>

          {/* Reset Test Modal */}
          {isResetModalOpen && (
            <ResetTestModal
              guest={currentGuest}
              isOpen={isResetModalOpen}
              onClose={() => setIsResetModalOpen(false)}
              onSuccess={(_newInv, updatedGuest) => {
                setCurrentGuest(updatedGuest);
                if (onResetTestInvitation) {
                  onResetTestInvitation(updatedGuest);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
