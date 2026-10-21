import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type { Guest, CheckInResult } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  validateToken,
  executeAtomicCheckIn,
  manualCheckInGuest,
} from '../services/firestore';
import {
  playAudioFeedback,
  triggerCelebrationConfetti,
  formatKuwaitDateTime,
  extractTokenFromPayload,
} from '../utils/helpers';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  UserCheck,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Volume2,
} from 'lucide-react';

interface ScannerPageProps {
  guests: Guest[];
  onNavigateToDashboard?: () => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({ guests }) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CheckInResult | null>(null);
  const [isConfirmingEntry, setIsConfirmingEntry] = useState(false);
  const [lastScannedPayload, setLastScannedPayload] = useState<string | null>(null);

  // Manual fallback lookup state
  const [manualQuery, setManualQuery] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // Fetch available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera if label mentions back, environment, or facing back
          const backCam = devices.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not list cameras:', err);
      });

    return () => {
      // Clean up camera when leaving scanner tab
      stopScanner();
    };
  }, []);

  // Process a scanned QR code payload
  const handleDecodedText = useCallback(
    async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Extract token
      const token = extractTokenFromPayload(decodedText);
      setLastScannedPayload(token);

      try {
        // Validate with Firestore
        const result = await validateToken(token);
        setScanResult(result);

        if (result.status === 'SUCCESS') {
          playAudioFeedback('success');
        } else if (result.status === 'ALREADY_USED') {
          playAudioFeedback('warning');
        } else {
          playAudioFeedback('error');
        }

        // Pause camera scanning while dialog/card is displayed
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.pause();
        }
      } catch (err) {
        console.error('QR processing error:', err);
        setScanResult({
          status: 'ERROR',
          messageAr: 'حدث خطأ أثناء معالجة الرمز. يرجى إعادة المحاولة.',
          messageEn: 'Error processing QR code. Please try again.',
        });
        playAudioFeedback('error');
      } finally {
        isProcessingRef.current = false;
      }
    },
    []
  );

  // Start Camera Scanning
  const startScanner = async () => {
    setCameraError(null);
    setScanResult(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      const cameraIdOrConfig = selectedCameraId
        ? selectedCameraId
        : { facingMode: 'environment' };

      await html5QrCodeRef.current.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Frame scan error (ignored, continuous searching)
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Failed to start camera:', err);
      setIsScanning(false);
      setCameraError(t.cameraPermissionDenied);
    }
  };

  // Stop Camera Scanning
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    setIsScanning(false);
  };

  // Switch between available cameras
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setSelectedCameraId(nextCamId);

    if (isScanning) {
      await stopScanner();
      setTimeout(() => {
        startScanner();
      }, 300);
    }
  };

  // Resume camera scanning for the next guest
  const handleScanNextGuest = async () => {
    setScanResult(null);
    setLastScannedPayload(null);

    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.getState() === 3) {
          // PAUSED
          html5QrCodeRef.current.resume();
        } else if (!isScanning) {
          await startScanner();
        }
      } catch {
        await startScanner();
      }
    } else {
      await startScanner();
    }
  };

  // Execute the atomic database check-in
  const handleConfirmEntry = async () => {
    if (!scanResult || !scanResult.invitation || !scanResult.guest || !adminUser) return;

    setIsConfirmingEntry(true);
    try {
      const outcome = await executeAtomicCheckIn(
        scanResult.invitation.id,
        scanResult.guest.id,
        adminUser
      );

      if (outcome.status === 'SUCCESS') {
        playAudioFeedback('success');
        triggerCelebrationConfetti();
        setScanResult({
          ...outcome,
          guest: scanResult.guest,
          invitation: scanResult.invitation,
        });
      } else {
        playAudioFeedback('warning');
        setScanResult(outcome);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanResult({
        status: 'ERROR',
        messageAr: `فشل التحضير: ${msg}`,
        messageEn: `Check-in failed: ${msg}`,
      });
      playAudioFeedback('error');
    } finally {
      setIsConfirmingEntry(false);
    }
  };

  // Manual Check-In fallback
  const handleManualConfirm = async (guest: Guest) => {
    if (!adminUser) return;
    setIsConfirmingEntry(true);
    try {
      await manualCheckInGuest(guest, adminUser);
      playAudioFeedback('success');
      triggerCelebrationConfetti();
      setScanResult({
        status: 'SUCCESS',
        messageAr: `تم تسجيل الدخول يدوياً بنجاح للضيف: ${guest.guestName}`,
        messageEn: `Manual check-in confirmed for: ${guest.guestName}`,
        guest,
        checkedInAt: new Date().toISOString(),
        checkedInByName: adminUser.displayName || adminUser.email,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanResult({
        status: 'ERROR',
        messageAr: `فشل التحضير اليدوي: ${msg}`,
        messageEn: `Manual check-in failed: ${msg}`,
      });
      playAudioFeedback('error');
    } finally {
      setIsConfirmingEntry(false);
    }
  };

  // Filtered guests for manual search fallback
  const manualFilteredGuests = manualQuery.trim()
    ? guests
        .filter((g) => {
          const q = manualQuery.toLowerCase().trim();
          return (
            g.guestName.toLowerCase().includes(q) ||
            (g.phone && g.phone.includes(q)) ||
            (g.activeToken && g.activeToken.toLowerCase().includes(q))
          );
        })
        .slice(0, 5)
    : [];

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-burgundy-950 to-burgundy-900 rounded-2xl p-4 sm:p-5 text-beige-50 border border-burgundy-700/50 shadow-luxury flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-olive-400" />
            <h2 className="text-base sm:text-lg font-bold text-beige-200 font-arabic">
              {t.scannerTitle}
            </h2>
          </div>
          <p className="text-xs text-beige-300/80">
            {t.scannerSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-burgundy-900/80 hover:bg-burgundy-800 text-beige-200 text-xs border border-burgundy-600/40 transition-colors"
              title={t.switchCamera}
            >
              <SwitchCamera className="w-3.5 h-3.5 text-olive-400" />
              <span className="hidden sm:inline">{t.switchCamera}</span>
            </button>
          )}

          <button
            onClick={() => playAudioFeedback('success')}
            className="p-2 rounded-xl bg-burgundy-900/80 text-olive-300 hover:text-beige-100 border border-burgundy-600/40"
            title="اختبار الصوت (Audio Test)"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: Camera Viewfinder */}
        <div className="luxury-card rounded-2xl p-4 sm:p-5 shadow-card flex flex-col items-center border border-beige-300/80">
          {/* Active status indicator */}
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-charcoal-400'
                }`}
              />
              <span className="font-semibold text-charcoal-800">
                {isScanning
                  ? language === 'ar'
                    ? 'الكاميرا نشطة وجاهزة للمسح'
                    : 'Camera Active'
                  : language === 'ar'
                  ? 'الكاميرا متوقفة'
                  : 'Camera Inactive'}
              </span>
            </div>

            {isScanning && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                100% متزامن مع الخادم
              </span>
            )}
          </div>

          {/* Viewfinder Frame with laser sweep */}
          <div className="relative w-full aspect-square max-w-[340px] rounded-2xl overflow-hidden bg-charcoal-900 border-2 border-burgundy-600/80 shadow-inner flex items-center justify-center">
            {/* Html5-QRCode mounts into this div */}
            <div id="qr-reader" className="w-full h-full" />

            {/* Visual Overlays when Scanning */}
            {isScanning && (
              <>
                {/* Laser scan line */}
                <div className="scanner-laser-line pointer-events-none" />

                {/* Viewfinder gold/burgundy corner guides */}
                <div className="absolute top-4 left-4 w-7 h-7 border-t-4 border-l-4 border-burgundy-400 rounded-tl pointer-events-none" />
                <div className="absolute top-4 right-4 w-7 h-7 border-t-4 border-r-4 border-burgundy-400 rounded-tr pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-7 h-7 border-b-4 border-l-4 border-burgundy-400 rounded-bl pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-7 h-7 border-b-4 border-r-4 border-burgundy-400 rounded-br pointer-events-none" />
              </>
            )}

            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-charcoal-900/95 text-beige-100">
                <Camera className="w-12 h-12 text-olive-400 mb-2" />
                <p className="text-xs text-beige-200/80 max-w-xs">
                  {language === 'ar'
                    ? 'اضغط زر "تشغيل الكاميرا" أدناه لبدء مسح بطاقات الضيوف عبر كاميرا الهاتف'
                    : 'Click "Start Camera" below to scan guest cards via phone camera'}
                </p>
              </div>
            )}
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2 w-full">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Camera Control Buttons */}
          <div className="w-full grid grid-cols-2 gap-3 mt-4">
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-burgundy-600 hover:bg-burgundy-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>{t.startCamera}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={stopScanner}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-900 text-beige-100 text-xs font-semibold border border-burgundy-600/30 transition-all"
                >
                  <CameraOff className="w-4 h-4 text-red-400" />
                  <span>{t.stopCamera}</span>
                </button>

                <button
                  onClick={handleScanNextGuest}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-olive-600 hover:bg-olive-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.scanNext}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Scan Result Card & Verification Dialog */}
        <div className="space-y-4">
          {/* Active Result Card */}
          {scanResult ? (
            <div
              className={`rounded-2xl p-5 border-2 shadow-luxury animate-fade-in ${
                scanResult.status === 'SUCCESS' && scanResult.checkedInAt
                  ? 'bg-emerald-50/95 border-emerald-500 text-emerald-950'
                  : scanResult.status === 'SUCCESS'
                  ? 'bg-warmwhite border-burgundy-600 text-charcoal-900'
                  : scanResult.status === 'ALREADY_USED'
                  ? 'bg-amber-50/95 border-amber-500 text-amber-950'
                  : 'bg-red-50/95 border-red-500 text-red-950'
              }`}
            >
              {/* Result Status Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-current/20">
                {scanResult.status === 'SUCCESS' && scanResult.checkedInAt ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                ) : scanResult.status === 'SUCCESS' ? (
                  <ShieldCheck className="w-8 h-8 text-olive-600 flex-shrink-0" />
                ) : scanResult.status === 'ALREADY_USED' ? (
                  <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
                )}

                <div>
                  <h3 className="font-bold text-base sm:text-lg font-arabic">
                    {scanResult.status === 'SUCCESS' && scanResult.checkedInAt
                      ? language === 'ar'
                        ? 'تم تسجيل الدخول بنجاح!'
                        : 'Entry Confirmed!'
                      : scanResult.status === 'SUCCESS'
                      ? t.validInvitation
                      : scanResult.status === 'ALREADY_USED'
                      ? t.alreadyUsedTitle
                      : t.invalidTitle}
                  </h3>
                  <p className="text-xs opacity-85">
                    {language === 'ar' ? scanResult.messageAr : scanResult.messageEn}
                  </p>
                </div>
              </div>

              {/* Guest Information Details */}
              {scanResult.guest && (
                <div className="space-y-2 text-xs bg-white/85 p-3.5 rounded-xl border border-current/15 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="opacity-70 font-medium">اسم الضيف:</span>
                    <span className="font-bold text-sm sm:text-base font-arabic text-burgundy-950">
                      {scanResult.guest.guestName}
                    </span>
                  </div>

                  {scanResult.guest.phone && (
                    <div className="flex justify-between items-center font-mono">
                      <span className="opacity-70">الهاتف:</span>
                      <span dir="ltr">{scanResult.guest.phone}</span>
                    </div>
                  )}

                  {scanResult.checkedInAt && (
                    <div className="flex justify-between items-center text-emerald-800">
                      <span className="font-semibold">وقت التحضير (بتوقيت الكويت):</span>
                      <span className="font-bold">
                        {formatKuwaitDateTime(scanResult.checkedInAt, language)}
                      </span>
                    </div>
                  )}

                  {scanResult.checkedInByName && (
                    <div className="flex justify-between items-center text-charcoal-600">
                      <span>مسؤول الاستقبال:</span>
                      <span>{scanResult.checkedInByName}</span>
                    </div>
                  )}

                  {lastScannedPayload && (
                    <div className="flex justify-between items-center text-[10px] opacity-60 font-mono">
                      <span>رمز البطاقة:</span>
                      <span>{lastScannedPayload}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons based on status */}
              {scanResult.status === 'SUCCESS' && !scanResult.checkedInAt && (
                <div className="space-y-2">
                  <button
                    onClick={handleConfirmEntry}
                    disabled={isConfirmingEntry}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all disabled:opacity-50"
                  >
                    <UserCheck className="w-5 h-5" />
                    <span>{isConfirmingEntry ? t.confirming : t.confirmEntry}</span>
                  </button>

                  <button
                    onClick={handleScanNextGuest}
                    className="w-full py-2 text-xs text-charcoal-700 hover:text-charcoal-900 font-semibold transition-colors"
                  >
                    {t.cancel}
                  </button>
                </div>
              )}

              {/* Next Guest Button after confirmation or rejected */}
              {(scanResult.checkedInAt || scanResult.status !== 'SUCCESS') && (
                <button
                  onClick={handleScanNextGuest}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-burgundy-900 hover:bg-burgundy-950 text-white shadow transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.scanNext}</span>
                </button>
              )}
            </div>
          ) : (
            /* Standby Card */
            <div className="luxury-card rounded-2xl p-6 text-center text-charcoal-500 border border-beige-300/80">
              <ShieldCheck className="w-12 h-12 text-olive-600/70 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-burgundy-950 font-arabic">
                جاهز للتحقق من الدخول
              </h4>
              <p className="text-xs text-charcoal-500 mt-1 max-w-xs mx-auto">
                عند مسح الرمز، سيتم التحقق الفوري من قاعدة البيانات ومنع أي محاولة دخول مكررة بدقة مطلقة.
              </p>
            </div>
          )}

          {/* Manual Lookup Fallback */}
          <div className="luxury-card rounded-2xl p-4 shadow-card border border-beige-300/80">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-charcoal-800">
              <Search className="w-3.5 h-3.5 text-olive-700" />
              <span>{t.manualLookupTitle}</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder={t.manualLookupPlaceholder}
                className="w-full px-3 py-2 text-xs bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600"
              />
            </div>

            {/* Search Results List */}
            {manualFilteredGuests.length > 0 && (
              <div className="mt-2.5 space-y-1.5 max-h-48 overflow-y-auto">
                {manualFilteredGuests.map((guest) => {
                  const isCheckedIn = guest.attendanceStatus === 'CHECKED_IN';
                  return (
                    <div
                      key={guest.id}
                      className="p-2.5 rounded-xl bg-warmwhite border border-beige-300/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-burgundy-950 block font-arabic">
                          {guest.guestName}
                        </span>
                        {guest.phone && (
                          <span className="text-[10px] text-charcoal-500 font-mono" dir="ltr">
                            {guest.phone}
                          </span>
                        )}
                      </div>

                      {isCheckedIn ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          تم الحضور مسبقاً
                        </span>
                      ) : (
                        <button
                          onClick={() => handleManualConfirm(guest)}
                          disabled={isConfirmingEntry}
                          className="px-3 py-1 bg-olive-600 hover:bg-olive-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                        >
                          تسجيل الدخول
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
