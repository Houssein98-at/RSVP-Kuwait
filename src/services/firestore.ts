import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Guest, Invitation, AdminUser, CheckInResult, CSVImportRow } from '../types';
import { EVENT_DETAILS } from '../utils/constants';
import { generateSecureToken, hashToken, normalizeKuwaitPhone } from '../utils/helpers';

/**
 * Format Firestore Timestamp or Date into ISO string
 */
function toISO(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date().toISOString();
}

/**
 * Check if the given UID is on the authorized admin allowlist
 */
export async function checkAdminAllowlist(uid: string): Promise<AdminUser | null> {
  if (!db) return null;
  try {
    const adminRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.role === 'admin' && data.active === true) {
        return {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          role: 'admin',
          active: true,
          createdAt: toISO(data.createdAt),
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Error checking admin allowlist:', err);
    return null;
  }
}

/**
 * Subscribe to real-time Guest list
 */
export function subscribeToGuests(
  callback: (guests: Guest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!db) {
    callback([]);
    return () => {};
  }

  const guestsCol = collection(db, 'guests');
  const q = query(guestsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const guests: Guest[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          eventId: d.eventId || EVENT_DETAILS.id,
          sourceGuestNumber: d.sourceGuestNumber,
          guestName: d.guestName || '',
          phone: d.phone || '',
          notes: d.notes || '',
          invitationStatus: d.invitationStatus || 'NOT_GENERATED',
          activeInvitationId: d.activeInvitationId || null,
          activeToken: d.activeToken || null,
          attendanceStatus: d.attendanceStatus || 'NOT_ARRIVED',
          checkedInAt: d.checkedInAt ? toISO(d.checkedInAt) : null,
          checkedInBy: d.checkedInBy || null,
          checkedInByName: d.checkedInByName || null,
          createdAt: toISO(d.createdAt),
          updatedAt: toISO(d.updatedAt),
        };
      });
      callback(guests);
    },
    (err) => {
      console.error('Firestore guest subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to recent arrivals (checked-in guests)
 */
export function subscribeToRecentArrivals(
  callback: (guests: Guest[]) => void,
  limitCount = 10
): Unsubscribe {
  if (!db) {
    callback([]);
    return () => {};
  }

  const guestsCol = collection(db, 'guests');
  const q = query(
    guestsCol,
    where('attendanceStatus', '==', 'CHECKED_IN'),
    orderBy('checkedInAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const arrivals: Guest[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          eventId: d.eventId || EVENT_DETAILS.id,
          guestName: d.guestName || '',
          phone: d.phone || '',
          attendanceStatus: 'CHECKED_IN',
          invitationStatus: d.invitationStatus || 'USED',
          checkedInAt: d.checkedInAt ? toISO(d.checkedInAt) : null,
          checkedInByName: d.checkedInByName || null,
          createdAt: toISO(d.createdAt),
          updatedAt: toISO(d.updatedAt),
        };
      });
      callback(arrivals);
    },
    (err) => {
      console.warn('Recent arrivals subscription notice:', err);
    }
  );
}

/**
 * Create a new guest with capacity validation (125 max)
 */
