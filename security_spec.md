# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path not explicitly matched is denied for all reads and writes (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All write operations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
3. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates its path ID using `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **UserProfile (`/users/{userId}`)**:
   - Document ID `userId` must match `request.auth.uid` and `incoming().uid == request.auth.uid`.
   - Read access (`get`) is restricted strictly to `isOwner(userId) || isAdmin()`. `list` is denied to prevent user enumeration.
   - `createdAt` and `uid` are immutable on `update`; `updatedAt` must equal `request.time`.
5. **ClubWorkspace (`/clubWorkspaces/{workspaceId}`)**:
   - Supports the shared global club document (`workspaceId == 'bnhs_global_club'` with `ownerId == 'bnhs_global_club'`) so all devices signing in via School ID or Officer PIN share the live club database, as well as per-user workspace documents (`workspaceId == request.auth.uid`).
   - `list` is denied (`allow list: if false;`); only targeted `get`, `create`, and `update` on validated IDs are permitted.
   - `ownerId` and `createdAt` are immutable on `update`; `updatedAt` must equal `request.time`.
6. **QrCheckin (`/qrCheckins/{checkinId}`)**:
   - Can only be created if `incoming().uid == request.auth.uid`, `incoming().createdAt == request.time`, and `incoming().status == 'verified'`.
   - Once created with terminal `status == 'verified'`, updates are locked (`allow update: if isAdmin();`) to prevent retroactive attendance tampering.
   - `allow list` enforces `resource.data.uid == request.auth.uid` (no blanket reads).

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating `/users/user_1` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/users/user_1` where `auth.token.email == 'peytonle238@gmail.com'` but `email_verified == false`.
3. **Identity Spoofing on Create**: User `user_1` creating `/qrCheckins/chk_1` with `uid: 'user_2'`.
4. **Shadow Field Injection on Create**: Creating `/users/user_1` with an undeclared field `isAdmin: true`.
5. **Shadow Field Injection on Update**: Updating `/users/user_1` with extra key `role: 'superadmin'`.
6. **Immutable Field Mutation**: Updating `/clubWorkspaces/user_1` to change `ownerId` or `createdAt`.
7. **Forged Client Timestamp**: Creating `/qrCheckins/chk_1` with a past or future `createdAt != request.time`.
8. **Value Poisoning / Oversized String**: Updating `/users/user_1` with `displayName` of length 5,000 (`> 100`).
9. **Path ID Poisoning**: Creating `/qrCheckins/invalid$id!with*bad^chars` that fails `^[a-zA-Z0-9_\-]+$`.
10. **Cross-User Profile Read (PII/Profile Leak)**: User `user_2` attempting `get` on `/users/user_1`.
11. **Unscoped Blanket List Query**: User `user_1` attempting `list` on `/qrCheckins` without filtering `uid == 'user_1'`.
12. **Terminal State Mutation**: User `user_1` attempting to `update` a `/qrCheckins/chk_1` document that is already in terminal state `status == 'verified'`.
