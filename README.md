# Sara & Abdullah — Private Wedding Contract Invitation & Entrance Scanner System
# حفل عقد قران ساره وعبدالله — نظام إدارة الدعوات ومسح الدخول

A production-ready, luxury event invitation and entrance check-in application built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Firebase** (Authentication + Cloud Firestore), designed for deployment to **GitHub Pages**.

---

## 📅 Event Information

- **Event Title (Arabic):** حفل عقد قران
- **Couple Names:** ساره وعبدالله (Sara & Abdullah)
- **Date:** Tuesday, 29 December 2026 (الثلاثاء 29 ديسمبر 2026)
- **Time:** 7:30 PM (7:30 مساءً)
- **Time Zone:** `Asia/Kuwait` (+03:00)
- **Venue:** النرجس — والدورف أستوريا، الكويت (AL NARJIS — WALDORF ASTORIA, Kuwait)
- **Guest Capacity:** 125 guests
- **Phone Country Code:** `+965` (Kuwait)

---

## 🏛️ Project Architecture & Key Features

### 1. Dashboard (Tab 1 — لوحة التحكم)
- **Live Event Metrics:** Calculated strictly from real database records:
  - Total Guest Capacity (125)
  - Registered Guests
  - Remaining Available Slots
  - Invitations Issued vs. Pending Generation
  - Checked-In Guests vs. Not Yet Arrived
  - Revoked Invitations
  - Most Recent Live Arrivals ticker
- **Searchable & Filterable Table:**
  - Real-time search across guest names, Kuwait phone numbers, and unique QR tokens.
  - Filter by invitation status (`ACTIVE`, `NOT_GENERATED`, `USED`, `REVOKED`) and attendance status (`CHECKED_IN`, `NOT_ARRIVED`).
  - Actions: View/Download Invitation Card, Manual Check-In, Reverse Check-In (with explicit confirmation and tamper-proof audit log), Reissue QR, Revoke QR, Edit Details, Delete Record.
  - Kuwait local time formatting (`Asia/Kuwait`).
  - One-click CSV Export for administrative auditing.

### 2. Guest Management & QR Generator (Tab 2 — إدارة الضيوف وتوليد الرموز)
- **Single-Field Arabic Guest Name:** Full support for formal Kuwaiti honorifics (الشيخ, معالي, د., etc.) and nicknames without splitting names into first/last.
- **Kuwait Phone Validation:** Normalizes 8-digit mobile numbers (`+965XXXXXXXX`). Phone is optional.
- **Capacity Safeguard:** Strictly prevents registration beyond 125 active guests.
- **Cryptographic QR Tokens:** Unpredictable high-entropy tokens (`SA26-[HEX]`), stored with SHA-256 hash. Reissuing invalidates any previous token.
- **High-Resolution Downloadable Card:** Canvas-rendered luxury Arabic invitation (1080x1500 px, gold ornate borders, Arabic calligraphy header, couple names, venue, guest name, and crisp QR code).
- **Multi-Channel Sharing:**
  - Native Mobile Share Sheet (`navigator.share` with image file attached on iOS Safari & Android Chrome).
  - WhatsApp Sharing with personalized Arabic invitation text.
  - One-click Invitation Link copy.
- **Bulk CSV Import:** Upload CSV with headers `guest_number`, `guest_name`, `phone`. Preserves Arabic UTF-8, row order, separate rows even for identical names, validation preview before writing to Firestore.

### 3. Entrance Scanner (Tab 3 — ماسح الدخول)
- **Camera-Based QR Scanner:** Powered by `html5-qrcode`.
- **Mobile-Optimized:** Back camera default (`environment`), camera switching, torch/flashlight toggle, animated gold laser viewfinder.
- **Audio & Visual Feedback:** Synthesized Web Audio API celebratory victory chords for verified guests, buzzer for re-entry attempts.
- **Atomic Concurrency Protection:** Check-in executed via Firestore `runTransaction`:
  - If two receptionists scan the exact same code simultaneously, Firestore guarantees at most **ONE** check-in succeeds.
  - Duplicate scans display a bold warning banner: **"تم استخدام الدعوة مسبقًا / ALREADY USED"** along with original check-in timestamp in Kuwait local time.
- **Manual Lookup Fallback:** Door receptionists can quickly search by name or phone to check in guests manually if their phone screen is damaged.

