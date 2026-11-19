import { ClubAuthConfig, ClubDataState, Member } from '../types';

export const PIN_PBKDF2_ITERATIONS = 100000;
export const ADMIN_EMAIL = 'peytonle238@gmail.com';
const SCHOOL_ID_SALT = 'bnhs-pickleball-school-id-v1:';
const PIN_RATE_LIMIT_KEY = 'bnhs_pin_rate_limit_v1';
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30_000;

export const DEFAULT_OFFICER_PIN = '9002';
export const DEFAULT_PRESIDENT_PASSWORD = '8855';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateHexSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Derives a 64-char hex PBKDF2-HMAC-SHA256 hash for an Officer PIN or President Password.
 */
export async function derivePinHash(
  secret: string,
  saltHex: string,
  iterations = PIN_PBKDF2_ITERATIONS
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = hexToBytes(saltHex);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

export async function createClubAuthConfig(params: {
  clubId: string;
  officerPin: string;
  presidentPassword: string;
  iterations?: number;
}): Promise<ClubAuthConfig> {
  const iterations = params.iterations ?? PIN_PBKDF2_ITERATIONS;
  const salt = generateHexSalt(16);
  const [officerPinHash, presidentPasswordHash] = await Promise.all([
    derivePinHash(params.officerPin, salt, iterations),
    derivePinHash(params.presidentPassword, salt, iterations),
  ]);
  return {
    clubId: params.clubId,
    salt,
    iterations,
    officerPinHash,
    presidentPasswordHash,
  };
}

export interface PinVerificationResult {
  valid: boolean;
  isOfficer: boolean;
  isPresident: boolean;
}

/**
 * Verifies an entered PIN/password against the Firestore-isolated PBKDF2 ClubAuthConfig.
 * Falls back to legacy/default pins ONLY when ClubAuthConfig has not yet been initialized.
 */
export async function verifyPinAgainstAuthConfig(
  enteredRaw: string,
  authConfig: ClubAuthConfig | null,
  legacyFallback?: { officerPin?: string; presidentPassword?: string }
): Promise<PinVerificationResult> {
  const entered = enteredRaw.trim();
  if (!entered) {
    return { valid: false, isOfficer: false, isPresident: false };
  }

  if (authConfig && authConfig.salt && authConfig.officerPinHash && authConfig.presidentPasswordHash) {
    const derived = await derivePinHash(
      entered,
      authConfig.salt,
      authConfig.iterations || PIN_PBKDF2_ITERATIONS
    );
    const isPresident = timingSafeEqualHex(derived, authConfig.presidentPasswordHash);
    const isOfficer =
      isPresident || timingSafeEqualHex(derived, authConfig.officerPinHash);
    return { valid: isOfficer, isOfficer, isPresident };
  }

  // Fallback before initial /clubAuthConfig document has been provisioned by admin
  const fallbackPres = (
    legacyFallback?.presidentPassword || DEFAULT_PRESIDENT_PASSWORD
  ).trim();
  const fallbackOff = (
    legacyFallback?.officerPin || DEFAULT_OFFICER_PIN
  ).trim();
  const isPresident = entered === fallbackPres;
  const isOfficer = isPresident || entered === fallbackOff;
  return { valid: isOfficer, isOfficer, isPresident };
}

/**
 * Salted SHA-256 hash of a student's School ID (case-insensitive, trimmed).
 * Allows deterministic matching across devices without exposing plaintext student IDs.
 */
export async function hashSchoolId(rawSchoolId: string): Promise<string> {
  const normalized = rawSchoolId.trim().toLowerCase();
  if (!normalized) return '';
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`${SCHOOL_ID_SALT}${normalized}`)
  );
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Masks a student School ID for non-sensitive UI display (e.g., "123456" -> "••••56").
 */
export function maskSchoolId(rawSchoolId: string): string {
  const trimmed = rawSchoolId.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 2) return '••••';
  return `••••${trimmed.slice(-2)}`;
}

export function hasVerifiedSchoolId(member: Member | null | undefined): boolean {
  if (!member) return false;
  return Boolean(
    (member.schoolIdHash && member.schoolIdHash.trim()) ||
      (member.schoolId && member.schoolId.trim())
  );
}

