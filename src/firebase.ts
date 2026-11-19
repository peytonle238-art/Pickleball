import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ClubAuthConfig, ClubDataState, Member } from './types';
import { stripSecretsFromClubState } from './utils/securityUtils';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const GLOBAL_CLUB_WORKSPACE_ID = 'bnhs_global_club';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Blueprint validation constants & regexes (Verbatim from firebase-blueprint.json)
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;
const DATE_ISO_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const MAX_PAYLOAD_LENGTH = 940000;

export function sanitizeId(raw: string, maxLen = 64): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, maxLen);
  return SAFE_ID_REGEX.test(cleaned) && cleaned.length >= 1
    ? cleaned
    : 'item-1';
}

export function sanitizeString(
  raw: string,
  maxLen: number,
  fallback = 'Club Item'
): string {
  const trimmed = (raw || '').trim().slice(0, maxLen);
  return trimmed.length >= 1 ? trimmed : fallback;
}

export function sanitizeHexColor(raw: string, fallback: string): string {
  const trimmed = (raw || '').trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

export function sanitizeDateISO(raw: string): string {
  const trimmed = (raw || '').trim().slice(0, 10);
  return DATE_ISO_REGEX.test(trimmed)
    ? trimmed
    : new Date().toISOString().slice(0, 10);
}

/**
 * Safely serializes ClubDataState so that it NEVER produces invalid truncated JSON
 * and stays within the 950KB Firestore document payload limit.
 */
function serializeClubWorkspaceState(state: ClubDataState): string {
  const cleanState = stripSecretsFromClubState(state);
  const json = JSON.stringify(cleanState);
  if (json.length <= MAX_PAYLOAD_LENGTH) {
    return json;
  }
  // If large base64 photos push the payload over 940KB, trim oversized photoUrls first while keeping valid JSON
  const compactedMembers: Member[] = cleanState.members.map((m) => {
    if (m.photoUrl && m.photoUrl.length > 25000) {
      return { ...m, photoUrl: '' };
    }
    return m;
  });
  const secondTry = JSON.stringify({ ...cleanState, members: compactedMembers });
  if (secondTry.length <= MAX_PAYLOAD_LENGTH) {
    return secondTry;
  }
  const strippedPhotos = cleanState.members.map((m) => ({ ...m, photoUrl: '' }));
  return JSON.stringify({ ...cleanState, members: strippedPhotos });
}

/**
 * Merges two ClubDataState objects so that members, matches, tournaments,
 * events, announcements, and officers created on different devices are preserved.
 */
export function mergeClubDataStates(
  primary: ClubDataState,
  secondary: ClubDataState
): ClubDataState {
  // Merge members by id, schoolIdHash, and legacy schoolId
  const memberMap = new Map<string, Member>();
  const schoolKeyToMemberId = new Map<string, string>();

  const getMemberSchoolKey = (m: Member): string => {
    if (m.schoolIdHash && m.schoolIdHash.trim()) {
      return `hash:${m.schoolIdHash.trim().toLowerCase()}`;
    }
    if (m.schoolId && m.schoolId.trim()) {
      return `raw:${m.schoolId.trim().toLowerCase()}`;
    }
    return '';
  };

  for (const m of primary.members) {
    memberMap.set(m.id, m);
    const key = getMemberSchoolKey(m);
    if (key) {
      schoolKeyToMemberId.set(key, m.id);
    }
  }

  for (const m of secondary.members) {
    const schoolKey = getMemberSchoolKey(m);
    const existingIdBySchool = schoolKey
      ? schoolKeyToMemberId.get(schoolKey)
      : undefined;
    const targetId = existingIdBySchool || m.id;
    const existing = memberMap.get(targetId);

    if (!existing) {
      memberMap.set(m.id, m);
      if (schoolKey) {
        schoolKeyToMemberId.set(schoolKey, m.id);
      }
    } else {
      // Combine any missing profile fields (such as photoUrl or schoolIdHash) and pick higher activity count
      const primaryGames = (existing.wins || 0) + (existing.losses || 0);
      const secondaryGames = (m.wins || 0) + (m.losses || 0);
      const base = secondaryGames > primaryGames ? m : existing;
      const other = secondaryGames > primaryGames ? existing : m;
      const mergedHash = base.schoolIdHash || other.schoolIdHash;
      const mergedMasked = base.schoolIdMasked || other.schoolIdMasked;
      const merged: Member = {
        ...other,
        ...base,
        id: existing.id,
        schoolIdHash: mergedHash,
        schoolIdMasked: mergedMasked,
        photoUrl: base.photoUrl || other.photoUrl,
        paddleNotes: base.paddleNotes || other.paddleNotes,
      };
      if (mergedHash) {
        delete merged.schoolId;
      } else {
        merged.schoolId = base.schoolId || other.schoolId;
      }
      memberMap.set(targetId, merged);
    }
  }

  const mergeById = <T extends { id: string }>(arr1: T[], arr2: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of arr1 || []) {
      map.set(item.id, item);
    }
    for (const item of arr2 || []) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  };

  return {
    ...primary,
    settings: {
      ...secondary.settings,
      ...primary.settings,
    },
    members: Array.from(memberMap.values()),
    attendance: mergeById(primary.attendance, secondary.attendance),
    matches: mergeById(primary.matches, secondary.matches),
    challenges: mergeById(primary.challenges || [], secondary.challenges || []),
    polls: mergeById(primary.polls || [], secondary.polls || []),
    mvpVotes: {
      ...(secondary.mvpVotes || {}),
      ...(primary.mvpVotes || {}),
    },
    activityReactions: {
      ...(secondary.activityReactions || {}),
      ...(primary.activityReactions || {}),
    },
    clubTournaments: mergeById(
      primary.clubTournaments,
      secondary.clubTournaments
    ),
    officers: mergeById(primary.officers, secondary.officers),
    tasks: mergeById(primary.tasks, secondary.tasks),
    events: mergeById(primary.events, secondary.events),
    announcements: mergeById(primary.announcements, secondary.announcements),
    transactions: mergeById(primary.transactions, secondary.transactions),
    archives: mergeById(primary.archives, secondary.archives),
  };
}

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  linkedMemberId: string;
}