export async function createGuest(
  data: { guestName: string; phone?: string; notes?: string },
  adminUser: AdminUser
): Promise<Guest> {
  if (!db) throw new Error('Firestore is not initialized');

  // Enforce capacity limit
  const guestsSnap = await getDocs(collection(db, 'guests'));
  if (guestsSnap.size >= EVENT_DETAILS.capacity) {
    throw new Error(`تم الوصول إلى السعة القصوى المحددة (${EVENT_DETAILS.capacity} ضيف)`);
  }

  const norm = normalizeKuwaitPhone(data.phone);
  if (!norm.isValid) {
    throw new Error(norm.error || 'رقم هاتف كويتي غير صالح');
  }

  const guestRef = doc(collection(db, 'guests'));
  const newGuestNumber = guestsSnap.size + 1;

  const newGuestData = {
    id: guestRef.id,
    eventId: EVENT_DETAILS.id,
    sourceGuestNumber: newGuestNumber,
    guestName: data.guestName.trim(),
    phone: norm.normalized,
    notes: data.notes?.trim() || '',
    invitationStatus: 'NOT_GENERATED',
    activeInvitationId: null,
    activeToken: null,
    attendanceStatus: 'NOT_ARRIVED',
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(guestRef, newGuestData);

  // Write Audit Log
  const auditRef = doc(collection(db, 'auditLogs'));
  await setDoc(auditRef, {
    id: auditRef.id,
    type: 'GUEST_CREATED',
    guestId: guestRef.id,
    guestName: data.guestName.trim(),
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { phone: norm.normalized, sourceGuestNumber: newGuestNumber },
  });

  return {
    ...newGuestData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Guest;
}

/**
 * Update existing guest details
 */
export async function updateGuest(
  guestId: string,
  updates: { guestName?: string; phone?: string; notes?: string },
  adminUser: AdminUser
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');

  const guestRef = doc(db, 'guests', guestId);
  const snap = await getDoc(guestRef);
  if (!snap.exists()) throw new Error('Guest not found');

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.guestName !== undefined) {
    payload.guestName = updates.guestName.trim();
  }
  if (updates.phone !== undefined) {
    const norm = normalizeKuwaitPhone(updates.phone);
    if (!norm.isValid) throw new Error(norm.error || 'رقم هاتف كويتي غير صالح');
    payload.phone = norm.normalized;
  }
  if (updates.notes !== undefined) {
    payload.notes = updates.notes.trim();
  }

  await updateDoc(guestRef, payload);

  // Write Audit Log
  const auditRef = doc(collection(db, 'auditLogs'));
  await setDoc(auditRef, {
    id: auditRef.id,
    type: 'GUEST_UPDATED',
    guestId,
    guestName: updates.guestName || snap.data()?.guestName,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: updates,
  });
}

/**
 * Delete a guest (admin action)
 */
export async function deleteGuest(guestId: string, adminUser: AdminUser): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  const guestRef = doc(db, 'guests', guestId);
  const snap = await getDoc(guestRef);
  const guestName = snap.exists() ? snap.data().guestName : guestId;

  await deleteDoc(guestRef);

  // Audit log
  const auditRef = doc(collection(db, 'auditLogs'));
  await setDoc(auditRef, {
    id: auditRef.id,
    type: 'GUEST_UPDATED',
    guestId,
    guestName,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { action: 'DELETED' },
  });
}

/**
 * Generate a unique QR Invitation for a guest
 */
export async function generateInvitation(guest: Guest, adminUser: AdminUser): Promise<Invitation> {
  if (!db) throw new Error('Firestore is not initialized');

  const token = generateSecureToken();
  const tokenHash = await hashToken(token);

  const invRef = doc(collection(db, 'invitations'));
  const guestRef = doc(db, 'guests', guest.id);

  const newInvitation: Invitation = {
    id: invRef.id,
    guestId: guest.id,
    guestName: guest.guestName,
    eventId: EVENT_DETAILS.id,
    token,
    tokenHash,
    status: 'ACTIVE',
    generatedAt: new Date().toISOString(),
    revokedAt: null,
    usedAt: null,
    createdBy: adminUser.uid,
  };

  const batch = writeBatch(db);

  // Write new invitation
  batch.set(invRef, {
    ...newInvitation,
    generatedAt: serverTimestamp(),
  });

  // Update guest document
  batch.update(guestRef, {
    invitationStatus: 'ACTIVE',
    activeInvitationId: invRef.id,
    activeToken: token,
    updatedAt: serverTimestamp(),
  });

  // Write Audit Log
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'INVITATION_GENERATED',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: invRef.id,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { tokenPreview: token.substring(0, 9) + '...' },
  });

  await batch.commit();

  return newInvitation;
}

/**
 * Reissue a new unique QR invitation (invalidates previous token immediately)
 */
export async function reissueInvitation(guest: Guest, adminUser: AdminUser): Promise<Invitation> {
  if (!db) throw new Error('Firestore is not initialized');

  const token = generateSecureToken();
  const tokenHash = await hashToken(token);

  const batch = writeBatch(db);

  // Revoke previous invitation if one was active
  if (guest.activeInvitationId) {
    const oldInvRef = doc(db, 'invitations', guest.activeInvitationId);
    batch.update(oldInvRef, {
      status: 'REVOKED',
      revokedAt: serverTimestamp(),
      revokedBy: adminUser.uid,
    });
  }

  // Create new active invitation
  const newInvRef = doc(collection(db, 'invitations'));
  const newInvitation: Invitation = {
    id: newInvRef.id,
    guestId: guest.id,
    guestName: guest.guestName,
    eventId: EVENT_DETAILS.id,
    token,
    tokenHash,
    status: 'ACTIVE',
    generatedAt: new Date().toISOString(),
    revokedAt: null,
    usedAt: null,
    createdBy: adminUser.uid,
  };

  batch.set(newInvRef, {
    ...newInvitation,
    generatedAt: serverTimestamp(),
  });

  // Update guest
  const guestRef = doc(db, 'guests', guest.id);
  batch.update(guestRef, {
    invitationStatus: 'ACTIVE',
    activeInvitationId: newInvRef.id,
    activeToken: token,
    attendanceStatus: 'NOT_ARRIVED',
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    updatedAt: serverTimestamp(),
  });

  // Write Audit Log
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'INVITATION_REISSUED',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: newInvRef.id,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { previousInvitationId: guest.activeInvitationId },
  });

  await batch.commit();

  return newInvitation;
}

