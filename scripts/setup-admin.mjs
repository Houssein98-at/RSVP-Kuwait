import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const TARGET_PROJECT_ID = 'rsvp-kuwait-2026';
const DATABASE_ID = '(default)';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const IDENTITY_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${TARGET_PROJECT_ID}`;

// Helper: Ask question in terminal with optional password masking
function askQuestion(query, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      process.stdout.write(query);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0008' || char === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char === '\u0003') {
          process.exit();
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

// Parse command line arguments (--email and --password)
const args = process.argv.slice(2);
let emailArg = null;
let passArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) {
    emailArg = args[i + 1];
  }
  if (args[i] === '--password' && args[i + 1]) {
    passArg = args[i + 1];
  }
}

/**
 * Check for Firebase Admin SDK certificate or ADC credentials:
 * 1. serviceAccountKey.json in project root
 * 2. service-account.json in project root
 * 3. GOOGLE_APPLICATION_CREDENTIALS environment variable
 */
async function tryGetAdminSDK() {
  const possibleFiles = [
    path.join(projectRoot, 'serviceAccountKey.json'),
    path.join(projectRoot, 'service-account.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  for (const filePath of possibleFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (fileContent.type === 'service_account' && fileContent.private_key) {
          const { initializeApp, cert } = await import('firebase-admin/app');
          const { getAuth } = await import('firebase-admin/auth');
          const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

          const app = initializeApp({
            credential: cert(fileContent),
            projectId: fileContent.project_id || TARGET_PROJECT_ID,
          }, 'admin-setup-' + Date.now());

          return {
            type: 'admin-sdk',
            source: path.basename(filePath),
            auth: getAuth(app),
            db: getFirestore(app),
            FieldValue,
          };
        }
      } catch (err) {
        console.warn(`⚠️ Warning checking service account file (${filePath}):`, err.message);
      }
    }
  }

  // Try Application Default Credentials (ADC) if explicitly configured
  const adcDefaultPath = path.join(
    process.env.HOME || '',
    '.config',
    'gcloud',
    'application_default_credentials.json'
  );
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || fs.existsSync(adcDefaultPath)) {
    try {
      const { initializeApp, applicationDefault } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

      const app = initializeApp({
        credential: applicationDefault(),
        projectId: TARGET_PROJECT_ID,
      }, 'admin-setup-adc-' + Date.now());

      const auth = getAuth(app);
      await auth.listUsers(1);

      return {
        type: 'admin-sdk-adc',
        source: 'Application Default Credentials',
        auth,
        db: getFirestore(app),
        FieldValue,
      };
    } catch (_e) {
      // ADC not configured or invalid
    }
  }

  return null;
}

/**
 * Fallback to authorized Firebase CLI OAuth2 token with proactive refresh:
 * Ensures the token is fresh and never expired to avoid 401 ACCESS_TOKEN_TYPE_UNSUPPORTED
 */
async function tryGetCLIToken() {
  const configPath = path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  let fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let token = fbConfig.tokens?.access_token;
  const expiresAt = fbConfig.tokens?.expires_at || 0;

  // If token is expired or expires in less than 2 minutes, proactively refresh via Firebase CLI
  if (!token || Date.now() > expiresAt - 120000) {
    try {
      execSync('npx -y firebase-tools@latest projects:list', {
        stdio: 'ignore',
        timeout: 20000,
      });
      fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      token = fbConfig.tokens?.access_token;
    } catch (_e) {
      // CLI refresh command error
    }
  }

  if (!token) {
    return null;
  }

  // Verify token authorization against Firestore REST endpoint
  try {
    const testRes = await fetch(`${FIRESTORE_BASE}/admins?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (testRes.status === 200 || testRes.status === 404) {
      return {
        type: 'cli-oauth',
        token,
      };
    }
  } catch (_e) {
    // Network or token failure
  }

  return null;
}

/**
 * Execute admin setup via Firebase Admin SDK
 */
