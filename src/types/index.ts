export type Language = 'ar' | 'en';

export type InvitationStatus = 'NOT_GENERATED' | 'ACTIVE' | 'USED' | 'REVOKED';

export type AttendanceStatus = 'NOT_ARRIVED' | 'CHECKED_IN';

export interface EventDetails {
  id: string;
  titleAr: string;
  titleEn: string;
  coupleNamesAr: string;
  coupleNamesEn: string;
  date: string; // "2026-12-29"
  time: string; // "19:30"
  timeFormattedAr: string; // "7:30 مساءً"
  timeFormattedEn: string; // "7:30 PM"
  dateFormattedAr: string; // "الثلاثاء 29 ديسمبر 2026"
  dateFormattedEn: string; // "Tuesday, 29 December 2026"
  timeZone: string; // "Asia/Kuwait"
  venueAr: string; // "النرجس"
  hotelAr: string; // "والدورف أستوريا"
  venueEn: string; // "AL NARJIS"
  hotelEn: string; // "WALDORF ASTORIA"
  country: string; // "Kuwait"
  capacity: number; // 125
  phoneCountryCode: string; // "+965"
}

export interface Guest {
  id: string;
  eventId: string;
  sourceGuestNumber?: number;
  guestName: string;
  phone?: string;
  notes?: string;
  invitationStatus: InvitationStatus;
  activeInvitationId?: string | null;
  activeToken?: string | null;
  attendanceStatus: AttendanceStatus;
  checkedInAt?: string | null; // ISO string
  checkedInBy?: string | null; // Admin UID
  checkedInByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  guestId: string;
  guestName: string;
  eventId: string;
  token: string;
  tokenHash: string;
  status: 'ACTIVE' | 'USED' | 'REVOKED';
  generatedAt: string;
  revokedAt?: string | null;
  usedAt?: string | null;
  createdBy: string;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin';
  active: boolean;
  createdAt?: string;
}

export type AuditLogType = 
  | 'CHECK_IN'
  | 'CHECK_IN_REVERSED'
  | 'INVITATION_GENERATED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_REISSUED'
  | 'TEST_INVITATION_RESET'
  | 'GUEST_CREATED'
  | 'GUEST_UPDATED'
  | 'CSV_IMPORT';

export interface AuditLog {
  id: string;
  type: AuditLogType;
  guestId: string;
  guestName: string;
  invitationId?: string | null;
  adminUid: string;
  adminEmail: string;
  timestamp: string; // ISO string
  details?: Record<string, unknown>;
}

export interface CheckInResult {
  status: 'SUCCESS' | 'ALREADY_USED' | 'INVALID' | 'REVOKED' | 'ERROR';
  messageAr: string;
  messageEn: string;
  guest?: Guest;
  invitation?: Invitation;
  checkedInAt?: string;
  checkedInByName?: string;
}

export interface CSVImportRow {
  guest_number?: string | number;
  guest_name: string;
  phone?: string;
  isValid: boolean;
  errors: string[];
}
