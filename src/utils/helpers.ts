import confetti from 'canvas-confetti';

/**
 * Normalizes Kuwait phone numbers.
 * Accepts:
 *  - 8-digit numbers e.g. 99123456, 50123456, 66123456
 *  - Numbers with country code e.g. +96599123456, 0096599123456, 96599123456
 *  - Returns normalized format: "+965XXXXXXXX"
 *  - If empty, returns valid (as phone is optional)
 */
export function normalizeKuwaitPhone(rawPhone?: string): { isValid: boolean; normalized: string; error?: string } {
  if (!rawPhone || !rawPhone.trim()) {
    return { isValid: true, normalized: '' };
  }

  // Remove spaces, dashes, parentheses
  const cleaned = rawPhone.trim().replace(/[\s\-()]/g, '');

  // Check if international format starting with +965 or 00965
  let digits = cleaned;
  if (digits.startsWith('+965')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('00965')) {
    digits = digits.substring(5);
  } else if (digits.startsWith('965') && digits.length === 11) {
    digits = digits.substring(3);
  }

  // Digits should now be exactly 8 digits
  if (!/^\d{8}$/.test(digits)) {
    return {
      isValid: false,
      normalized: rawPhone,
      error: 'رقم الهاتف الكويتي يجب أن يتكون من 8 أرقام (Kuwait phone must be 8 digits)',
    };
  }

  return {
    isValid: true,
    normalized: `+965${digits}`,
  };
}

/**
 * Format timestamp in Asia/Kuwait timezone
 */
export function formatKuwaitDateTime(dateInput: string | number | Date | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!dateInput) return lang === 'ar' ? 'غير مسجل' : 'Not recorded';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-KW' : 'en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Clean and extract raw token from QR code payload or URL
 */
export function extractTokenFromPayload(payload: string): string {
  const clean = payload.trim();
  const match = clean.match(/SA26-[A-F0-9]{32}/i);
  if (match) return match[0].toUpperCase();

  const lastSegment = clean.split('/').pop()?.split('?')[0];
  if (lastSegment && lastSegment.startsWith('SA26-')) {
    return lastSegment.toUpperCase();
  }

  return clean;
}

/**
 * Generate a cryptographically secure, unpredictable invitation token.
 * Never based on sequential IDs, names, or phones.
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  const randomHex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `SA26-${randomHex.toUpperCase()}`;
}

/**
 * Calculate SHA-256 hash of a string
 */
export async function hashToken(token: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback simple hash for non-crypto environments
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16)}`;
  }

  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synthesize audio cues using Web Audio API (no external asset downloads required)
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playAudioFeedback(type: 'success' | 'warning' | 'error') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'success') {
      // Luxury celebratory chord (C5, E5, G5, C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.55);
      });
    } else if (type === 'warning') {
      // Double low buzzer for already used
      [220, 196].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.25, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.13);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.14);
      });
    } else {
      // Low error sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
}

/**
 * Celebratory luxury confetti effect for confirmed VIP entrance
 */
export function triggerCelebrationConfetti() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#B8974A', '#E7DCBE', '#C7AC6E', '#1D4D3E', '#FDFCF9'],
      disableForReducedMotion: true,
    });
  } catch (err) {
    console.warn('Confetti error:', err);
  }
}

/**
 * WhatsApp invitation message builder
 */
export function buildWhatsAppMessage(
  guestName: string, 
  invitationUrl: string
): string {
  const message = `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ

يتشرفون بدعوة الكريم / الكريمة:
*${guestName}*

لحضور حفل عقد قران:
*ساره وعبدالله*

📅 الثلاثاء 29 ديسمبر 2026
⏰ الساعة 7:30 مساءً
📍 قاعة النرجس — فندق والدورف أستوريا، الكويت

🎫 رابط بطاقة الدعوة ورمز الدخول الخاص بكم:
${invitationUrl}

يرجى إبراز رمز الدعوة عند الدخول.
حضوركم يشرفنا ويسعدنا.`;

  return encodeURIComponent(message);
}
