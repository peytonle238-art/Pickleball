/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads defined in security_spec.md
 * return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: null,
    payload: {
      uid: 'user_1',
      displayName: 'Marcus Vance',
      linkedMemberId: 'mem-1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: {
      uid: 'user_1',
      email: 'peytonle238@gmail.com',
      email_verified: false,
    },
    payload: {
      uid: 'user_1',
      displayName: 'Spoofed Admin',
      linkedMemberId: 'mem-1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collectionPath: '/qrCheckins/chk_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_2',
      memberId: 'mem-1',
      memberName: 'Marcus Vance',
      practiceDate: '2026-10-29',
      practiceTitle: 'Thursday Practice',
      qrCodeToken: 'BNHS-20261029',
      status: 'verified',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_1',
      displayName: 'Marcus Vance',
      linkedMemberId: 'mem-1',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Update',
    collectionPath: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      displayName: 'Marcus Vance',
      role: 'superadmin',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immutable Field Mutation',
    collectionPath: '/clubWorkspaces/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_2',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged Client Timestamp',
    collectionPath: '/qrCheckins/chk_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_1',
      memberId: 'mem-1',
      memberName: 'Marcus Vance',
      practiceDate: '2026-10-29',
      practiceTitle: 'Thursday Practice',
      qrCodeToken: 'BNHS-20261029',
      status: 'verified',
      createdAt: '1999-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Value Poisoning / Oversized String',
    collectionPath: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      displayName: 'A'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    collectionPath: '/qrCheckins/bad$id!name',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      uid: 'user_1',
      memberId: 'mem-1',
      memberName: 'Marcus Vance',
      practiceDate: '2026-10-29',
      practiceTitle: 'Thursday Practice',
      qrCodeToken: 'BNHS-20261029',
      status: 'verified',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-User Profile Read',
    collectionPath: '/users/user_1',
    operation: 'get',
    auth: { uid: 'user_2', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unscoped Blanket List Query',
    collectionPath: '/qrCheckins',
    operation: 'list',
    auth: { uid: 'user_2', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Terminal State Mutation on Verified Check-in',
    collectionPath: '/qrCheckins/chk_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      practiceDate: '2026-11-01',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