async function setupWithAdminSDK(adminSDK, email, password) {
  const { auth, db, FieldValue } = adminSDK;
  let uid = null;
  let displayName = email.split('@')[0];

  // 1. Idempotent check for existing user in Firebase Auth
  try {
    const existingUser = await auth.getUserByEmail(email);
    uid = existingUser.uid;
    displayName = existingUser.displayName || displayName;
    console.log(`✔ Found existing Firebase Auth account for: ${email}`);
    console.log(`  UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`Account for ${email} does not exist yet. Creating a new account...`);
      let pass = password;
      if (!pass) {
        pass = await askQuestion('Enter Administrator Password (min 6 chars): ', true);
        if (!pass || pass.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
      }

      const newUser = await auth.createUser({
        email,
        password: pass,
        displayName,
      });
      uid = newUser.uid;
      console.log(`✔ Created new Firebase Auth account (UID: ${uid})`);
    } else {
      throw err;
    }
  }

  // 2. Register UID in Firestore /admins/{uid} allowlist
  console.log('⏳ Registering UID on Firestore /admins allowlist...');
  const adminDocRef = db.collection('admins').doc(uid);
  const snap = await adminDocRef.get();

  const docData = {
    uid: uid,
    email: email,
    displayName: displayName,
    role: 'admin',
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    docData.createdAt = FieldValue.serverTimestamp();
  }

  await adminDocRef.set(docData, { merge: true });
  console.log('✔ Admin document successfully written to Firestore');

  // 3. Write tamper-proof audit log entry
  try {
    await db.collection('auditLogs').add({
      type: 'ADMIN_SETUP',
      guestId: 'ADMIN_SETUP',
      guestName: `Admin Setup: ${email}`,
      adminUid: uid,
      adminEmail: email,
      timestamp: FieldValue.serverTimestamp(),
      details: {
        action: snap.exists ? 'ADMIN_ALLOWLIST_RECONFIRMED' : 'INITIAL_ADMIN_ALLOWLIST_REGISTRATION',
        role: 'admin',
        active: true,
      },
    });
  } catch (_e) {
    // Non-fatal audit log notice
  }

  // 4. Verify administrator allowlist lookup
  console.log('⏳ Verifying administrator allowlist lookup...');
  const verifySnap = await adminDocRef.get();
  if (!verifySnap.exists) {
    throw new Error(`Verification failed: Document /admins/${uid} not found.`);
  }

  const vData = verifySnap.data();
  if (vData.role !== 'admin' || vData.active !== true) {
    throw new Error(`Verification failed: role/active mismatch: ${JSON.stringify(vData)}`);
  }
  console.log('✔ Verification passed: document exists, role === "admin", active === true');

  return uid;
}

/**
 * Execute admin setup via Authorized Firebase CLI OAuth Token
 */
async function setupWithCLI(cliAuth, email, password) {
  const { token } = cliAuth;
  let uid = null;
  let displayName = email.split('@')[0];

  // 1. Idempotently look up existing user in Identity Platform (NO client web API key used!)
  const lookupRes = await fetch(`${IDENTITY_BASE}/accounts:lookup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: [email] }),
  });

  if (lookupRes.ok) {
    const lookupData = await lookupRes.json();
    if (lookupData.users && lookupData.users.length > 0) {
      uid = lookupData.users[0].localId;
      displayName = lookupData.users[0].displayName || displayName;
      console.log(`✔ Found existing Firebase Auth account for: ${email}`);
      console.log(`  UID: ${uid}`);
    }
  }

  // 2. If user does not exist, create using authorized Identity Platform endpoint
  if (!uid) {
    console.log(`Account for ${email} does not exist yet. Creating a new account...`);
    let pass = password;
    if (!pass) {
      pass = await askQuestion('Enter Administrator Password (min 6 chars): ', true);
      if (!pass || pass.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
    }

    const createRes = await fetch(`${IDENTITY_BASE}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: pass,
        displayName,
      }),
    });

    if (!createRes.ok) {
      const errTxt = await createRes.text();
      throw new Error(`Failed to create Firebase Auth user: ${createRes.status} ${errTxt}`);
    }

    const createData = await createRes.json();
    uid = createData.localId;
    console.log(`✔ Created new Firebase Auth account (UID: ${uid})`);
  }

  // 3. Register UID in Firestore /admins/{uid} allowlist
  console.log('⏳ Registering UID on Firestore /admins allowlist...');
  const now = new Date().toISOString();
  const url = `${FIRESTORE_BASE}/admins/${uid}`;

  const body = {
    fields: {
      uid: { stringValue: uid },
      email: { stringValue: email },
      displayName: { stringValue: displayName },
      role: { stringValue: 'admin' },
      active: { booleanValue: true },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    },
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write admin document: ${res.status} ${err}`);
  }
  console.log('✔ Admin document successfully written to Firestore');

  // 4. Write tamper-proof audit log entry
  try {
    await fetch(`${FIRESTORE_BASE}/auditLogs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          type: { stringValue: 'ADMIN_SETUP' },
          guestId: { stringValue: 'ADMIN_SETUP' },
          guestName: { stringValue: `Admin Setup: ${email}` },
          adminUid: { stringValue: uid },
          adminEmail: { stringValue: email },
          timestamp: { timestampValue: now },
          details: { mapValue: { fields: { action: { stringValue: 'ADMIN_ALLOWLIST_REGISTRATION' } } } },
        },
      }),
    });
  } catch (_e) {
    // Non-fatal
  }

  // 5. Verify administrator allowlist lookup
  console.log('⏳ Verifying administrator allowlist lookup...');
  const verifyRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!verifyRes.ok) {
    throw new Error(`Verification failed: HTTP ${verifyRes.status}`);
  }

  const vData = await verifyRes.json();
  const fields = vData.fields || {};
  if (fields.role?.stringValue !== 'admin' || fields.active?.booleanValue !== true) {
    throw new Error(`Verification failed: role/active mismatch: ${JSON.stringify(fields)}`);
  }
  console.log('✔ Verification passed: document exists, role === "admin", active === true');

  return uid;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   👑 RSVP-Kuwait — Secure Admin Account Setup Wizard     ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`🎯 Target Firebase Project: ${TARGET_PROJECT_ID}`);

  // Resolve authorization
  console.log('⏳ Resolving administrative authorization...');
  const adminSDK = await tryGetAdminSDK();
  const cliAuth = !adminSDK ? await tryGetCLIToken() : null;

  if (!adminSDK && !cliAuth) {
    console.error('\n❌ No valid administrative credentials found.');
    console.error('─────────────────────────────────────────────────────────────────────────────');
    console.error('To grant the admin setup script authorization to manage Firebase Auth & Firestore:');
    console.error('');
    console.error('Method A (Recommended — Service Account):');
    console.error('  1. Open Firebase Console:');
    console.error(`     👉 https://console.firebase.google.com/project/${TARGET_PROJECT_ID}/settings/serviceaccounts/adminsdk`);
    console.error('  2. Click "Generate new private key".');
    console.error('  3. Save the downloaded JSON file into the project directory as:');
    console.error(`     📄 ${path.join(projectRoot, 'serviceAccountKey.json')}`);
    console.error('     (Protected by .gitignore — never committed)');
    console.error('');
    console.error('Method B (Firebase CLI Login):');
    console.error('  Run: npx -y firebase-tools@latest login');
    console.error('─────────────────────────────────────────────────────────────────────────────\n');
    process.exit(1);
  }

  let email = emailArg;
  if (!email) {
    email = await askQuestion('Enter Administrator Email [admin@rsvp-kuwait.com]: ');
    if (!email) email = 'admin@rsvp-kuwait.com';
  }
  email = email.trim().toLowerCase();

  let uid = null;
  if (adminSDK) {
    console.log(`✔ Using Firebase Admin SDK (${adminSDK.source})`);
    uid = await setupWithAdminSDK(adminSDK, email, passArg);
  } else {
    console.log('✔ Using Authorized Firebase CLI Session (Guaranteed Fresh Token)');
    uid = await setupWithCLI(cliAuth, email, passArg);
  }

  console.log('\n🎉 Administrator account successfully verified and allowlisted!');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`Project: ${TARGET_PROJECT_ID}`);
  console.log(`Email:   ${email}`);
  console.log(`UID:     ${uid}`);
  console.log(`Role:    admin`);
  console.log(`Active:  true`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('\nYou can now log in to the RSVP-Kuwait portal at:');
  console.log('➜ http://localhost:5173/');
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch((err) => {
  console.error('\n❌ Fatal Setup Error:', err.message);
  process.exit(1);
});