export interface QrCheckinRecord {
  id: string;
  uid: string;
  memberId: string;
  memberName: string;
  practiceDate: string;
  practiceTitle: string;
  qrCodeToken: string;
  status: 'verified';
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfileInFirestore(
  user: User,
  defaultMemberId: string
): Promise<UserProfileDoc> {
  const uid = sanitizeId(user.uid, 128);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid,
        displayName: data.displayName,
        linkedMemberId: data.linkedMemberId,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const displayName = sanitizeString(
    user.displayName || user.email?.split('@')[0] || 'Club Member',
    100,
    'Club Member'
  );
  const linkedMemberId = sanitizeId(defaultMemberId || 'mem-1', 64);

  try {
    await setDoc(ref, {
      uid,
      displayName,
      linkedMemberId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { uid, displayName, linkedMemberId };
}

export async function updateUserLinkedMember(
  uid: string,
  displayName: string,
  linkedMemberId: string
): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const path = `users/${safeUid}`;
  const ref = doc(db, 'users', safeUid);

  try {
    await updateDoc(ref, {
      displayName: sanitizeString(displayName, 100, 'Club Member'),
      linkedMemberId: sanitizeId(linkedMemberId, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Loads the shared global club workspace (`clubWorkspaces/bnhs_global_club`)
 * from Firestore so all devices see the same members, matches, and settings.
 */
export async function loadGlobalClubWorkspaceFromFirestore(): Promise<{
  state: ClubDataState | null;
  exists: boolean;
}> {
  const path = `clubWorkspaces/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubWorkspaces', GLOBAL_CLUB_WORKSPACE_ID);

  try {
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (!snap.exists()) {
      return { state: null, exists: false };
    }
    const rawPayload = snap.data().payload;
    if (typeof rawPayload === 'string' && rawPayload.length > 2) {
      return {
        state: JSON.parse(rawPayload) as ClubDataState,
        exists: true,
      };
    }
    return { state: null, exists: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Subscribes in real time (`onSnapshot`) to the shared global club workspace
 * (`clubWorkspaces/bnhs_global_club`) across all devices.
 */
export function subscribeGlobalClubWorkspace(
  onUpdate: (state: ClubDataState | null, exists: boolean) => void,
  onError?: (error: Error) => void
): () => void {
  const path = `clubWorkspaces/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubWorkspaces', GLOBAL_CLUB_WORKSPACE_ID);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null, false);
        return;
      }
      const rawPayload = snap.data().payload;
      if (typeof rawPayload === 'string' && rawPayload.length > 2) {
        try {
          const parsed = JSON.parse(rawPayload) as ClubDataState;
          onUpdate(parsed, true);
          return;
        } catch (err) {
          console.error('Failed to parse global club workspace JSON:', err);
        }
      }
      onUpdate(null, true);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
  );
}

/**
 * Loads the PBKDF2-hashed PIN / password configuration from `/clubAuthConfig/bnhs_global_club`.
 */
export async function loadClubAuthConfigFromFirestore(): Promise<{
  config: ClubAuthConfig | null;
  exists: boolean;
}> {
  const path = `clubAuthConfig/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubAuthConfig', GLOBAL_CLUB_WORKSPACE_ID);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { config: null, exists: false };
    }
    const d = snap.data();
    if (
      typeof d.clubId === 'string' &&
      typeof d.salt === 'string' &&
      typeof d.iterations === 'number' &&
      typeof d.officerPinHash === 'string' &&
      typeof d.presidentPasswordHash === 'string'
    ) {
      return {
        config: {
          clubId: d.clubId,
          salt: d.salt,
          iterations: d.iterations,
          officerPinHash: d.officerPinHash,
          presidentPasswordHash: d.presidentPasswordHash,
        },
        exists: true,
      };
    }
    return { config: null, exists: true };
  } catch (error) {
    console.warn(`Unable to load ${path}:`, error);
    return { config: null, exists: false };
  }
}

/**
 * Real-time subscription to `/clubAuthConfig/bnhs_global_club`.
 */
export function subscribeClubAuthConfig(
  onUpdate: (config: ClubAuthConfig | null, exists: boolean) => void
): () => void {
  const path = `clubAuthConfig/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubAuthConfig', GLOBAL_CLUB_WORKSPACE_ID);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null, false);
        return;
      }
      const d = snap.data();
      if (
        typeof d.clubId === 'string' &&
        typeof d.salt === 'string' &&
        typeof d.iterations === 'number' &&
        typeof d.officerPinHash === 'string' &&
        typeof d.presidentPasswordHash === 'string'
      ) {
        onUpdate(
          {
            clubId: d.clubId,
            salt: d.salt,
            iterations: d.iterations,
            officerPinHash: d.officerPinHash,
            presidentPasswordHash: d.presidentPasswordHash,
          },
          true
        );
        return;
      }
      onUpdate(null, true);
    },
    (error) => {
      console.warn(`Unable to subscribe to ${path}:`, error);
    }
  );
}

/**
 * Admin-only write of PBKDF2-hashed Officer PIN & President Password into `/clubAuthConfig/bnhs_global_club`.
 */
export async function saveClubAuthConfigToFirestore(
  config: ClubAuthConfig,
  existsHint = false
): Promise<void> {
  const path = `clubAuthConfig/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubAuthConfig', GLOBAL_CLUB_WORKSPACE_ID);

  const performUpdate = async () => {
    await updateDoc(ref, {
      salt: config.salt,
      iterations: config.iterations,
      officerPinHash: config.officerPinHash,
      presidentPasswordHash: config.presidentPasswordHash,
      updatedAt: serverTimestamp(),
    });
  };

  const performCreate = async () => {
    await setDoc(ref, {
      clubId: GLOBAL_CLUB_WORKSPACE_ID,
      salt: config.salt,
      iterations: config.iterations,
      officerPinHash: config.officerPinHash,
      presidentPasswordHash: config.presidentPasswordHash,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  try {
    if (existsHint) {
      try {
        await performUpdate();
      } catch {
        await performCreate();
      }
    } else {
      try {
        await performCreate();
      } catch {
        await performUpdate();
      }
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsHint ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

/**
 * Saves the shared global club workspace (`clubWorkspaces/bnhs_global_club`)
 * to Firestore, automatically handling create vs update.
 */
export async function saveGlobalClubWorkspaceToFirestore(
  state: ClubDataState,
  existsHint = true
): Promise<void> {
  const path = `clubWorkspaces/${GLOBAL_CLUB_WORKSPACE_ID}`;
  const ref = doc(db, 'clubWorkspaces', GLOBAL_CLUB_WORKSPACE_ID);

  const clubName = sanitizeString(
    state.settings.clubName,
    120,
    'BNHS Pickleball Club'
  );
  const schoolName = sanitizeString(
    state.settings.schoolName,
    120,
    'Byron Nelson High School'
  );
  const primaryColor = sanitizeHexColor(
    state.settings.primaryColor,
    '#1d4ed8'
  );
  const secondaryColor = sanitizeHexColor(
    state.settings.secondaryColor,
    '#eab308'
  );
  const payload = serializeClubWorkspaceState(state);

  const performUpdate = async () => {
    await updateDoc(ref, {
      clubName,
      schoolName,
      primaryColor,
      secondaryColor,
      payload,
      updatedAt: serverTimestamp(),
    });
  };

  const performCreate = async () => {
    await setDoc(ref, {
      ownerId: GLOBAL_CLUB_WORKSPACE_ID,
      clubName,
      schoolName,
      primaryColor,
      secondaryColor,
      payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  try {
    if (existsHint) {
      try {
        await performUpdate();
      } catch {
        await performCreate();
      }
    } else {
      try {
        await performCreate();
      } catch {
        await performUpdate();
      }
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsHint ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function loadClubWorkspaceFromFirestore(
  uid: string
): Promise<ClubDataState | null> {
  const { state } = await loadGlobalClubWorkspaceFromFirestore();
  if (state) return state;

  const safeUid = sanitizeId(uid, 128);
  const path = `clubWorkspaces/${safeUid}`;
  const ref = doc(db, 'clubWorkspaces', safeUid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const rawPayload = snap.data().payload;
    if (typeof rawPayload === 'string' && rawPayload.length > 2) {
      return JSON.parse(rawPayload) as ClubDataState;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveClubWorkspaceToFirestore(
  _uid: string,
  state: ClubDataState,
  existsAlready: boolean
): Promise<void> {
  await saveGlobalClubWorkspaceToFirestore(state, existsAlready);
}

export async function logQrCheckinToFirestore(params: {
  uid: string;
  memberId: string;
  memberName: string;
  practiceDate: string;
  practiceTitle: string;
  qrCodeToken: string;
}): Promise<string> {
  const safeUid = sanitizeId(params.uid, 128);
  const safeMemberId = sanitizeId(params.memberId, 64);
  const safeDate = sanitizeDateISO(params.practiceDate);
  const docId = sanitizeId(
    `qr_${safeUid.slice(0, 20)}_${safeMemberId}_${safeDate}`,
    120
  );
  const path = `qrCheckins/${docId}`;
  const ref = doc(db, 'qrCheckins', docId);

  try {
    await setDoc(ref, {
      uid: safeUid,
      memberId: safeMemberId,
      memberName: sanitizeString(params.memberName, 100, 'Club Member'),
      practiceDate: safeDate,
      practiceTitle: sanitizeString(
        params.practiceTitle,
        140,
        'Club Practice'
      ),
      qrCodeToken: sanitizeId(params.qrCodeToken, 80),
      status: 'verified',
      createdAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserQrCheckins(
  uid: string,
  onUpdate: (records: QrCheckinRecord[]) => void
): () => void {
  const safeUid = sanitizeId(uid, 128);
  const path = 'qrCheckins';
  const q = query(
    collection(db, 'qrCheckins'),
    where('uid', '==', safeUid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: QrCheckinRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: data.uid,
          memberId: data.memberId,
          memberName: data.memberName,
          practiceDate: data.practiceDate,
          practiceTitle: data.practiceTitle,
          qrCodeToken: data.qrCodeToken,
          status: 'verified',
        };
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export { onAuthStateChanged };
export type { User };
