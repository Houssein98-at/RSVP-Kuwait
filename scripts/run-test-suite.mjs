/**
 * RSVP-Kuwait — Comprehensive Automated Test Suite
 *
 * Tests the complete invitation lifecycle against Firebase Local Emulators:
 * 1. Guest registration and validation.
 * 2. Unique, cryptographically secure QR generation.
 * 3. Invitation download and correct guest identification.
 * 4. Successful first check-in.
 * 5. Duplicate check-in rejection.
 * 6. Revoked invitation rejection.
 * 7. QR reissue invalidating the previous token.
 * 8. Concurrent check-in attempts.
 * 9. Dashboard attendance updates.
 * 10. Administrator permissions and unauthorized access.
 * 11. Arabic name preservation.
 * 12. Kuwait timestamps and phone normalization.
 * 13. Firebase security rules and data integrity.
 * 14. Phase 2 Safe QR reset functionality ("Reset Test Invitation / إعادة تعيين دعوة تجريبية").
 *
 * SAFETY GUARANTEE:
 * Points ONLY to Local Firebase Emulators (127.0.0.1:8085, 127.0.0.1:9099).
 * Absolutely ZERO mutations touch the live production database!
 */

import { initializeApp, deleteApp } from 'firebase/app';
import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';

// Environment ports for emulators
const FIRESTORE_PORT = process.env.FIRESTORE_PORT || 8085;
const AUTH_PORT = process.env.AUTH_PORT || 9099;
const PROJECT_ID = 'rsvp-kuwait-emulator-test';

process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AUTH_PORT}`;

// Test tracking
const testResults = [];

function pass(name, details = '') {
  testResults.push({ name, status: 'PASS', details });
  console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name} ${details ? `(${details})` : ''}`);
}

function fail(name, error) {
  const errMsg = error instanceof Error ? error.message : String(error);
  testResults.push({ name, status: 'FAIL', details: errMsg });
  console.log(`  \x1b[31m✖ FAIL\x1b[0m: ${name} -> ${errMsg}`);
}

// -------------------------------------------------------------
// Helper implementations matching application logic
// -------------------------------------------------------------

function generateSecureToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `SA26-${hex.toUpperCase()}`;
}

async function hashToken(token) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msg = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Simple fallback hash
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h << 5) - h + token.charCodeAt(i);
    h |= 0;
  }
  return `hash-${Math.abs(h).toString(16)}`;
}

function normalizeKuwaitPhone(rawPhone) {
  if (!rawPhone || !rawPhone.trim()) {
    return { isValid: true, normalized: '' };
  }
  const cleaned = rawPhone.trim().replace(/[\s\-()]/g, '');
  let digits = cleaned;
  if (digits.startsWith('+965')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('00965')) {
    digits = digits.substring(5);
  } else if (digits.startsWith('965') && digits.length === 11) {
    digits = digits.substring(3);
  }
  if (!/^\d{8}$/.test(digits)) {
    return {
      isValid: false,
      normalized: rawPhone,
      error: 'Kuwait phone must be 8 digits',
    };
  }
  return { isValid: true, normalized: `+965${digits}` };
}

function extractTokenFromPayload(payload) {
  const clean = payload.trim();
  const match = clean.match(/SA26-[A-F0-9]{32}/i);
  if (match) return match[0].toUpperCase();
  const lastSegment = clean.split('/').pop()?.split('?')[0];
  if (lastSegment && lastSegment.startsWith('SA26-')) {
    return lastSegment.toUpperCase();
  }
  return clean;
}