/**
 * Revoke an active QR invitation
 */
export async function revokeInvitation(guest: Guest, adminUser: AdminUser): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');

  const batch = writeBatch(db);

  if (guest.activeInvitationId) {
    const invRef = doc(db, 'invitations', guest.activeInvitationId);
    batch.update(invRef, {
      status: 'REVOKED',
      revokedAt: serverTimestamp(),
      revokedBy: adminUser.uid,
    });
  }

  const guestRef = doc(db, 'guests', guest.id);
  batch.update(guestRef, {
    invitationStatus: 'REVOKED',
    updatedAt: serverTimestamp(),
  });

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'INVITATION_REVOKED',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: guest.activeInvitationId,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { reason: 'Admin manual revocation' },
  });

  await batch.commit();
}

/**
 * Clean and extract raw token from QR code payload or URL
 */
export function extractTokenFromPayload(payload: string): string {
  const clean = payload.trim();
  // If payload contains full URL with hash or param, extract token
  // Example: https://example.com/#/invitation/SA26-ABCDEF
  const match = clean.match(/SA26-[A-F0-9]{32}/i);
  if (match) return match[0].toUpperCase();

  // Or if it's after last slash
  const lastSegment = clean.split('/').pop()?.split('?')[0];
  if (lastSegment && lastSegment.startsWith('SA26-')) {
    return lastSegment.toUpperCase();
  }

  return clean;
}

/**
 * Validate QR token and fetch preliminary invitation & guest data
 */
export async function validateToken(rawPayload: string): Promise<CheckInResult> {
  if (!db) {
    return {
      status: 'ERROR',
      messageAr: 'قاعدة البيانات غير متصلة',
      messageEn: 'Database not connected',
    };
  }

  const token = extractTokenFromPayload(rawPayload);
  const tokenHash = await hashToken(token);

  // Search invitations collection by token OR tokenHash
  const invCol = collection(db, 'invitations');
  let q = query(invCol, where('token', '==', token), limit(1));
  let snap = await getDocs(q);

  if (snap.empty) {
    // Try searching by tokenHash
    q = query(invCol, where('tokenHash', '==', tokenHash), limit(1));
    snap = await getDocs(q);
  }

  if (snap.empty) {
    return {
      status: 'INVALID',
      messageAr: 'رمز غير صالح! هذا الرمز غير مسجل في قاعدة بيانات الحفل.',
      messageEn: 'Invalid code! This invitation was not found in the event database.',
    };
  }

  const invDoc = snap.docs[0];
  const invData = invDoc.data();
  const invitation: Invitation = {
    id: invDoc.id,
    guestId: invData.guestId,
    guestName: invData.guestName,
    eventId: invData.eventId,
    token: invData.token,
    tokenHash: invData.tokenHash,
    status: invData.status,
    generatedAt: toISO(invData.generatedAt),
    revokedAt: invData.revokedAt ? toISO(invData.revokedAt) : null,
    usedAt: invData.usedAt ? toISO(invData.usedAt) : null,
    createdBy: invData.createdBy,
  };

  // Fetch linked guest details
  const guestRef = doc(db, 'guests', invitation.guestId);
  const guestSnap = await getDoc(guestRef);
  let guest: Guest | undefined;

  if (guestSnap.exists()) {
    const gd = guestSnap.data();
    guest = {
      id: guestSnap.id,
      eventId: gd.eventId || EVENT_DETAILS.id,
      guestName: gd.guestName || invitation.guestName,
      phone: gd.phone || '',
      invitationStatus: gd.invitationStatus || invitation.status,
      attendanceStatus: gd.attendanceStatus || 'NOT_ARRIVED',
      checkedInAt: gd.checkedInAt ? toISO(gd.checkedInAt) : null,
      checkedInByName: gd.checkedInByName || null,
      createdAt: toISO(gd.createdAt),
      updatedAt: toISO(gd.updatedAt),
    };
  }

  if (invitation.status === 'REVOKED') {
    return {
      status: 'REVOKED',
      messageAr: 'دعوة ملغاة! تم إلغاء هذه الدعوة رسمياً من قبل الإدارة.',
      messageEn: 'Revoked Invitation! This invitation was revoked by event administration.',
      guest,
      invitation,
    };
  }

  if (invitation.status === 'USED' || guest?.attendanceStatus === 'CHECKED_IN') {
    return {
      status: 'ALREADY_USED',
      messageAr: 'تم استخدام الدعوة مسبقًا! لا يجوز الدخول أكثر من مرة واحدة.',
      messageEn: 'Invitation already used! Re-entry is not permitted.',
      guest,
      invitation,
      checkedInAt: guest?.checkedInAt || invitation.usedAt || undefined,
      checkedInByName: guest?.checkedInByName || undefined,
    };
  }

  // Active and valid!
  return {
    status: 'SUCCESS',
    messageAr: 'دعوة صالحة ومؤكدة — جاهزة لتأكيد الدخول',
    messageEn: 'Valid and verified invitation — Ready to confirm entry',
    guest,
    invitation,
  };
}

