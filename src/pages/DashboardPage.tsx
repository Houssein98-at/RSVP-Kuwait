import React, { useState } from 'react';
import type { Guest } from '../types';
import { EVENT_DETAILS } from '../utils/constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  generateInvitation,
  reissueInvitation,
  revokeInvitation,
  manualCheckInGuest,
  reverseCheckInGuest,
  deleteGuest,
} from '../services/firestore';
import { formatKuwaitDateTime } from '../utils/helpers';
import { InvitationCardModal } from '../components/InvitationCardModal';
import { EditGuestModal } from '../components/EditGuestModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResetTestModal } from '../components/ResetTestModal';
import {
  Users,
  UserCheck,
  Clock,
  QrCode,
  ShieldAlert,
  Search,
  Download,
  Eye,
  CheckCircle,
  Undo2,
  RefreshCw,
  RotateCcw,
  Edit,
  Trash2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface DashboardPageProps {
  guests: Guest[];
  recentArrivals: Guest[];
  onNavigateToGuests: () => void;
  onNavigateToScanner: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  guests,
  recentArrivals,
  onNavigateToGuests,
  onNavigateToScanner,
}) => {
  const { t, language } = useLanguage();
  const { adminUser } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [invitationFilter, setInvitationFilter] = useState<string>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');

  // Modal states
  const [activeGuestForCard, setActiveGuestForCard] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [resetTestGuest, setResetTestGuest] = useState<Guest | null>(null);

  // Dialog states for confirmations
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

  // Metrics Calculation from actual live database records
  const totalRegistered = guests.length;
  const remainingSlots = Math.max(0, EVENT_DETAILS.capacity - totalRegistered);
  const invitationsGenerated = guests.filter(
    (g) => g.invitationStatus === 'ACTIVE' || g.invitationStatus === 'USED'
  ).length;
  const invitationsPending = guests.filter(
    (g) => g.invitationStatus === 'NOT_GENERATED'
  ).length;
  const checkedInCount = guests.filter(
    (g) => g.attendanceStatus === 'CHECKED_IN'
  ).length;
  const notArrivedCount = totalRegistered - checkedInCount;
  const revokedCount = guests.filter(
    (g) => g.invitationStatus === 'REVOKED'
  ).length;

  // Filtered Guests
  const filteredGuests = guests.filter((guest) => {
    // Search filter
    const matchesSearch =
      searchTerm.trim() === '' ||
      guest.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (guest.phone && guest.phone.includes(searchTerm.trim())) ||
      (guest.activeToken && guest.activeToken.toLowerCase().includes(searchTerm.toLowerCase()));

    // Invitation status filter
    const matchesInvitation =
      invitationFilter === 'ALL' ||
      guest.invitationStatus === invitationFilter;

    // Attendance filter
    const matchesAttendance =
      attendanceFilter === 'ALL' ||
      guest.attendanceStatus === attendanceFilter;

    return matchesSearch && matchesInvitation && matchesAttendance;
  });

  // Export Table to CSV
  const handleExportCSV = () => {
    const headers = [
      'Guest ID',
      'Guest Name',
      'Phone',
      'Invitation Status',
      'Attendance Status',
      'Check-in Time (Kuwait)',
      'Checked-in By',
    ];

    const rows = guests.map((g) => [
      `"${g.sourceGuestNumber || g.id}"`,
      `"${g.guestName.replace(/"/g, '""')}"`,
      `"${g.phone || ''}"`,
      `"${g.invitationStatus}"`,
      `"${g.attendanceStatus}"`,
      `"${g.checkedInAt ? formatKuwaitDateTime(g.checkedInAt, 'en') : ''}"`,
      `"${g.checkedInByName || ''}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sara_Abdullah_Wedding_Guests_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reissue QR confirmation
  const triggerReissue = (guest: Guest) => {
    setConfirmDialog({
      isOpen: true,
      title: t.reissueQr,
      description: t.confirmReissueDesc,
      isDestructive: true,
      onConfirm: async () => {
        if (!adminUser) return;
        setDialogLoading(true);
        try {
          await reissueInvitation(guest, adminUser);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDialogLoading(false);
        }
      },
    });
  };

  // Revoke QR confirmation
  const triggerRevoke = (guest: Guest) => {
    setConfirmDialog({
      isOpen: true,
      title: t.revokeQr,
      description: t.confirmRevokeDesc,
      isDestructive: true,
      onConfirm: async () => {
        if (!adminUser) return;
        setDialogLoading(true);
        try {
          await revokeInvitation(guest, adminUser);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDialogLoading(false);
        }
      },
    });
  };

  // Manual Check-in
  const triggerManualCheckIn = (guest: Guest) => {
    setConfirmDialog({
      isOpen: true,
      title: t.manualCheckIn,
      description: `هل أنت متأكد من تسجيل دخول الضيف يدوياً: "${guest.guestName}"؟`,
      isDestructive: false,
      onConfirm: async () => {
        if (!adminUser) return;
        setDialogLoading(true);
        try {
          await manualCheckInGuest(guest, adminUser);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDialogLoading(false);
        }
      },
    });
  };

  // Reverse Check-in with audit log
  const triggerReverseCheckIn = (guest: Guest) => {
    setConfirmDialog({
      isOpen: true,
      title: t.reverseCheckIn,
      description: t.confirmReverseCheckInDesc,
      isDestructive: true,
      onConfirm: async () => {
        if (!adminUser) return;
        setDialogLoading(true);
        try {
          await reverseCheckInGuest(guest, adminUser, 'Manual dashboard reversal');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } finally {
          setDialogLoading(false);
        }
      },
    });
  };

  // Delete Guest
  const triggerDeleteGuest = (guest: Guest) => {
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

  return (
    <div className="space-y-6 pb-12">
      {/* Banner & Quick Access */}
      <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 rounded-2xl p-5 sm:p-6 text-beige-50 border border-burgundy-700/50 shadow-luxury flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-olive-400" />
            <span className="text-xs text-beige-200 font-semibold tracking-wide">
              {EVENT_DETAILS.titleAr}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-arabic text-warmwhite">
            {EVENT_DETAILS.coupleNamesAr}
          </h2>
          <p className="text-xs text-beige-300/80 mt-1">
            {language === 'ar' 
              ? `${EVENT_DETAILS.dateFormattedAr} • ${EVENT_DETAILS.timeFormattedAr} • ${EVENT_DETAILS.venueAr} — ${EVENT_DETAILS.hotelAr}`
              : `${EVENT_DETAILS.dateFormattedEn} • ${EVENT_DETAILS.timeFormattedEn} • ${EVENT_DETAILS.venueEn} — ${EVENT_DETAILS.hotelEn}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onNavigateToScanner}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-burgundy-600 hover:bg-burgundy-700 text-white font-bold text-xs shadow-md transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>{language === 'ar' ? 'فتح ماسح الدخول' : 'Open Entrance Scanner'}</span>
          </button>

          <button
            onClick={onNavigateToGuests}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-burgundy-900/90 hover:bg-burgundy-800 text-beige-100 font-semibold text-xs border border-burgundy-600/50 transition-all"
          >
            <Users className="w-4 h-4 text-olive-300" />
            <span>{language === 'ar' ? 'إضافة ضيف جديد' : 'Add New Guest'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Capacity */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.totalCapacity}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-charcoal-900 font-sans">
              {EVENT_DETAILS.capacity}
            </span>
            <Users className="w-4 h-4 text-burgundy-600 opacity-80" />
          </div>
        </div>

        {/* Registered */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.registeredGuests}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-charcoal-900 font-sans">
              {totalRegistered}
            </span>
            <span className="text-[10px] text-charcoal-400 font-sans">
              {Math.round((totalRegistered / EVENT_DETAILS.capacity) * 100)}%
            </span>
          </div>
        </div>

        {/* Remaining Slots */}
        <div className="luxury-card rounded-xl p-3.5 border-emerald-500/40 bg-emerald-50/30">
          <span className="text-[11px] text-emerald-800 font-medium block truncate">{t.remainingSlots}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-sans">
              {remainingSlots}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Checked In */}
        <div className="luxury-card rounded-xl p-3.5 bg-emerald-50/60 border-emerald-500/50">
          <span className="text-[11px] text-emerald-900 font-bold block truncate">{t.checkedInGuests}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-sans">
              {checkedInCount}
            </span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        {/* Not Arrived */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.notYetArrived}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-charcoal-700 font-sans">
              {notArrivedCount}
            </span>
            <Clock className="w-4 h-4 text-olive-600" />
          </div>
        </div>

        {/* Generated */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.invitationsGenerated}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-burgundy-800 font-sans">
              {invitationsGenerated}
            </span>
            <QrCode className="w-4 h-4 text-olive-600" />
          </div>
        </div>

        {/* Pending */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.invitationsPending}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-amber-700 font-sans">
              {invitationsPending}
            </span>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">معلق</span>
          </div>
        </div>

        {/* Revoked */}
        <div className="luxury-card rounded-xl p-3.5 border border-beige-300/70">
          <span className="text-[11px] text-charcoal-500 block truncate">{t.revokedInvitations}</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold text-red-700 font-sans">
              {revokedCount}
            </span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        </div>
      </div>

      {/* Main Content Split: Table + Recent Arrivals Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Column (3 cols on desktop) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Table Controls (Search, Filters, CSV Export) */}
          <div className="luxury-card rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-beige-300/80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute top-3 rtl:right-3 ltr:left-3 text-olive-700" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-2 text-xs sm:text-sm bg-white border border-beige-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-burgundy-500/30 focus:border-burgundy-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Invitation filter */}
              <select
                value={invitationFilter}
                onChange={(e) => setInvitationFilter(e.target.value)}
                className="px-2.5 py-2 text-xs bg-white border border-beige-300 rounded-xl focus:outline-none focus:border-burgundy-500 text-charcoal-800"
              >
                <option value="ALL">{language === 'ar' ? 'كل الدعوات' : 'All Invitations'}</option>
                <option value="ACTIVE">{t.statusActive}</option>
                <option value="NOT_GENERATED">{t.statusNotGenerated}</option>
                <option value="USED">{t.statusUsed}</option>
                <option value="REVOKED">{t.statusRevoked}</option>
              </select>

              {/* Attendance filter */}
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="px-2.5 py-2 text-xs bg-white border border-beige-300 rounded-xl focus:outline-none focus:border-burgundy-500 text-charcoal-800"
              >
                <option value="ALL">{language === 'ar' ? 'كل الحضور' : 'All Attendance'}</option>
                <option value="CHECKED_IN">{t.statusArrived}</option>
                <option value="NOT_ARRIVED">{t.statusNotArrivedShort}</option>
              </select>

              {/* CSV Export */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-olive-600 hover:bg-olive-700 text-white rounded-xl transition-all shadow-sm"
                title={t.exportCsv}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
              </button>
            </div>
          </div>

          {/* Guest Records Table */}
          <div className="luxury-card rounded-2xl overflow-hidden shadow-card border border-beige-300/80">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-right rtl:text-right ltr:text-left">
                <thead className="bg-beige-100/90 text-charcoal-800 border-b border-beige-300 font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center font-mono">#</th>
                    <th className="py-3 px-4">{t.guestName}</th>
                    <th className="py-3 px-3">{t.phone}</th>
                    <th className="py-3 px-3">{t.invitationStatus}</th>
                    <th className="py-3 px-3">{t.attendance}</th>
                    <th className="py-3 px-3">{t.checkInTime}</th>
                    <th className="py-3 px-3 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige-200/70 bg-white">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-charcoal-500">
                        {language === 'ar' ? 'لا توجد سجلات مطابقة للبحث' : 'No records match your criteria'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((guest, idx) => {
                      const isCheckedIn = guest.attendanceStatus === 'CHECKED_IN';
                      return (
                        <tr
                          key={guest.id}
                          className={`hover:bg-beige-50/70 transition-colors ${
                            isCheckedIn ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-3 px-3 text-center text-charcoal-400 font-mono text-xs">
                            {guest.sourceGuestNumber || idx + 1}
                          </td>

                          {/* Guest Name */}
                          <td className="py-3 px-4 font-bold text-burgundy-950 font-arabic">
                            {guest.guestName}
                            {guest.notes && (
                              <span className="block text-[10px] text-charcoal-400 font-normal font-sans truncate max-w-xs">
                                {guest.notes}
                              </span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-3 font-mono text-xs text-charcoal-600" dir="ltr">
                            {guest.phone || '—'}
                          </td>

                          {/* Invitation Status */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                          </td>

                          {/* Attendance Status */}
                          <td className="py-3 px-3">
                            {isCheckedIn ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                {t.statusArrived}
                              </span>
                            ) : (
                              <span className="text-charcoal-400 text-xs">
                                {t.statusNotArrivedShort}
                              </span>
                            )}
                          </td>

                          {/* Check-In Time (Asia/Kuwait) */}
                          <td className="py-3 px-3 text-xs text-charcoal-600 whitespace-nowrap">
                            {guest.checkedInAt ? (
                              <div>
                                <span className="block font-medium">
                                  {formatKuwaitDateTime(guest.checkedInAt, language)}
                                </span>
                                {guest.checkedInByName && (
                                  <span className="text-[10px] text-charcoal-400 block">
                                    بواسطة: {guest.checkedInByName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              {/* View / Download Invitation Card */}
                              {guest.invitationStatus !== 'NOT_GENERATED' && (
                                <button
                                  onClick={() => setActiveGuestForCard(guest)}
                                  className="p-1.5 rounded-lg text-burgundy-700 hover:text-burgundy-900 hover:bg-burgundy-50 transition-colors"
                                  title={t.viewInvitation}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}

                              {/* Generate QR if not generated yet */}
                              {guest.invitationStatus === 'NOT_GENERATED' && (
                                <button
                                  onClick={async () => {
                                    if (!adminUser) return;
                                    await generateInvitation(guest, adminUser);
                                  }}
                                  className="p-1.5 rounded-lg text-olive-700 hover:text-olive-900 hover:bg-olive-50 transition-colors"
                                  title={t.generateQr}
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                              )}

                              {/* Manual Check-in / Reverse Check-in */}
                              {!isCheckedIn ? (
                                <button
                                  onClick={() => triggerManualCheckIn(guest)}
                                  className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-colors"
                                  title={t.manualCheckIn}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => triggerReverseCheckIn(guest)}
                                  className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition-colors"
                                  title={t.reverseCheckIn}
                                >
                                  <Undo2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Reissue QR */}
                              {guest.invitationStatus !== 'NOT_GENERATED' && (
                                <button
                                  onClick={() => triggerReissue(guest)}
                                  className="p-1.5 rounded-lg text-burgundy-700 hover:text-burgundy-900 hover:bg-burgundy-50 transition-colors"
                                  title={t.reissueQr}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}

                              {/* Reset Test Invitation / إعادة تعيين دعوة تجريبية */}
                              {guest.invitationStatus !== 'NOT_GENERATED' && (
                                <button
                                  onClick={() => setResetTestGuest(guest)}
                                  className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 transition-colors"
                                  title={t.resetTestInvitationTooltip}
                                >
                                  <RotateCcw className="w-4 h-4 text-amber-700" />
                                </button>
                              )}

                              {/* Revoke QR */}
                              {guest.invitationStatus === 'ACTIVE' && (
                                <button
                                  onClick={() => triggerRevoke(guest)}
                                  className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                  title={t.revokeQr}
                                >
                                  <ShieldAlert className="w-4 h-4" />
                                </button>
                              )}

                              {/* Edit Guest */}
                              <button
                                onClick={() => setEditingGuest(guest)}
                                className="p-1.5 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-beige-100 transition-colors"
                                title={t.editGuest}
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Delete Guest */}
                              <button
                                onClick={() => triggerDeleteGuest(guest)}
                                className="p-1.5 rounded-lg text-charcoal-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title={t.deleteGuest}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="bg-beige-50/90 p-3 px-4 border-t border-beige-300/80 text-xs text-charcoal-600 flex items-center justify-between">
              <span>
                {language === 'ar'
                  ? `عرض ${filteredGuests.length} من أصل ${guests.length} ضيف مسجل`
                  : `Showing ${filteredGuests.length} of ${guests.length} registered guests`}
              </span>
              <span className="font-semibold text-emerald-800">
                {language === 'ar' ? 'التحديث التلقائي الفوري مفعل' : 'Real-time synchronization active'}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar: Recent Arrivals & Kuwait Time Widget */}
        <div className="space-y-4">
          {/* Recent Arrivals Card */}
          <div className="luxury-card rounded-2xl p-4 shadow-card border border-beige-300/80">
            <div className="flex items-center justify-between mb-3 border-b border-beige-200/80 pb-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs sm:text-sm text-charcoal-900 font-arabic">
                  {t.recentArrivals}
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {checkedInCount}
              </span>
            </div>

            {recentArrivals.length === 0 ? (
              <p className="text-xs text-charcoal-400 py-4 text-center">
                {t.noRecentArrivals}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {recentArrivals.map((arrival) => (
                  <div
                    key={arrival.id}
                    className="p-2.5 rounded-xl bg-warmwhite border border-beige-200/80 flex items-start justify-between gap-2"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-burgundy-950 font-arabic">
                        {arrival.guestName}
                      </h4>
                      <p className="text-[10px] text-charcoal-500 mt-0.5">
                        {formatKuwaitDateTime(arrival.checkedInAt, language)}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0 animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Schedule Info Card */}
          <div className="luxury-card rounded-2xl p-4 text-xs space-y-2.5 border border-beige-300/80">
            <div className="flex items-center gap-2 text-burgundy-900 font-bold">
              <Calendar className="w-4 h-4 text-olive-600" />
              <span>{language === 'ar' ? 'تفاصيل موعد الحفل' : 'Event Schedule'}</span>
            </div>
            <div className="space-y-1.5 text-charcoal-700">
              <div className="flex justify-between border-b border-beige-200/60 pb-1">
                <span>{language === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                <span className="font-bold text-charcoal-900">{EVENT_DETAILS.dateFormattedAr}</span>
              </div>
              <div className="flex justify-between border-b border-beige-200/60 pb-1">
                <span>{language === 'ar' ? 'الوقت:' : 'Time:'}</span>
                <span className="font-bold text-burgundy-800">{EVENT_DETAILS.timeFormattedAr}</span>
              </div>
              <div className="flex justify-between border-b border-beige-200/60 pb-1">
                <span>{language === 'ar' ? 'القاعة:' : 'Venue:'}</span>
                <span className="font-bold text-olive-800">{EVENT_DETAILS.venueAr}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'الفندق:' : 'Hotel:'}</span>
                <span className="font-bold text-charcoal-900">{EVENT_DETAILS.hotelAr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeGuestForCard && (
        <InvitationCardModal
          guest={activeGuestForCard}
          invitation={null}
          onClose={() => setActiveGuestForCard(null)}
          onReissue={async (g) => {
            if (adminUser) await reissueInvitation(g, adminUser);
          }}
          onRevoke={async (g) => {
            if (adminUser) await revokeInvitation(g, adminUser);
          }}
          onResetTestInvitation={(updatedGuest) => {
            setActiveGuestForCard(updatedGuest);
          }}
        />
      )}

      {resetTestGuest && (
        <ResetTestModal
          guest={resetTestGuest}
          isOpen={Boolean(resetTestGuest)}
          onClose={() => setResetTestGuest(null)}
          onViewCard={(updatedGuest) => setActiveGuestForCard(updatedGuest)}
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