export function memberMatchesSchoolIdHash(
  member: Member,
  targetHash: string,
  normalizedRaw?: string
): boolean {
  if (member.schoolIdHash && targetHash) {
    if (timingSafeEqualHex(member.schoolIdHash, targetHash)) {
      return true;
    }
  }
  if (normalizedRaw && member.schoolId && member.schoolId.trim()) {
    return member.schoolId.trim().toLowerCase() === normalizedRaw;
  }
  return false;
}

/**
 * Migrates any legacy members that still have a plaintext `schoolId` into `schoolIdHash` + `schoolIdMasked`
 * and strips the plaintext `schoolId`.
 */
export async function migrateLegacyMemberSchoolIds(
  members: Member[]
): Promise<{ members: Member[]; migrated: boolean }> {
  let migrated = false;
  const nextMembers = await Promise.all(
    members.map(async (m) => {
      if (m.schoolId && m.schoolId.trim()) {
        migrated = true;
        const hash = m.schoolIdHash || (await hashSchoolId(m.schoolId));
        const masked = m.schoolIdMasked || maskSchoolId(m.schoolId);
        const { schoolId: _removed, ...rest } = m;
        return {
          ...rest,
          schoolIdHash: hash,
          schoolIdMasked: masked,
        };
      }
      if ('schoolId' in m && m.schoolId !== undefined) {
        migrated = true;
        const { schoolId: _removed, ...rest } = m;
        return rest;
      }
      return m;
    })
  );
  return { members: nextMembers, migrated };
}

/**
 * Strips all plaintext credentials (`officerPin`, `presidentPassword`) and raw student `schoolId`
 * values from a ClubDataState object before writing to Firestore, localStorage, or JSON export.
 */
export function stripSecretsFromClubState(state: ClubDataState): ClubDataState {
  const {
    officerPin: _pin,
    presidentPassword: _pres,
    ...cleanSettings
  } = state.settings;

  const cleanMembers = (state.members || []).map((m) => {
    if (!('schoolId' in m)) return m;
    const { schoolId: _rawId, ...rest } = m;
    return rest;
  });

  return {
    ...state,
    settings: cleanSettings,
    members: cleanMembers,
  };
}

// ============================================================================
// Progressive PIN Rate Limiter (sessionStorage)
// ============================================================================
interface RateLimitState {
  failures: number;
  lockedUntil: number;
}

function readRateLimitState(): RateLimitState {
  try {
    const raw = sessionStorage.getItem(PIN_RATE_LIMIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.failures === 'number' &&
        typeof parsed.lockedUntil === 'number'
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore sessionStorage errors
  }
  return { failures: 0, lockedUntil: 0 };
}

function writeRateLimitState(next: RateLimitState): void {
  try {
    sessionStorage.setItem(PIN_RATE_LIMIT_KEY, JSON.stringify(next));
  } catch {
    // Ignore sessionStorage errors
  }
}

export function checkPinRateLimit(): {
  blocked: boolean;
  remainingSeconds: number;
} {
  const state = readRateLimitState();
  const now = Date.now();
  if (state.lockedUntil > now) {
    return {
      blocked: true,
      remainingSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
    };
  }
  return { blocked: false, remainingSeconds: 0 };
}

export function recordFailedPinAttempt(): {
  blocked: boolean;
  remainingSeconds: number;
  attemptsRemaining: number;
} {
  const now = Date.now();
  const prev = readRateLimitState();
  const baseFailures = prev.lockedUntil > 0 && prev.lockedUntil <= now ? 0 : prev.failures;
  const failures = baseFailures + 1;
  if (failures >= MAX_FAILED_PIN_ATTEMPTS) {
    const lockedUntil = now + PIN_LOCKOUT_MS;
    writeRateLimitState({ failures, lockedUntil });
    return {
      blocked: true,
      remainingSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000),
      attemptsRemaining: 0,
    };
  }
  writeRateLimitState({ failures, lockedUntil: 0 });
  return {
    blocked: false,
    remainingSeconds: 0,
    attemptsRemaining: MAX_FAILED_PIN_ATTEMPTS - failures,
  };
}

export function clearPinRateLimit(): void {
  try {
    sessionStorage.removeItem(PIN_RATE_LIMIT_KEY);
  } catch {
    // Ignore
  }
}

export function isVerifiedGoogleAdmin(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined
): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL;
}