### 4. Public Digital Pass Route (`/#/invitation/:token`)
- If a guest opens their QR link using a standard smartphone camera outside the admin app, it displays an elegant read-only digital pass with the couple names, date, venue, guest name, and entry instructions.
- **NEVER** consumes the invitation or changes attendance status.
- Does **NOT** expose personal phone numbers, notes, or admin controls.

---

## 🔒 Security & Admin Allowlist

The system is strictly **ADMIN ONLY**:
- **No public registration.**
- All management features are protected by Firebase Authentication.
- Administrators must be explicitly allowlisted in Firestore under `/admins/{uid}` with `{ role: 'admin', active: true }`.
- Firestore Security Rules enforce this at the database level: non-admin accounts and unauthenticated requests are denied access to guests, check-ins, and audit logs.
- Append-only `auditLogs` collection records all check-ins, reversals, revocations, and reissues.

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Firebase Project Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (e.g. `rsvp-kuwait-sara-abdullah`).
2. **Enable Authentication:**
   - Go to **Build** -> **Authentication** -> **Get Started**.
   - Under **Sign-in method**, enable **Email/Password** (Email link is not needed).
   - Under **Users**, click **Add user** and create your primary admin account (e.g. `admin@sara-abdullah.com` and a strong password).
3. **Enable Cloud Firestore:**
   - Go to **Build** -> **Firestore Database** -> **Create database**.
   - Choose a location (e.g., `europe-west1` or `nam5`).
   - Start in **Production mode**.
4. **Deploy Security Rules:**
   - Copy the contents of `firestore.rules` into **Firestore Database** -> **Rules** tab, and click **Publish**.
5. **Register Web App:**
   - In Project Settings -> General -> **Your apps**, click the Web icon `</>` to register a web app.
   - Copy your Firebase config object.

### Step 2: Local Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Firebase web app keys in `.env`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=1:...
   VITE_BASE_PATH=./
   ```

### Step 3: Run the Application Locally

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run local development server
npm run dev

# Or build production bundle
npm run build
npm run preview
```

### Step 4: First-Time Admin Bootstrap

1. Open the website in your browser (e.g., `http://localhost:5173`).
2. Sign in with the admin email and password created in Firebase Console.
3. The system will detect that no admins exist in `/admins` yet, and will display the **"Admin Setup Bootstrap"** prompt.
4. Click **"اعتماد حسابي كمسؤول رئيسي (Bootstrap Admin)"** to register your UID on the allowlist.
5. All administrative features (Dashboard, Guest Management, Scanner) will unlock immediately!

---

## 🌐 GitHub Pages Deployment via GitHub Actions

This repository includes an automated workflow at `.github/workflows/deploy.yml`.

### Deployment Steps:

1. Push your repository to GitHub.
2. Go to **Settings** -> **Secrets and variables** -> **Actions** in your GitHub repository.
3. Add the following repository secrets matching your `.env` values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Go to **Settings** -> **Pages**:
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.
5. Push a commit to `main` or trigger the workflow manually from the **Actions** tab.
6. Your RSVP site will be published at `https://<username>.github.io/<repository-name>/`.

---

## 📋 Initial Guest Dataset (65 Guests)

A template dataset containing 65 Kuwaiti guest entries is available in the root folder:
- File: `sample_guests_65.csv`
- Format: `guest_number,guest_name,phone`
- Can be uploaded directly into the **Guest Management & QR Generator** tab using the **"استيراد جماعي (CSV)"** button.

---

## 🛠️ Tech Stack Summary

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS (Luxury Ivory & Champagne-Gold Palette) |
| **Typography** | Google Fonts (Amiri, Cairo, Tajawal, Playfair Display, Outfit) |
| **Routing** | React Router (`HashRouter` for GitHub Pages subpath compatibility) |
| **Authentication** | Firebase Auth (Email & Password, Admin Allowlist by UID) |
| **Database** | Firebase Cloud Firestore (Real-time `onSnapshot`, `runTransaction`) |
| **QR Generation** | `qrcode` (HTML5 Canvas export to 1080x1500 PNG) |
| **QR Scanner** | `html5-qrcode` (Phone Camera with Rear lens preference & Torch) |
| **Audio & Effects** | Web Audio API Synthesizer + `canvas-confetti` |
| **Hosting & CI/CD** | GitHub Pages + GitHub Actions |

---

*حفل عقد قران ساره وعبدالله — النرجس، فندق والدورف أستوريا، الكويت 2026*
