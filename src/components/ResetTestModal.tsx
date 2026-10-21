import React, { useState } from 'react';
import type { Guest, Invitation } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { resetTestInvitation } from '../services/firestore';
import {
  RotateCcw,
  ShieldAlert,
  X,
  CheckCircle2,
  Eye,
  AlertTriangle,
} from 'lucide-react';

interface ResetTestModalProps {
  guest: Guest;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newInvitation: Invitation, updatedGuest: Guest) => void;
  onViewCard?: (updatedGuest: Guest) => void;
}

export const ResetTestModal: React.FC<ResetTestModalProps> = ({
  guest,
  isOpen,
  onClose,
  onSuccess,
  onViewCard,
}) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();

  const [reason, setReason] = useState(t.defaultResetReason);
  const [confirmedUnderstood, setConfirmedUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    newInvitation: Invitation;
    updatedGuest: Guest;
  } | null>(null);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) {
      setError(language === 'ar' ? 'يجب تسجيل الدخول كمسؤول' : 'Admin authentication required');
      return;
    }
    if (!confirmedUnderstood) {
      setError(
        language === 'ar'
          ? 'يرجى تأكيد فهم شروط إعادة التعيين قبل المتابعة'
          : 'Please confirm you understand the reset terms before proceeding'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await resetTestInvitation(guest, adminUser, reason.trim() || t.defaultResetReason);
      setSuccessResult(result);
      if (onSuccess) {
        onSuccess(result.newInvitation, result.updatedGuest);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-warmwhite rounded-3xl border-2 border-burgundy-500/40 shadow-luxury max-w-lg w-full overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 p-4 sm:p-5 text-white flex items-center justify-between border-b border-burgundy-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-burgundy-800/80 border border-burgundy-700 text-amber-300">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg font-arabic text-warmwhite">
                {t.resetTestInvitation}
              </h3>
              <p className="text-[11px] text-beige-300">
                {language === 'ar'
                  ? 'إلغاء الرمز التجريبي، وتصفير الحضور، وتوليد رمز مشفر جديد'
                  : 'Revoke test QR, reset attendance, and issue a fresh QR token'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-beige-300 hover:text-white p-1 rounded-lg hover:bg-burgundy-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {successResult ? (
            /* Success State */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-950 font-arabic">
                    {t.resetSuccess}
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {language === 'ar'
                      ? `تم بنجاح تصفير حالة الحضور للضيف "${guest.guestName}"، وإلغاء صلاحية الرمز السابق نهائياً، وتوليد رمز QR مشفر جديد جاهز للمشاركة والتحميل.`
                      : `Successfully reset attendance for "${guest.guestName}", permanently invalidated previous QR tokens, and generated a new secure QR ready for download.`}
                  </p>
                </div>
              </div>

              {/* New Token preview */}
              <div className="p-3.5 bg-beige-100 rounded-xl border border-beige-300 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-charcoal-600">
                  <span>{language === 'ar' ? 'رمز الدعوة الجديد:' : 'New Token:'}</span>
                  <span className="font-mono font-bold text-burgundy-900 bg-warmwhite px-2 py-0.5 rounded border border-beige-300">
                    {successResult.newInvitation.token}
                  </span>
                </div>
                <div className="flex items-center justify-between text-charcoal-600">
                  <span>{language === 'ar' ? 'حالة الحضور:' : 'Attendance Status:'}</span>
                  <span className="font-bold text-emerald-700">
                    {language === 'ar' ? 'لم يحضر بعد (جاهز للحفل)' : 'Not Arrived (Ready)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-charcoal-700 hover:bg-beige-200 rounded-xl transition-colors"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
                {onViewCard && (
                  <button
                    onClick={() => {
                      onViewCard(successResult.updatedGuest);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white rounded-xl shadow-md transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t.viewInvitation}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Reset Form State */
            <form onSubmit={handleReset} className="space-y-4">
              {/* Target Guest Card */}
              <div className="p-3.5 bg-beige-100/90 rounded-2xl border border-beige-300/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-charcoal-500 block">
                    #{guest.sourceGuestNumber || guest.id}
                  </span>
                  <h4 className="font-bold text-sm text-burgundy-950 font-arabic">
                    {guest.guestName}
                  </h4>
                  {guest.phone && (
                    <span className="text-xs font-mono text-charcoal-600" dir="ltr">
                      {guest.phone}
                    </span>
                  )}
                </div>

                <div className="text-right rtl:text-left">
                  <span
                    className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      guest.attendanceStatus === 'CHECKED_IN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {guest.attendanceStatus === 'CHECKED_IN' ? 'مسجل حضور' : 'لم يحضر'}
                  </span>
                </div>
              </div>

              {/* Explanatory Safe Operation Box */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-300/90 rounded-2xl text-xs space-y-2 text-amber-950">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>{language === 'ar' ? 'ماذا سيحدث عند إعادة التعيين؟' : 'What happens during this reset?'}</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-[11px] text-amber-900 leading-relaxed pr-1">
                  <li>
                    <strong>{language === 'ar' ? 'إلغاء فوري للرمز القديم:' : 'Permanent Revocation:'}</strong>{' '}
                    {language === 'ar'
                      ? 'أي رمز QR تم مسحه مسبقاً لهذا الضيف سيصبح ملغياً نهائياً ولن يقبله الماسح أبداً.'
                      : 'Any previous QR codes for this guest become permanently revoked and rejected.'}
                  </li>
                  <li>
                    <strong>{language === 'ar' ? 'تصفير الحضور:' : 'Attendance Reset:'}</strong>{' '}
                    {language === 'ar'
                      ? 'تُعاد حالة الحضور إلى (لم يحضر) ويُحذف وقت الدخول السابق واسم المسؤول.'
                      : 'Attendance status resets to NOT_ARRIVED, clearing timestamps and admin.'}
                  </li>
                  <li>
                    <strong>{language === 'ar' ? 'توليد بطاقة جديدة:' : 'Fresh Cryptographic QR:'}</strong>{' '}
                    {language === 'ar'
                      ? 'يتم إصدار رمز جديد غير قابل للتخمين وتجهيز بطاقة الدعوة للتحميل والإرسال.'
                      : 'A brand new unpredictable token is generated ready for export.'}
                  </li>
                  <li>
                    <strong>{language === 'ar' ? 'حفظ البيانات وسجل التدقيق:' : 'Data & Audit Preserved:'}</strong>{' '}
                    {language === 'ar'
                      ? 'اسم الضيف ورقمه وملاحظاته تظل محفوظة بالكامل، مع تسجيل العملية في سجل التدقيق.'
                      : 'Guest name, phone, notes remain untouched, with an append-only audit log entry.'}
                  </li>
                </ul>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  {t.resetReason}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t.resetReasonPlaceholder}
                  disabled={loading}
                  className="w-full px-3 py-2 text-xs bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 disabled:opacity-50"
                />
              </div>

              {/* Explicit Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-beige-300 bg-white/80 cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={confirmedUnderstood}
                  onChange={(e) => setConfirmedUnderstood(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 rounded text-burgundy-600 focus:ring-burgundy-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-charcoal-800 leading-relaxed font-medium">
                  {language === 'ar'
                    ? 'أؤكد موافقتي على إلغاء الرمز التجريبي السابق نهائياً وإعادة تعيين الحضور وتوليد رمز رسمي جديد لهذا الضيف.'
                    : 'I confirm revoking the previous test QR permanently, resetting attendance, and issuing a fresh official QR for this guest.'}
                </span>
              </label>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-beige-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-semibold text-charcoal-700 hover:bg-beige-200 rounded-xl transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!confirmedUnderstood || loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-md text-white bg-burgundy-600 hover:bg-burgundy-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'جاري إعادة التعيين...' : t.resetTestInvitation}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
