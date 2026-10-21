import React, { useState } from 'react';
import type { Guest } from '../types';
import { EVENT_DETAILS } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createGuest,
  generateInvitation,
  reissueInvitation,
  revokeInvitation,
  deleteGuest,
} from '../services/firestore';
import { normalizeKuwaitPhone } from '../utils/helpers';
import { InvitationCardModal } from '../components/InvitationCardModal';
import { CSVImportModal } from '../components/CSVImportModal';
import { EditGuestModal } from '../components/EditGuestModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResetTestModal } from '../components/ResetTestModal';
import {
  UserPlus,
  Upload,
  QrCode,
  Eye,
  Trash2,
  Edit,
  Phone,
  FileText,
  User,
  Sparkles,
  Search,
  CheckCircle,
  RotateCcw,
} from 'lucide-react';

interface GuestsPageProps {
  guests: Guest[];
}

export const GuestsPage: React.FC<GuestsPageProps> = ({ guests }) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();

  // Form State
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [activeCardGuest, setActiveCardGuest] = useState<Guest | null>(null);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [resetTestGuest, setResetTestGuest] = useState<Guest | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    isDestructive: false,
    onConfirm: async () => {},
  });
  const [dialogLoading, setDialogLoading] = useState(false);

  const remainingSlots = Math.max(0, EVENT_DETAILS.capacity - guests.length);
  const isFull = remainingSlots === 0;

  // Handle Add Guest
  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;

    if (isFull) {
      setFormError(t.capacityFull);
      return;
    }

    if (!guestName.trim()) {
      setFormError(language === 'ar' ? 'يرجى إدخال اسم الضيف' : 'Please enter guest name');
      return;
    }

    if (phone.trim()) {
      const norm = normalizeKuwaitPhone(phone);
      if (!norm.isValid) {
        setFormError(norm.error || 'رقم هاتف كويتي غير صالح');
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const newGuest = await createGuest(
        {
          guestName: guestName.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        },
        adminUser
      );

      // Automatically generate their unique QR invitation immediately
      await generateInvitation(newGuest, adminUser);

      setGuestName('');
      setPhone('');
      setNotes('');
      setFormSuccess(
        language === 'ar'
          ? `تمت إضافة الضيف "${newGuest.guestName}" وتوليد رمز الدعوة بنجاح!`
          : `Guest "${newGuest.guestName}" added and QR invitation generated!`
      );

      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate QR for guest who didn't have one
  const handleGenerateQR = async (guest: Guest) => {
    if (!adminUser) return;
    try {
      await generateInvitation(guest, adminUser);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Delete Guest
  const triggerDelete = (guest: Guest) => {
    setConfirmDialog({
      isOpen: true,
      title: t.deleteGuest,
      description: `${t.confirmDeleteDesc} (${guest.guestName})`,
      isDestructive: true,
      onConfirm: async () => {
        if (!adminUser) return;
        setDialogLoading(true);
        try {
          await deleteGuest(guest.id, adminUser);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDialogLoading(false);
        }
      },
    });
  };

  const filteredGuests = guests.filter((g) => {
    return (
      searchTerm.trim() === '' ||
      g.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.phone && g.phone.includes(searchTerm.trim())) ||
      (g.activeToken && g.activeToken.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Capacity Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Registration Summary Card */}
        <div className="md:col-span-2 bg-gradient-to-r from-burgundy-950 to-burgundy-900 rounded-2xl p-5 sm:p-6 text-beige-50 border border-burgundy-700/50 shadow-luxury flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-olive-400" />
              <h2 className="text-base sm:text-lg font-bold text-beige-200 font-arabic">
                {t.tabGuests}
              </h2>
            </div>
            <p className="text-xs text-beige-300/80 leading-relaxed">
              {language === 'ar'
                ? 'تسجيل الضيوف، وإصدار بطاقات الدعوة الفاخرة، ومشاركتها عبر واتساب أو تحميلها بجودة طباعة عالية.'
                : 'Register event guests, issue luxury QR invitation cards, and share via WhatsApp or high-resolution PNG.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-burgundy-700/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-beige-300/70 block">{t.registeredGuests}</span>
                <span className="font-bold text-beige-100 text-base">{guests.length}</span>
              </div>
              <div className="border-r rtl:border-r ltr:border-l border-burgundy-700/40 pr-4 rtl:pr-4 ltr:pl-4">
                <span className="text-beige-300/70 block">{t.remainingSlots}</span>
                <span className={`font-bold text-base ${isFull ? 'text-red-400' : 'text-emerald-400'}`}>
                  {remainingSlots}
                </span>
              </div>
              <div className="border-r rtl:border-r ltr:border-l border-burgundy-700/40 pr-4 rtl:pr-4 ltr:pl-4">
                <span className="text-beige-300/70 block">{t.totalCapacity}</span>
                <span className="font-bold text-white text-base">{EVENT_DETAILS.capacity}</span>
              </div>
            </div>

            <button
              onClick={() => setIsCSVModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-olive-600 hover:bg-olive-700 text-white rounded-xl shadow-sm transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.bulkImport}</span>
            </button>
          </div>
        </div>

        {/* Capacity Progress Ring Card */}
        <div className="luxury-card rounded-2xl p-5 flex flex-col items-center justify-center text-center border border-beige-300/80">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-beige-200"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={isFull ? 'text-red-500' : 'text-burgundy-600'}
                strokeDasharray={`${(guests.length / EVENT_DETAILS.capacity) * 100}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-sans text-charcoal-900">
                {Math.round((guests.length / EVENT_DETAILS.capacity) * 100)}%
              </span>
              <span className="text-[9px] text-charcoal-400">
                {guests.length}/{EVENT_DETAILS.capacity}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-charcoal-800 mt-2">
            {isFull ? (
              <span className="text-red-600 font-bold">تم الوصول للحد الأقصى</span>
            ) : (
              <span>متبقي {remainingSlots} مقعد شاغر</span>
            )}
          </span>
        </div>
      </div>

      {/* Main Grid: Registration Form (Left) & Guest Cards List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="lg:col-span-1">
          <div className="luxury-card rounded-2xl p-5 sm:p-6 shadow-card sticky top-[135px] border border-beige-300/80">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-beige-200">
              <UserPlus className="w-5 h-5 text-burgundy-600" />
              <h3 className="font-bold text-sm sm:text-base text-burgundy-950 font-arabic">
                {t.addNewGuest}
              </h3>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddGuest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-olive-700" />
                    {t.guestNameLabel} <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t.guestNamePlaceholder}
                  disabled={isFull || isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 disabled:opacity-50"
                  required
                />
                <span className="text-[10px] text-charcoal-400 mt-1 block">
                  {language === 'ar'
                    ? 'الاسم يكتب في حقل واحد ويدعم الألقاب (مثل: معالي، سعادة، د.، الشيخ)'
                    : 'Single field supporting honorifics and full Arabic names'}
                </span>
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
                  disabled={isFull || isSubmitting}
                  dir="ltr"
                  className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 text-left font-mono disabled:opacity-50"
                />
                <span className="text-[10px] text-charcoal-400 mt-1 block">
                  {language === 'ar' ? 'اختياري — 8 أرقام للرقم الكويتي' : 'Optional — 8 Kuwaiti digits'}
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
                  disabled={isFull || isSubmitting}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isFull || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white shadow-md transition-all disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'جاري الحفظ وتوليد الرمز...'
                    : isFull
                    ? t.capacityFull
                    : language === 'ar'
                    ? 'إضافة الضيف وتوليد البطاقة'
                    : 'Add Guest & Generate Card'}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Guest Cards Grid & Management */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <div className="luxury-card rounded-2xl p-3 flex items-center justify-between gap-3 border border-beige-300/80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute top-2.5 rtl:right-3 ltr:left-3 text-olive-700" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-1.5 text-xs bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30"
              />
            </div>
            <span className="text-xs text-charcoal-500 whitespace-nowrap">
              {filteredGuests.length} {language === 'ar' ? 'ضيف' : 'guests'}
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredGuests.length === 0 ? (
              <div className="col-span-full luxury-card rounded-2xl p-8 text-center text-charcoal-400 border border-beige-300/80">
                {language === 'ar' ? 'لا يوجد ضيوف مسجلون حتى الآن' : 'No guests registered yet'}
              </div>
            ) : (
              filteredGuests.map((guest, idx) => {
                const hasCard = guest.invitationStatus !== 'NOT_GENERATED';
                const isCheckedIn = guest.attendanceStatus === 'CHECKED_IN';

                return (
                  <div
                    key={guest.id}
                    className="luxury-card rounded-2xl p-4 flex flex-col justify-between hover:shadow-luxury transition-all border border-beige-300/80 bg-warmwhite"
                  >
                    <div>
                      {/* Top Row: Number & Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-beige-200 text-charcoal-700 font-bold">
                          #{guest.sourceGuestNumber || idx + 1}
                        </span>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isCheckedIn
                              ? 'bg-emerald-100 text-emerald-800'
                              : hasCard
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isCheckedIn ? 'حضر الحفل' : hasCard ? 'البطاقة جاهزة' : 'بانتظار الرمز'}
                        </span>
                      </div>

                      {/* Guest Name */}
                      <h4 className="font-bold text-sm sm:text-base text-burgundy-950 font-arabic line-clamp-1">
                        {guest.guestName}
                      </h4>

                      {/* Phone */}
                      {guest.phone && (
                        <p className="text-xs font-mono text-charcoal-600 mt-1" dir="ltr">
                          {guest.phone}
                        </p>
                      )}

                      {/* Notes if any */}
                      {guest.notes && (
                        <p className="text-[11px] text-charcoal-400 mt-1 line-clamp-1 italic">
                          {guest.notes}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-beige-200/80 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {hasCard ? (
                          <button
                            onClick={() => setActiveCardGuest(guest)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-burgundy-600 hover:bg-burgundy-700 text-white shadow-sm transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t.viewInvitation}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGenerateQR(guest)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-olive-700 hover:bg-olive-800 text-white transition-all shadow-sm"
                          >
                            <QrCode className="w-3.5 h-3.5 text-beige-100" />
                            <span>{t.generateQr}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {hasCard && (
                          <button
                            onClick={() => setResetTestGuest(guest)}
                            className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-100/70 transition-colors"
                            title={t.resetTestInvitationTooltip}
                          >
                            <RotateCcw className="w-4 h-4 text-amber-700" />
                          </button>
                        )}

                        <button
                          onClick={() => setEditingGuest(guest)}
                          className="p-1.5 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-beige-200 transition-colors"
                          title={t.editGuest}
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => triggerDelete(guest)}
                          className="p-1.5 rounded-lg text-charcoal-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title={t.deleteGuest}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeCardGuest && (
        <InvitationCardModal
          guest={activeCardGuest}
          invitation={null}
          onClose={() => setActiveCardGuest(null)}
          onReissue={async (g) => {
            if (adminUser) await reissueInvitation(g, adminUser);
          }}
          onRevoke={async (g) => {
            if (adminUser) await revokeInvitation(g, adminUser);
          }}
          onResetTestInvitation={(updatedGuest) => {
            setActiveCardGuest(updatedGuest);
          }}
        />
      )}

      {resetTestGuest && (
        <ResetTestModal
          guest={resetTestGuest}
          isOpen={Boolean(resetTestGuest)}
          onClose={() => setResetTestGuest(null)}
          onViewCard={(updatedGuest) => setActiveCardGuest(updatedGuest)}
        />
      )}

      {isCSVModalOpen && (
        <CSVImportModal
          existingGuests={guests}
          onClose={() => setIsCSVModalOpen(false)}
          onSuccess={(count) => {
            setFormSuccess(`تم استيراد ${count} ضيف بنجاح من ملف CSV!`);
            setTimeout(() => setFormSuccess(null), 4000);
          }}
        />
      )}

      {editingGuest && (
        <EditGuestModal
          guest={editingGuest}
          onClose={() => setEditingGuest(null)}
          onSuccess={() => {}}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        isDestructive={confirmDialog.isDestructive}
        isLoading={dialogLoading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
