import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read Firebase token from configstore
const configPath = path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('Firebase CLI config not found. Please run: npx -y firebase-tools@latest login');
  process.exit(1);
}

const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = fbConfig.tokens?.access_token;
if (!token) {
  console.error('Firebase access token missing. Please run: npx -y firebase-tools@latest login');
  process.exit(1);
}

const PROJECT_ID = 'rsvp-kuwait-2026';
const DATABASE_ID = '(default)';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Parse CSV
const csvPath = path.join(projectRoot, 'sample_guests_65.csv');
if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found:', csvPath);
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
const rows = lines.slice(1); // Skip header

console.log(`📋 Found ${rows.length} guest records in ${path.basename(csvPath)}.`);

async function checkExistingGuests() {
  const res = await fetch(`${FIRESTORE_BASE}/guests?pageSize=150`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to check existing guests: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.documents || [];
}

async function createGuestDocument(guestNum, guestName, phone) {
  const now = new Date().toISOString();
  const body = {
    fields: {
      sourceGuestNumber: { integerValue: String(guestNum) },
      guestName: { stringValue: guestName },
      phone: { stringValue: phone || '' },
      notes: { stringValue: '' },
      eventId: { stringValue: 'sara-abdullah-wedding-2026' },
      invitationStatus: { stringValue: 'NOT_GENERATED' },
      attendanceStatus: { stringValue: 'NOT_ARRIVED' },
      activeInvitationId: { nullValue: null },
      activeToken: { nullValue: null },
      checkedInAt: { nullValue: null },
      checkedInBy: { nullValue: null },
      checkedInByName: { nullValue: null },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    }
  };

  const res = await fetch(`${FIRESTORE_BASE}/guests`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create guest ${guestName}: ${res.status} ${err}`);
  }
  return await res.json();
}

async function writeAuditLog(count) {
  const now = new Date().toISOString();
  const body = {
    fields: {
      type: { stringValue: 'CSV_IMPORT' },
      guestId: { stringValue: 'BULK_IMPORT' },
      guestName: { stringValue: `Initial Import of ${count} Guests` },
      adminUid: { stringValue: 'CLI_SETUP' },
      adminEmail: { stringValue: 'system@rsvp-kuwait.com' },
      timestamp: { timestampValue: now },
      details: {
        mapValue: {
          fields: {
            importedCount: { integerValue: String(count) },
            source: { stringValue: 'sample_guests_65.csv' }
          }
        }
      }
    }
  };

  await fetch(`${FIRESTORE_BASE}/auditLogs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

async function run() {
  try {
    const existing = await checkExistingGuests();
    if (existing.length > 0) {
      console.log(`⚠️ Database already contains ${existing.length} guest records.`);
      console.log('Skipping import to prevent duplicate entries.');
      return;
    }

    console.log(`⏳ Importing ${rows.length} guests into Firestore...`);
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const line = rows[i];
      const parts = line.split(',');
      const guestNum = parseInt(parts[0], 10) || (i + 1);
      const guestName = parts[1]?.trim() || '';
      const phone = parts[2]?.trim() || '';

      if (guestName) {
        await createGuestDocument(guestNum, guestName, phone);
        imported++;
        process.stdout.write(`\rImported ${imported}/${rows.length} guests...`);
      }
    }

    console.log(`\n✅ Successfully imported all ${imported} guests into Firestore!`);
    await writeAuditLog(imported);
    console.log('📝 Audit log recorded.');
  } catch (err) {
    console.error('\n❌ Import error:', err.message);
    process.exit(1);
  }
}

run();
