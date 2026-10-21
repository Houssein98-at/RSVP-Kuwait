import React, { useState } from 'react';
import type { Guest } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { updateGuest } from '../services/firestore';
import { normalizeKuwaitPhone } from '../utils/helpers';
import { X, Save, User, Phone, FileText } from 'lucide-react';

interface EditGuestModalProps {
  guest: Guest;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditGuestModal: React.FC<EditGuestModalProps> = ({
  guest,
  onClose,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();

  const [guestName, setGuestName] = useState(guest.guestName);
  const [phone, setPhone] = useState(guest.phone || '');
  const [notes, setNotes] = useState(guest.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;

    if (!guestName.trim()) {
      setErrorMsg('اسم الضيف مطلوب');
      return;
    }

    if (phone.trim()) {
      const norm = normalizeKuwaitPhone(phone);
      if (!norm.isValid) {
        setErrorMsg(norm.error || 'رقم هاتف غير صالح');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await updateGuest(
        guest.id,
        {
          guestName: guestName.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        },
        adminUser
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`فشل التحديث: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-warmwhite rounded-2xl border border-beige-300 shadow-2xl max-w-md w-full overflow-hidden my-auto animate-fade-in">
        {/* Header */}
        <div className="bg-burgundy-950 text-beige-50 p-4 flex items-center justify-between border-b border-burgundy-800">
          <h3 className="font-bold text-sm sm:text-base text-beige-100 font-arabic">
            {language === 'ar' ? 'تعديل بيانات الضيف' : 'Edit Guest Details'}
          </h3>
          <button
            onClick={onClose}
            className="text-beige-300 hover:text-white p-1 rounded-lg hover:bg-burgundy-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-olive-700" />
                {t.guestNameLabel}
              </span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t.guestNamePlaceholder}
              className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-olive-700" />
                {t.phoneLabel}
              </span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              dir="ltr"
              className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 text-left font-mono"
            />
            <span className="text-[11px] text-charcoal-500 mt-1 block">
              {language === 'ar' ? 'مثال: 99123456 أو +96599123456' : 'e.g. 99123456 or +96599123456'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 mb-1">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-olive-700" />
                {t.notesLabel}
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-beige-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-charcoal-700 hover:bg-beige-100 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'جاري الحفظ...' : t.saveGuest}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