/**
 * CRITICAL ATOMIC CHECK-IN TRANSACTION
 * Guarantees that even if two admins scan simultaneously, at most ONE can succeed.
 */
export async function executeAtomicCheckIn(
  invitationId: string,
  guestId: string,
  adminUser: AdminUser
): Promise<CheckInResult> {
  if (!db) {
    return {
      status: 'ERROR',
      messageAr: 'قاعدة البيانات غير متصلة',
      messageEn: 'Database not connected',
    };
  }

  const invRef = doc(db, 'invitations', invitationId);
  const guestRef = doc(db, 'guests', guestId);
  const auditRef = doc(collection(db, 'auditLogs'));

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Transactional Read: Invitation
      const invSnap = await transaction.get(invRef);
      if (!invSnap.exists()) {
        throw new Error('INVITATION_NOT_FOUND');
      }
      const invData = invSnap.data();

      if (invData.status === 'REVOKED') {
        throw new Error('INVITATION_REVOKED');
      }

      if (invData.status === 'USED') {
        throw new Error('ALREADY_USED');
      }

      // 2. Transactional Read: Guest
      const guestSnap = await transaction.get(guestRef);
      if (!guestSnap.exists()) {
        throw new Error('GUEST_NOT_FOUND');
      }
      const guestData = guestSnap.data();

      if (guestData.attendanceStatus === 'CHECKED_IN') {
        throw new Error('ALREADY_USED');
      }

      // 3. Transactional Writes
      const nowTs = serverTimestamp();
      const adminName = adminUser.displayName || adminUser.email;

      // Mark invitation as USED
      transaction.update(invRef, {
        status: 'USED',
        usedAt: nowTs,
        usedByAdminUid: adminUser.uid,
      });

      // Mark guest as CHECKED_IN
      transaction.update(guestRef, {
        attendanceStatus: 'CHECKED_IN',
        checkedInAt: nowTs,
        checkedInBy: adminUser.uid,
        checkedInByName: adminName,
        updatedAt: nowTs,
      });

      // Record Audit Log inside the transaction
      transaction.set(auditRef, {
        id: auditRef.id,
        type: 'CHECK_IN',
        guestId,
        guestName: guestData.guestName,
        invitationId,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        timestamp: nowTs,
        details: { method: 'QR_SCAN_CONFIRMATION' },
      });

      return {
        guestName: guestData.guestName,
        phone: guestData.phone,
      };
    });

    return {
      status: 'SUCCESS',
      messageAr: `تم تسجيل دخول الضيف بنجاح: ${result.guestName}`,
      messageEn: `Guest check-in confirmed: ${result.guestName}`,
      checkedInAt: new Date().toISOString(),
      checkedInByName: adminUser.displayName || adminUser.email,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Check-in transaction aborted:', errorMsg);

    if (errorMsg === 'ALREADY_USED') {
      return {
        status: 'ALREADY_USED',
        messageAr: 'تم استخدام الدعوة مسبقًا! تم تسجيل هذا الرمز من قبل جهاز آخر.',
        messageEn: 'Already used! This invitation was checked in on another device.',
      };
    }
    if (errorMsg === 'INVITATION_REVOKED') {
      return {
        status: 'REVOKED',
        messageAr: 'تم إلغاء هذه الدعوة رسميًا ولا يمكن استخدامها.',
        messageEn: 'This invitation has been revoked and cannot be used.',
      };
    }

    return {
      status: 'ERROR',
      messageAr: `فشلت عملية التحضير: ${errorMsg}`,
      messageEn: `Check-in failed: ${errorMsg}`,
    };
  }
}