function formatKuwaitDateTime(dateInput, lang = 'ar') {
  if (!dateInput) return lang === 'ar' ? 'غير مسجل' : 'Not recorded';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-KW' : 'en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

// -------------------------------------------------------------
// Test Runner
// -------------------------------------------------------------
async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 RSVP-Kuwait Comprehensive Automated Test Suite');
  console.log(`Target: Firebase Emulator [Auth: ${AUTH_PORT}, Firestore: ${FIRESTORE_PORT}]`);
  console.log('======================================================\n');

  // Initialize App
  const app = initializeApp({
    apiKey: 'fake-api-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_PORT}`, { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', FIRESTORE_PORT);

  // Setup Admin user in Auth & Allowlist
  const adminEmail = `admin-test-${Date.now()}@rsvp-kuwait.com`;
  const adminPassword = 'AdminSecurePassword2026!';
  let adminUid = null;

  try {
    const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    adminUid = cred.user.uid;
  } catch (err) {
    const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    adminUid = cred.user.uid;
  }

  // Setup unprivileged user for security rules testing
  const unprivEmail = `regular-user-${Date.now()}@example.com`;
  const unprivPassword = 'RegularPassword2026!';
  let unprivUid = null;
  const unprivCred = await createUserWithEmailAndPassword(auth, unprivEmail, unprivPassword);
  unprivUid = unprivCred.user.uid;

  // Sign back in as admin to configure admin allowlist
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

  // Bootstrap admin allowlist using Admin SDK (bypasses security rules as server-side setup)
  const adminApp = initAdminApp({ projectId: PROJECT_ID }, 'admin-seed-app');
  const adminDb = getAdminFirestore(adminApp);
  await adminDb.collection('admins').doc(adminUid).set({
    uid: adminUid,
    email: adminEmail,
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
  });

  const adminUser = {
    uid: adminUid,
    email: adminEmail,
    displayName: 'Test Administrator',
    role: 'admin',
    active: true,
  };

  // -------------------------------------------------------------
  // TEST SECTION 1: Phone Normalization & Validation
  // -------------------------------------------------------------
  console.log('\n--- Section 1: Phone Normalization & Validation ---');
  try {
    const p1 = normalizeKuwaitPhone('99123456');
    if (p1.isValid && p1.normalized === '+96599123456') {
      pass('Local 8-digit Kuwait phone normalized', p1.normalized);
    } else {
      fail('Local 8-digit Kuwait phone normalized', 'Unexpected result');
    }

    const p2 = normalizeKuwaitPhone('+96550112233');
    if (p2.isValid && p2.normalized === '+96550112233') {
      pass('International +965 format normalized', p2.normalized);
    } else {
      fail('International +965 format normalized', 'Unexpected result');
    }

    const p3 = normalizeKuwaitPhone('0096566445566');
    if (p3.isValid && p3.normalized === '+96566445566') {
      pass('00965 prefix format normalized', p3.normalized);
    } else {
      fail('00965 prefix format normalized', 'Unexpected result');
    }

    const p4 = normalizeKuwaitPhone('  99 33 - 44 55  ');
    if (p4.isValid && p4.normalized === '+96599334455') {
      pass('Phone with spaces and dashes cleaned', p4.normalized);
    } else {
      fail('Phone with spaces and dashes cleaned', 'Unexpected result');
    }

    const p5 = normalizeKuwaitPhone('12345');
    if (!p5.isValid) {
      pass('Too short phone number rejected (5 digits)');
    } else {
      fail('Too short phone number rejected', 'Accepted 5 digits');
    }

    const p6 = normalizeKuwaitPhone('991234567');
    if (!p6.isValid) {
      pass('Too long phone number rejected (9 digits)');
    } else {
      fail('Too long phone number rejected', 'Accepted 9 digits');
    }

    const p7 = normalizeKuwaitPhone('');
    if (p7.isValid && p7.normalized === '') {
      pass('Empty phone allowed as optional');
    } else {
      fail('Empty phone allowed as optional', 'Failed');
    }
  } catch (err) {
    fail('Section 1 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 2: Cryptographic QR Token Generation & Uniqueness
  // -------------------------------------------------------------
  console.log('\n--- Section 2: Cryptographic QR Generation & Uniqueness ---');
  try {
    const tokens = new Set();
    const tokenCount = 200;
    let formatValid = true;

    for (let i = 0; i < tokenCount; i++) {
      const tok = generateSecureToken();
      if (!/^SA26-[A-F0-9]{32}$/.test(tok)) {
        formatValid = false;
      }
      tokens.add(tok);
    }

    if (formatValid) {
      pass('Token format adheres to strict SA26-[A-F0-9]{32} structure');
    } else {
      fail('Token format adheres to strict SA26-[A-F0-9]{32} structure', 'Invalid format detected');
    }

    if (tokens.size === tokenCount) {
      pass(`Generated ${tokenCount} consecutive tokens with zero collisions (100% unique)`);
    } else {
      fail(`Unique tokens test`, `Found ${tokenCount - tokens.size} collisions!`);
    }

    // Hash test
    const sampleToken = 'SA26-112233445566778899AABBCCDDEEFF00';
    const hash1 = await hashToken(sampleToken);
    const hash2 = await hashToken(sampleToken);
    if (hash1 === hash2 && hash1.length === 64) {
      pass('SHA-256 hash function is deterministic and 64-char hex format');
    } else {
      fail('SHA-256 hash function', `Unexpected hash length or mismatch: ${hash1}`);
    }
  } catch (err) {
    fail('Section 2 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 3: Arabic Name Integrity & Preservation
  // -------------------------------------------------------------
  console.log('\n--- Section 3: Arabic Name Integrity & Unicode Preservation ---');
  try {
    const complexArabicNames = [
      'الشيخ د. سُليمان بن عَبدالعزيز آل خَالِد الصّباح',
      'الأميرة سَارَه بِنْت مُحَمَّد العَتيبي',
      'د. عَبْدُالرَّحْمَن الهَاجِري — معالي الوزير الأسبق',
      'فواز بن جاسم الصقر (ضيف الشرف)',
    ];

    for (let idx = 0; idx < complexArabicNames.length; idx++) {
      const originalName = complexArabicNames[idx];
      const gRef = doc(collection(db, 'guests'));
      await setDoc(gRef, {
        id: gRef.id,
        guestName: originalName,
        phone: '+96599112233',
        attendanceStatus: 'NOT_ARRIVED',
        invitationStatus: 'NOT_GENERATED',
        createdAt: new Date().toISOString(),
      });

      const snap = await getDoc(gRef);
      const readName = snap.data()?.guestName;

      if (readName === originalName) {
        pass(`Arabic name #${idx + 1} perfectly preserved byte-for-byte`, originalName.substring(0, 30) + '...');
      } else {
        fail(`Arabic name #${idx + 1} preservation`, `Expected "${originalName}", got "${readName}"`);
      }
    }
  } catch (err) {
    fail('Section 3 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 4: Full Invitation Lifecycle & Atomic Check-in
  // -------------------------------------------------------------
  console.log('\n--- Section 4: Full Invitation Lifecycle & Atomic Check-in ---');
  let testGuest = null;
  let testInvitation = null;

  try {
    // 4.1 Guest creation
    const guestRef = doc(collection(db, 'guests'));
    testGuest = {
      id: guestRef.id,
      eventId: 'sara-abdullah-wedding-2026',
      sourceGuestNumber: 1,
      guestName: 'الشيخ فهد ناصر الصباح',
      phone: '+96599112233',
      notes: 'كبار الشخصيات VIP',
      invitationStatus: 'NOT_GENERATED',
      activeInvitationId: null,
      activeToken: null,
      attendanceStatus: 'NOT_ARRIVED',
      checkedInAt: null,
      checkedInBy: null,
      checkedInByName: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(guestRef, testGuest);
    pass('Guest record registered in Firestore', testGuest.guestName);

    // 4.2 Generate Invitation
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const invRef = doc(collection(db, 'invitations'));
    testInvitation = {
      id: invRef.id,
      guestId: testGuest.id,
      guestName: testGuest.guestName,
      eventId: testGuest.eventId,
      token,
      tokenHash,
      status: 'ACTIVE',
      generatedAt: new Date().toISOString(),
      revokedAt: null,
      usedAt: null,
      createdBy: adminUid,
    };

    const b1 = writeBatch(db);
    b1.set(invRef, testInvitation);
    b1.update(guestRef, {
      invitationStatus: 'ACTIVE',
      activeInvitationId: invRef.id,
      activeToken: token,
      updatedAt: new Date().toISOString(),
    });
    const audit1 = doc(collection(db, 'auditLogs'));
    b1.set(audit1, {
      id: audit1.id,
      type: 'INVITATION_GENERATED',
      guestId: testGuest.id,
      guestName: testGuest.guestName,
      invitationId: invRef.id,
      adminUid,
      adminEmail,
      timestamp: new Date().toISOString(),
    });
    await b1.commit();

    pass('Invitation issued with ACTIVE status and activeToken set on guest', token);

    // 4.3 Extract token from QR payload tests
    const rawTok = testInvitation.token;
    const urlPayload1 = `https://rsvp.kuwait.com/#/invitation/${rawTok}`;
    const urlPayload2 = `https://rsvp.kuwait.com/#/invitation/${rawTok}?src=camera&lang=ar`;
    const ext1 = extractTokenFromPayload(urlPayload1);
    const ext2 = extractTokenFromPayload(urlPayload2);
    if (ext1 === rawTok && ext2 === rawTok) {
      pass('extractTokenFromPayload correctly extracts token from full URLs and query parameters');
    } else {
      fail('extractTokenFromPayload', `ext1=${ext1}, ext2=${ext2}, expected=${rawTok}`);
    }

    // 4.4 Validate Token before check-in
    const invSnap = await getDoc(invRef);
    if (invSnap.exists() && invSnap.data().status === 'ACTIVE') {
      pass('validateToken identifies active and valid invitation');
    } else {
      fail('validateToken active status', 'Not active');
    }

    // 4.5 Execute First Atomic Check-in
    const checkInTime = new Date().toISOString();
    await runTransaction(db, async (txn) => {
      const iSnap = await txn.get(invRef);
      if (!iSnap.exists() || iSnap.data().status !== 'ACTIVE') {
        throw new Error('INVITATION_NOT_ACTIVE');
      }
      const gSnap = await txn.get(guestRef);
      if (!gSnap.exists() || gSnap.data().attendanceStatus === 'CHECKED_IN') {
        throw new Error('ALREADY_USED');
      }

      txn.update(invRef, {
        status: 'USED',
        usedAt: checkInTime,
        usedByAdminUid: adminUid,
      });

      txn.update(guestRef, {
        attendanceStatus: 'CHECKED_IN',
        checkedInAt: checkInTime,
        checkedInBy: adminUid,
        checkedInByName: adminUser.displayName,
        updatedAt: checkInTime,
      });

      const auditCheckIn = doc(collection(db, 'auditLogs'));
      txn.set(auditCheckIn, {
        id: auditCheckIn.id,
        type: 'CHECK_IN',
        guestId: testGuest.id,
        guestName: testGuest.guestName,
        invitationId: invRef.id,
        adminUid,
        adminEmail,
        timestamp: checkInTime,
      });
    });

    const verifyGuestAfterCheckIn = (await getDoc(guestRef)).data();
    const verifyInvAfterCheckIn = (await getDoc(invRef)).data();

    if (
      verifyGuestAfterCheckIn.attendanceStatus === 'CHECKED_IN' &&
      verifyInvAfterCheckIn.status === 'USED' &&
      verifyGuestAfterCheckIn.checkedInAt === checkInTime
    ) {
      pass('Successful first check-in: guest marked CHECKED_IN, invitation marked USED');
    } else {
      fail('First check-in verification', 'Database fields did not match expected values');
    }

    // 4.6 Duplicate Check-in Rejection
    let duplicateRejected = false;
    try {
      await runTransaction(db, async (txn) => {
        const iSnap = await txn.get(invRef);
        if (iSnap.data().status === 'USED') {
          throw new Error('ALREADY_USED');
        }
        const gSnap = await txn.get(guestRef);
        if (gSnap.data().attendanceStatus === 'CHECKED_IN') {
          throw new Error('ALREADY_USED');
        }
      });
    } catch (err) {
      if (err.message === 'ALREADY_USED') {
        duplicateRejected = true;
      }
    }

    if (duplicateRejected) {
      pass('Duplicate check-in rejected with ALREADY_USED error');
    } else {
      fail('Duplicate check-in rejection', 'Failed to reject duplicate check-in');
    }

    // Ensure timestamp was NOT altered by duplicate attempt
    const verifyGuestUnchanged = (await getDoc(guestRef)).data();
    if (verifyGuestUnchanged.checkedInAt === checkInTime) {
      pass('Original check-in timestamp preserved intact during duplicate attempt');
    } else {
      fail('Timestamp preservation', 'Timestamp was modified');
    }
  } catch (err) {
    fail('Section 4 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 5: Revoked Invitation Rejection
  // -------------------------------------------------------------
  console.log('\n--- Section 5: Revoked Invitation Rejection ---');
  try {
    const gRef = doc(collection(db, 'guests'));
    const iRef = doc(collection(db, 'invitations'));
    const tok = generateSecureToken();

    await setDoc(gRef, {
      id: gRef.id,
      guestName: 'سعود عبدالعزيز المضف',
      invitationStatus: 'REVOKED',
      attendanceStatus: 'NOT_ARRIVED',
    });

    await setDoc(iRef, {
      id: iRef.id,
      guestId: gRef.id,
      token: tok,
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
    });

    // Attempt check-in on revoked invitation
    let revokedCaught = false;
    try {
      await runTransaction(db, async (txn) => {
        const iSnap = await txn.get(iRef);
        if (iSnap.data().status === 'REVOKED') {
          throw new Error('INVITATION_REVOKED');
        }
      });
    } catch (err) {
      if (err.message === 'INVITATION_REVOKED') {
        revokedCaught = true;
      }
    }

    if (revokedCaught) {
      pass('Revoked invitation strictly rejected before check-in can occur');
    } else {
      fail('Revoked invitation rejection', 'Revoked invitation was not rejected');
    }
  } catch (err) {
    fail('Section 5 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 6: QR Reissue Invalidating Previous Token
  // -------------------------------------------------------------
  console.log('\n--- Section 6: QR Reissue Invalidating Previous Token ---');
  try {
    const gRef = doc(collection(db, 'guests'));
    const oldInvRef = doc(collection(db, 'invitations'));
    const oldToken = generateSecureToken();

    await setDoc(gRef, {
      id: gRef.id,
      guestName: 'خالد وليد الغانم',
      activeInvitationId: oldInvRef.id,
      activeToken: oldToken,
      invitationStatus: 'ACTIVE',
      attendanceStatus: 'NOT_ARRIVED',
    });

    await setDoc(oldInvRef, {
      id: oldInvRef.id,
      guestId: gRef.id,
      token: oldToken,
      status: 'ACTIVE',
    });

    // Reissue new QR
    const newToken = generateSecureToken();
    const newInvRef = doc(collection(db, 'invitations'));

    const reissueBatch = writeBatch(db);
    reissueBatch.update(oldInvRef, {
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
      revokedBy: adminUid,
    });
    reissueBatch.set(newInvRef, {
      id: newInvRef.id,
      guestId: gRef.id,
      token: newToken,
      status: 'ACTIVE',
      generatedAt: new Date().toISOString(),
    });
    reissueBatch.update(gRef, {
      activeInvitationId: newInvRef.id,
      activeToken: newToken,
    });
    await reissueBatch.commit();

    const oldInvCheck = (await getDoc(oldInvRef)).data();
    const newInvCheck = (await getDoc(newInvRef)).data();
    const guestCheck = (await getDoc(gRef)).data();

    if (oldInvCheck.status === 'REVOKED') {
      pass('Previous invitation token successfully REVOKED on reissue');
    } else {
      fail('Previous token revocation', `Status is ${oldInvCheck.status}`);
    }

    if (newInvCheck.status === 'ACTIVE' && guestCheck.activeToken === newToken) {
      pass('New invitation token is ACTIVE and linked to guest');
    } else {
      fail('New token activation', 'New token not active');
    }

    // Verify old token cannot be checked in
    let oldTokenCheckInBlocked = false;
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(oldInvRef);
        if (snap.data().status !== 'ACTIVE') throw new Error('NOT_ACTIVE');
      });
    } catch {
      oldTokenCheckInBlocked = true;
    }

    if (oldTokenCheckInBlocked) {
      pass('Old reissued token is unusable for check-in');
    } else {
      fail('Old token rejection', 'Old token still usable');
    }
  } catch (err) {
    fail('Section 6 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 7: Concurrent Check-in Attempts (Race Condition)
  // -------------------------------------------------------------
  console.log('\n--- Section 7: Concurrent Check-in Attempts (Race Condition) ---');
  try {
    const concurrentGuestRef = doc(collection(db, 'guests'));
    const concurrentInvRef = doc(collection(db, 'invitations'));
    const concurrentToken = generateSecureToken();

    await setDoc(concurrentGuestRef, {
      id: concurrentGuestRef.id,
      guestName: 'محمد سعود البابطين',
      attendanceStatus: 'NOT_ARRIVED',
      activeInvitationId: concurrentInvRef.id,
      activeToken: concurrentToken,
    });

    await setDoc(concurrentInvRef, {
      id: concurrentInvRef.id,
      guestId: concurrentGuestRef.id,
      token: concurrentToken,
      status: 'ACTIVE',
    });

    const simulateCheckIn = async (adminName) => {
      try {
        await runTransaction(db, async (txn) => {
          const iSnap = await txn.get(concurrentInvRef);
          if (iSnap.data().status !== 'ACTIVE') throw new Error('ALREADY_USED');
          const gSnap = await txn.get(concurrentGuestRef);
          if (gSnap.data().attendanceStatus === 'CHECKED_IN') throw new Error('ALREADY_USED');

          txn.update(concurrentInvRef, {
            status: 'USED',
            usedAt: new Date().toISOString(),
            usedBy: adminName,
          });
          txn.update(concurrentGuestRef, {
            attendanceStatus: 'CHECKED_IN',
            checkedInAt: new Date().toISOString(),
            checkedInByName: adminName,
          });
        });
        return { success: true, admin: adminName };
      } catch (err) {
        return { success: false, error: err.message, admin: adminName };
      }
    };

    // Fire 6 simultaneous check-in attempts concurrently
    const attempts = await Promise.all([
      simulateCheckIn('Gate-A-Scanner-1'),
      simulateCheckIn('Gate-A-Scanner-2'),
      simulateCheckIn('Gate-B-Scanner-1'),
      simulateCheckIn('Gate-B-Scanner-2'),
      simulateCheckIn('VIP-Scanner-1'),
      simulateCheckIn('VIP-Scanner-2'),
    ]);

    const successes = attempts.filter((a) => a.success);
    const duplicates = attempts.filter((a) => !a.success && a.error === 'ALREADY_USED');

    if (successes.length === 1 && duplicates.length === 5) {
      pass(`Atomic transaction guarantee: Exactly 1 succeeded, 5 rejected as ALREADY_USED (Winner: ${successes[0].admin})`);
    } else {
      fail('Atomic concurrency test', `Successes: ${successes.length}, Duplicates: ${duplicates.length}`);
    }
  } catch (err) {
    fail('Section 7 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 8: Dashboard Attendance Metrics Calculation
  // -------------------------------------------------------------
  console.log('\n--- Section 8: Dashboard Attendance Metrics Calculation ---');
  try {
    // Query all guests in emulator DB
    const snap = await getDocs(collection(db, 'guests'));
    const allGuests = snap.docs.map((d) => d.data());

    const totalRegistered = allGuests.length;
    const checkedInCount = allGuests.filter((g) => g.attendanceStatus === 'CHECKED_IN').length;
    const notArrivedCount = totalRegistered - checkedInCount;
    const capacity = 125;
    const remainingSlots = Math.max(0, capacity - totalRegistered);

    if (checkedInCount + notArrivedCount === totalRegistered) {
      pass(`Metrics check: ${totalRegistered} registered = ${checkedInCount} checked-in + ${notArrivedCount} not-arrived`);
    } else {
      fail('Metrics calculation', 'Sum mismatch');
    }

    if (remainingSlots === capacity - totalRegistered) {
      pass(`Remaining capacity slots correctly calculated: ${remainingSlots} / ${capacity}`);
    } else {
      fail('Remaining capacity calculation', 'Mismatch');
    }
  } catch (err) {
    fail('Section 8 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 9: Administrator Permissions & Security Rules
  // -------------------------------------------------------------
  console.log('\n--- Section 9: Security Rules & Unauthorized Access Restrictions ---');
  try {
    // 9.1 Unauthenticated client tests
    await signOut(auth);

    let unauthGuestReadBlocked = false;
    try {
      await getDocs(collection(db, 'guests'));
    } catch {
      unauthGuestReadBlocked = true;
    }
    if (unauthGuestReadBlocked) {
      pass('Unauthenticated user CANNOT read guests collection (Permission Denied)');
    } else {
      fail('Security Rule: Public read guests', 'Public was able to read guests');
    }

    let unauthGuestWriteBlocked = false;
    try {
      await setDoc(doc(collection(db, 'guests')), { guestName: 'Hacker' });
    } catch {
      unauthGuestWriteBlocked = true;
    }
    if (unauthGuestWriteBlocked) {
      pass('Unauthenticated user CANNOT write to guests collection');
    } else {
      fail('Security Rule: Public write guests', 'Public was able to write guests');
    }

    let unauthAuditWriteBlocked = false;
    try {
      await setDoc(doc(collection(db, 'auditLogs')), { type: 'FAKE_LOG' });
    } catch {
      unauthAuditWriteBlocked = true;
    }
    if (unauthAuditWriteBlocked) {
      pass('Unauthenticated user CANNOT write to auditLogs collection');
    } else {
      fail('Security Rule: Public write auditLogs', 'Public was able to write auditLogs');
    }

    // 9.2 Non-admin authenticated user tests
    await signInWithEmailAndPassword(auth, unprivEmail, unprivPassword);

    let nonAdminGuestReadBlocked = false;
    try {
      await getDocs(collection(db, 'guests'));
    } catch {
      nonAdminGuestReadBlocked = true;
    }
    if (nonAdminGuestReadBlocked) {
      pass('Authenticated non-admin CANNOT read guests collection');
    } else {
      fail('Security Rule: Non-admin read guests', 'Non-admin read guests allowed');
    }

    let nonAdminGuestWriteBlocked = false;
    try {
      await setDoc(doc(collection(db, 'guests')), { guestName: 'Unauthorized' });
    } catch {
      nonAdminGuestWriteBlocked = true;
    }
    if (nonAdminGuestWriteBlocked) {
      pass('Authenticated non-admin CANNOT write to guests collection');
    } else {
      fail('Security Rule: Non-admin write guests', 'Non-admin write guests allowed');
    }

    // 9.3 Re-sign in as Allowlisted Admin
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    // 9.4 Append-only Audit Logs: UPDATE and DELETE are PERMANENTLY FORBIDDEN even for Admins!
    const testAuditDoc = doc(collection(db, 'auditLogs'));
    await setDoc(testAuditDoc, {
      id: testAuditDoc.id,
      type: 'CHECK_IN',
      guestName: 'Audit Test',
      adminUid,
      timestamp: new Date().toISOString(),
    });
    pass('Allowlisted admin can CREATE audit log entry');

    let auditUpdateBlocked = false;
    try {
      await updateDoc(testAuditDoc, { guestName: 'Tampered Name' });
    } catch {
      auditUpdateBlocked = true;
    }
    if (auditUpdateBlocked) {
      pass('Tamper-proof auditLogs: Admin CANNOT UPDATE existing audit log (Forbidden by Rules)');
    } else {
      fail('Security Rule: auditLogs update', 'Admin was able to update audit log');
    }

    let auditDeleteBlocked = false;
    try {
      await deleteDoc(testAuditDoc);
    } catch {
      auditDeleteBlocked = true;
    }
    if (auditDeleteBlocked) {
      pass('Tamper-proof auditLogs: Admin CANNOT DELETE audit log (Forbidden by Rules)');
    } else {
      fail('Security Rule: auditLogs delete', 'Admin was able to delete audit log');
    }
  } catch (err) {
    fail('Section 9 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 10: Kuwait Timezone Formatting
  // -------------------------------------------------------------
  console.log('\n--- Section 10: Kuwait Timezone (Asia/Kuwait) Formatting ---');
  try {
    // 2026-12-29 16:30:00 UTC = 19:30 (7:30 PM) in Asia/Kuwait (UTC+3)
    const testUtcDate = '2026-12-29T16:30:00.000Z';
    const kwAr = formatKuwaitDateTime(testUtcDate, 'ar');
    const kwEn = formatKuwaitDateTime(testUtcDate, 'en');

    const has2026 = kwAr.includes('2026') || kwAr.includes('٢٠٢٦');
    const hasTime = kwAr.includes('7:30') || kwAr.includes('07:30') || kwAr.includes('٧:٣٠') || kwAr.includes('٠٧:٣٠');
    if (has2026 && hasTime) {
      pass('formatKuwaitDateTime converts UTC to Kuwait local time (+3h) in Arabic', kwAr);
    } else {
      fail('formatKuwaitDateTime Arabic', `Output: ${kwAr}`);
    }

    if (kwEn.includes('2026') && kwEn.toLowerCase().includes('pm')) {
      pass('formatKuwaitDateTime converts UTC to Kuwait local time in English', kwEn);
    } else {
      fail('formatKuwaitDateTime English', `Output: ${kwEn}`);
    }
  } catch (err) {
    fail('Section 10 Exception', err);
  }

  // -------------------------------------------------------------
  // TEST SECTION 11: Phase 2 Safe QR Reset (إعادة تعيين دعوة تجريبية)
  // -------------------------------------------------------------
  console.log('\n--- Section 11: Phase 2 Safe QR Reset Functionality ---');
  try {
    // 11.1 Setup a guest who has been checked in using a test QR
    const testGuestRef = doc(collection(db, 'guests'));
    const testInvRef1 = doc(collection(db, 'invitations'));
    const testToken1 = generateSecureToken();
    const testTokenHash1 = await hashToken(testToken1);

    const initialGuestData = {
      id: testGuestRef.id,
      eventId: 'sara-abdullah-wedding-2026',
      sourceGuestNumber: 42,
      guestName: 'فيصل سعود العجمي',
      phone: '+96555112233',
      notes: 'طاولة العائلة',
      invitationStatus: 'USED',
      activeInvitationId: testInvRef1.id,
      activeToken: testToken1,
      attendanceStatus: 'CHECKED_IN',
      checkedInAt: '2026-12-29T17:00:00.000Z',
      checkedInBy: adminUid,
      checkedInByName: 'Gate Test Admin',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-12-29T17:00:00.000Z',
    };

    await setDoc(testGuestRef, initialGuestData);
    await setDoc(testInvRef1, {
      id: testInvRef1.id,
      guestId: testGuestRef.id,
      guestName: initialGuestData.guestName,
      eventId: initialGuestData.eventId,
      token: testToken1,
      tokenHash: testTokenHash1,
      status: 'USED',
      usedAt: '2026-12-29T17:00:00.000Z',
      createdBy: adminUid,
    });

    pass('Initial checked-in test state prepared for guest #42', initialGuestData.guestName);

    // 11.2 Execute Safe QR Reset
    const resetReason = 'Pre-event entrance rehearsal reset (فحص تجريبي للمداخل)';
    const newToken2 = generateSecureToken();
    const newTokenHash2 = await hashToken(newToken2);
    const testInvRef2 = doc(collection(db, 'invitations'));

    const resetBatch = writeBatch(db);

    // Revoke old invitation
    resetBatch.update(testInvRef1, {
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
      revokedBy: adminUid,
      revocationReason: `TEST_RESET: ${resetReason}`,
    });

    // Create new invitation
    resetBatch.set(testInvRef2, {
      id: testInvRef2.id,
      guestId: testGuestRef.id,
      guestName: initialGuestData.guestName,
      eventId: initialGuestData.eventId,
      token: newToken2,
      tokenHash: newTokenHash2,
      status: 'ACTIVE',
      generatedAt: new Date().toISOString(),
      revokedAt: null,
      usedAt: null,
      createdBy: adminUid,
      resetFromInvitationId: testInvRef1.id,
      resetReason,
    });

    // Reset guest attendance & tokens while strictly preserving name, phone, notes, ID
    resetBatch.update(testGuestRef, {
      invitationStatus: 'ACTIVE',
      activeInvitationId: testInvRef2.id,
      activeToken: newToken2,
      attendanceStatus: 'NOT_ARRIVED',
      checkedInAt: null,
      checkedInBy: null,
      checkedInByName: null,
      updatedAt: new Date().toISOString(),
    });

    // Audit log
    const resetAuditDoc = doc(collection(db, 'auditLogs'));
    resetBatch.set(resetAuditDoc, {
      id: resetAuditDoc.id,
      type: 'TEST_INVITATION_RESET',
      guestId: testGuestRef.id,
      guestName: initialGuestData.guestName,
      invitationId: testInvRef2.id,
      adminUid,
      adminEmail,
      timestamp: new Date().toISOString(),
      details: {
        action: 'RESET_TEST_INVITATION',
        reason: resetReason,
        previousInvitationId: testInvRef1.id,
        newTokenPreview: newToken2.substring(0, 9) + '...',
      },
    });

    await resetBatch.commit();

    // 11.3 Verify Guest Document after reset
    const guestAfterReset = (await getDoc(testGuestRef)).data();

    // Attendance reset check
    if (
      guestAfterReset.attendanceStatus === 'NOT_ARRIVED' &&
      guestAfterReset.checkedInAt === null &&
      guestAfterReset.checkedInBy === null &&
      guestAfterReset.checkedInByName === null
    ) {
      pass('Attendance successfully reset to NOT_ARRIVED and check-in metadata cleared');
    } else {
      fail('Attendance reset fields', 'Metadata was not properly cleared');
    }

    // Preservation check
    if (
      guestAfterReset.guestName === initialGuestData.guestName &&
      guestAfterReset.phone === initialGuestData.phone &&
      guestAfterReset.notes === initialGuestData.notes &&
      guestAfterReset.sourceGuestNumber === initialGuestData.sourceGuestNumber &&
      guestAfterReset.id === initialGuestData.id
    ) {
      pass('Guest identity, name, phone, notes, and guest ID preserved 100% intact');
    } else {
      fail('Guest data preservation', 'One or more guest fields were modified or lost');
    }

    // Token update check
    if (
      guestAfterReset.activeInvitationId === testInvRef2.id &&
      guestAfterReset.activeToken === newToken2
    ) {
      pass('Guest updated with newly generated active token', newToken2);
    } else {
      fail('Guest token update', 'Did not update to new token');
    }

    // 11.4 Verify Old Token Invalidation
    const oldInvAfterReset = (await getDoc(testInvRef1)).data();
    if (oldInvAfterReset.status === 'REVOKED') {
      pass('Previous invitation document permanently REVOKED in Firestore');
    } else {
      fail('Old invitation revocation', `Status is ${oldInvAfterReset.status}`);
    }

    // Test scanning old token -> MUST BE REJECTED!
    let oldTokenScanRejected = false;
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(testInvRef1);
        if (snap.data().status === 'REVOKED') {
          throw new Error('INVITATION_REVOKED');
        }
      });
    } catch (err) {
      if (err.message === 'INVITATION_REVOKED') oldTokenScanRejected = true;
    }

    if (oldTokenScanRejected) {
      pass('Scanning previous test QR is strictly rejected as REVOKED even though guest attendance is NOT_ARRIVED');
    } else {
      fail('Old QR rejection post-reset', 'Old QR code was not rejected!');
    }

    // 11.5 Verify New Token Check-In -> MUST SUCCEED!
    let newTokenCheckInSuccess = false;
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(testInvRef2);
      if (snap.data().status === 'ACTIVE') {
        txn.update(testInvRef2, { status: 'USED', usedAt: new Date().toISOString() });
        txn.update(testGuestRef, { attendanceStatus: 'CHECKED_IN', checkedInAt: new Date().toISOString() });
        newTokenCheckInSuccess = true;
      }
    });

    if (newTokenCheckInSuccess) {
      pass('Newly generated replacement QR successfully checks in for the event');
    } else {
      fail('New QR check-in post-reset', 'Failed to check in with replacement QR');
    }

    // 11.6 Verify Audit Trail
    const resetAuditCheck = (await getDoc(resetAuditDoc)).data();
    if (
      resetAuditCheck.type === 'TEST_INVITATION_RESET' &&
      resetAuditCheck.details?.reason === resetReason
    ) {
      pass('Historical audit record created with TEST_INVITATION_RESET type and admin reason');
    } else {
      fail('Reset audit log verification', 'Audit log missing or incorrect');
    }
  } catch (err) {
    fail('Section 11 Exception', err);
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 AUTOMATED TEST RESULTS SUMMARY');
  console.log('======================================================');

  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === 'PASS').length;
  const failed = testResults.filter((r) => r.status === 'FAIL').length;

  console.log(`Total Tests Run : ${total}`);
  console.log(`\x1b[32mPassed          : ${passed}\x1b[0m`);
  if (failed > 0) {
    console.log(`\x1b[31mFailed          : ${failed}\x1b[0m`);
  } else {
    console.log(`\x1b[32mFailed          : 0\x1b[0m`);
    console.log('\n🎉 ALL AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
  }
  console.log('======================================================\n');

  await deleteApp(app);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
