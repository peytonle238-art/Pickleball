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
import { ClubDataState } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

export async function loadClubWorkspaceFromFirestore(
  uid: string
): Promise<ClubDataState | null> {
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
  uid: string,
  state: ClubDataState,
  existsAlready: boolean
): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const path = `clubWorkspaces/${safeUid}`;
  const ref = doc(db, 'clubWorkspaces', safeUid);

  const clubName = sanitizeString(
    state.settings.clubName,
    120,
    'BNHS Pickleball Club HQ'
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
  const payload = JSON.stringify(state).slice(0, 500000);

  try {
    if (existsAlready) {
      await updateDoc(ref, {
        clubName,
        schoolName,
        primaryColor,
        secondaryColor,
        payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: safeUid,
        clubName,
        schoolName,
        primaryColor,
        secondaryColor,
        payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsAlready ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
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