/**
 * Manual check-in from Dashboard (with admin confirmation & audit log)
 */
export async function manualCheckInGuest(guest: Guest, adminUser: AdminUser): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');

  const guestRef = doc(db, 'guests', guest.id);
  const adminName = adminUser.displayName || adminUser.email;
  const batch = writeBatch(db);

  batch.update(guestRef, {
    attendanceStatus: 'CHECKED_IN',
    checkedInAt: serverTimestamp(),
    checkedInBy: adminUser.uid,
    checkedInByName: adminName,
    updatedAt: serverTimestamp(),
  });

  if (guest.activeInvitationId) {
    const invRef = doc(db, 'invitations', guest.activeInvitationId);
    batch.update(invRef, {
      status: 'USED',
      usedAt: serverTimestamp(),
    });
  }

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'CHECK_IN',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: guest.activeInvitationId || null,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { method: 'MANUAL_DASHBOARD_CHECK_IN' },
  });

  await batch.commit();
}

/**
 * Reverse an accidental check-in with explicit admin audit logging
 */
export async function reverseCheckInGuest(
  guest: Guest,
  adminUser: AdminUser,
  reason = 'Accidental check-in reversal'
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');

  const guestRef = doc(db, 'guests', guest.id);
  const batch = writeBatch(db);

  batch.update(guestRef, {
    attendanceStatus: 'NOT_ARRIVED',
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    updatedAt: serverTimestamp(),
  });

  if (guest.activeInvitationId) {
    const invRef = doc(db, 'invitations', guest.activeInvitationId);
    batch.update(invRef, {
      status: 'ACTIVE',
      usedAt: null,
    });
  }

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'CHECK_IN_REVERSED',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: guest.activeInvitationId || null,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { reason, reversedBy: adminUser.email },
  });

  await batch.commit();
}

/**
 * Reset Test Invitation / إعادة تعيين دعوة تجريبية
 *
 * Safe admin-only action operating on one selected guest at a time:
 * - Revokes current and past invitation tokens for that guest
 * - Resets attendance to NOT_ARRIVED
 * - Clears check-in timestamp and admin identity
 * - Generates a new cryptographically secure QR token and active invitation
 * - Preserves guest name, phone, notes, sourceGuestNumber, and guest ID
 * - Preserves historical audit records and appends a TEST_INVITATION_RESET audit log
 * - Old QR codes remain permanently rejected upon scanning even after reset
 */
export async function resetTestInvitation(
  guest: Guest,
  adminUser: AdminUser,
  reason = 'Pre-event test verification reset'
): Promise<{ newInvitation: Invitation; updatedGuest: Guest }> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!adminUser || adminUser.role !== 'admin' || !adminUser.active) {
    throw new Error('Unauthorized: Admin permissions required');
  }

  const batch = writeBatch(db);

  // 1. Revoke existing active/used invitation
  if (guest.activeInvitationId) {
    const oldInvRef = doc(db, 'invitations', guest.activeInvitationId);
    batch.update(oldInvRef, {
      status: 'REVOKED',
      revokedAt: serverTimestamp(),
      revokedBy: adminUser.uid,
      revocationReason: `TEST_RESET: ${reason}`,
    });
  }

  // 2. Also sweep any older non-revoked invitations for this guest
  try {
    const invCol = collection(db, 'invitations');
    const q = query(invCol, where('guestId', '==', guest.id));
    const priorInvs = await getDocs(q);
    priorInvs.forEach((invDoc) => {
      const d = invDoc.data();
      if (invDoc.id !== guest.activeInvitationId && d.status !== 'REVOKED') {
        batch.update(invDoc.ref, {
          status: 'REVOKED',
          revokedAt: serverTimestamp(),
          revokedBy: adminUser.uid,
          revocationReason: `TEST_RESET_SWEEP: ${reason}`,
        });
      }
    });
  } catch (err) {
    console.warn('Sweep prior invitations notice:', err);
  }

  // 3. Generate fresh cryptographically secure token
  const token = generateSecureToken();
  const tokenHash = await hashToken(token);

  // 4. Create new invitation document
  const newInvRef = doc(collection(db, 'invitations'));
  const newInvitation: Invitation = {
    id: newInvRef.id,
    guestId: guest.id,
    guestName: guest.guestName,
    eventId: guest.eventId || EVENT_DETAILS.id,
    token,
    tokenHash,
    status: 'ACTIVE',
    generatedAt: new Date().toISOString(),
    revokedAt: null,
    usedAt: null,
    createdBy: adminUser.uid,
  };

  batch.set(newInvRef, {
    ...newInvitation,
    generatedAt: serverTimestamp(),
    resetFromInvitationId: guest.activeInvitationId || null,
    resetReason: reason,
  });

  // 5. Update guest document preserving name, phone, notes, sourceGuestNumber
  const guestRef = doc(db, 'guests', guest.id);
  batch.update(guestRef, {
    invitationStatus: 'ACTIVE',
    activeInvitationId: newInvRef.id,
    activeToken: token,
    attendanceStatus: 'NOT_ARRIVED',
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    updatedAt: serverTimestamp(),
  });

  // 6. Write append-only tamper-proof audit log
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'TEST_INVITATION_RESET',
    guestId: guest.id,
    guestName: guest.guestName,
    invitationId: newInvRef.id,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: {
      action: 'RESET_TEST_INVITATION',
      actionAr: 'إعادة تعيين دعوة تجريبية',
      reason,
      previousInvitationId: guest.activeInvitationId || null,
      previousAttendanceStatus: guest.attendanceStatus,
      newInvitationId: newInvRef.id,
      tokenPreview: token.substring(0, 9) + '...',
    },
  });

  await batch.commit();

  const updatedGuest: Guest = {
    ...guest,
    invitationStatus: 'ACTIVE',
    activeInvitationId: newInvRef.id,
    activeToken: token,
    attendanceStatus: 'NOT_ARRIVED',
    checkedInAt: null,
    checkedInBy: null,
    checkedInByName: null,
    updatedAt: new Date().toISOString(),
  };

  return { newInvitation, updatedGuest };
}

/**
 * Bulk import guests from CSV with capacity safeguard
 */
export async function bulkImportGuests(
  rows: CSVImportRow[],
  adminUser: AdminUser
): Promise<{ added: number; skipped: number; total: number }> {
  if (!db) throw new Error('Firestore is not initialized');

  // Verify current capacity
  const existingSnap = await getDocs(collection(db, 'guests'));
  const currentCount = existingSnap.size;
  const remainingSlots = EVENT_DETAILS.capacity - currentCount;

  if (remainingSlots <= 0) {
    throw new Error(`تم الوصول إلى السعة القصوى المحددة (${EVENT_DETAILS.capacity} ضيف)`);
  }

  // Filter valid rows
  const validRows = rows.filter((r) => r.isValid && r.guest_name.trim());
  const rowsToImport = validRows.slice(0, remainingSlots);

  // Use Firestore batches (batches can hold up to 500 operations)
  const batch = writeBatch(db);
  let guestNumberCounter = currentCount + 1;

  for (const row of rowsToImport) {
    const guestRef = doc(collection(db, 'guests'));
    const norm = normalizeKuwaitPhone(row.phone);

    batch.set(guestRef, {
      id: guestRef.id,
      eventId: EVENT_DETAILS.id,
      sourceGuestNumber: row.guest_number ? Number(row.guest_number) || guestNumberCounter : guestNumberCounter,
      guestName: row.guest_name.trim(),
      phone: norm.normalized,
      notes: '',
      invitationStatus: 'NOT_GENERATED',
      activeInvitationId: null,
      activeToken: null,
      attendanceStatus: 'NOT_ARRIVED',
      checkedInAt: null,
      checkedInBy: null,
      checkedInByName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    guestNumberCounter++;
  }

  // Record audit log
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, {
    id: auditRef.id,
    type: 'CSV_IMPORT',
    guestId: 'BULK',
    guestName: `Imported ${rowsToImport.length} guests`,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    timestamp: serverTimestamp(),
    details: { count: rowsToImport.length },
  });

  await batch.commit();

  return {
    added: rowsToImport.length,
    skipped: validRows.length - rowsToImport.length,
    total: currentCount + rowsToImport.length,
  };
}
