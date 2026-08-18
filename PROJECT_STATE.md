# MyLifeDock --- PROJECT_STATE

> Single source of truth for continuing MyLifeDock development across
> ChatGPT conversations. Update this file at meaningful milestones and
> commit it to Git.

## 1. Project Identity

-   Product: **MyLifeDock**
-   GitHub organization/user: `mylifedock`
-   Repository: `mylifedock/mylifedock`
-   GitHub email: `mylifedock@gmail.com`
-   Local project path:
    `C:\Users\bollu_flogivn\Documents\PersonalVault\app`
-   Current primary branch used during development:
    `feature/project-foundation`
-   Main branch: `main`

## 2. Product Objective

MyLifeDock is a **privacy-first personal/family life-management vault**.

The main goal is to build a genuinely useful, polished product. It must
NOT become a DevOps-learning project disguised as an application.

DevOps learning is secondary and should happen naturally through useful
engineering practices such as: - Git/GitHub - CI/CD - quality gates -
build/release practices - environment/configuration management - useful
automation

## 3. Non-Negotiable Constraints

### Cost

Prefer free/open-source tools, libraries and resources wherever
feasible.

Do NOT introduce: - paid SaaS - paid UI kits - paid APIs - unnecessary
subscriptions - proprietary services when a good free/open-source/native
alternative exists

Only unavoidable Google Play Store fees are acceptable.

If a paid dependency/service genuinely becomes necessary, stop and
discuss it before introducing it.

### UI

The product should look: - premium - modern - classy - clean - simple -
uncluttered - responsive - polished - smooth

Use thoughtful transitions and micro-interactions where appropriate.

Do not sacrifice UI quality just to make something technically
functional.

### Platforms

Current priority: 1. Web/PWA 2. Android later

Architecture should remain Android-ready, but Android must NOT derail
the current web-first development flow.

Likely future Android route: Capacitor or another appropriate
free/open-source approach, to be decided later.

## 4. Current Technology Stack

-   React
-   TypeScript
-   Vite
-   Dexie
-   IndexedDB
-   Browser Web Crypto API for planned encryption
-   Git/GitHub
-   GitHub Actions CI

Current environment previously verified: - Node: `v24.15.0` - npm:
`11.12.1` - Git: `2.55.0.windows.4` - VS Code: `1.133.0`

## 5. Architecture

Current source structure:

``` text
src/
├── app/
├── application/
├── domain/
├── infrastructure/
│   └── database/
│       └── db.ts
├── security/
├── shared/
└── ui/
    ├── components/
    └── pages/
```

Architecture principles: - UI should not directly own persistence
logic. - Application services coordinate use cases. - Infrastructure
owns database/storage concerns. - Security stays isolated in
`src/security`. - Storage should remain abstract enough for future
Google Drive support. - Avoid unnecessary dependencies. - Prefer
complete, coherent changes over scattered patches.

## 6. Current Database Schema

Current `src/infrastructure/database/db.ts` uses Dexie.

Database:

``` text
MyLifeDock
```

### Existing records

#### DocumentRecord

``` text
id
ownerId
title
category
documentType?
issuer?
issueDate?
expiryDate?
sensitivity
storagePolicy
attachmentId?
tags
notes?
createdAt
updatedAt
```

#### AttachmentRecord

``` text
id
ownerId
documentId
fileName
mimeType
size
storageType: "indexeddb" | "google-drive"
storageKey
blob?: Blob
createdAt
```

#### ProductRecord

``` text
id
ownerId
category
name
brand?
model?
serialNumber?
imei?
purchaseDate?
purchasePrice?
vendor?
invoiceDocumentId?
sensitivity
notes?
createdAt
updatedAt
```

#### CoverageRecord

Coverage types:

``` text
warranty
extended-warranty
amc
insurance
```

Fields include:

``` text
id
ownerId
productId
type
provider?
policyNumber?
startDate
endDate
documentId?
reminderEnabled
reminderDaysBefore
createdAt
updatedAt
```

#### ReminderRecord

``` text
id
ownerId
title
dueDate
relatedEntityType?
relatedEntityId?
enabled
createdAt
updatedAt
```

#### ProfileRecord

``` text
id
displayName
createdAt
updatedAt
```

### Sensitivity levels

``` text
normal
sensitive
critical
```

### Storage policies

``` text
local-only
drive-allowed
sync-allowed
```

### Database versions

Version 1 contains:

``` text
documents
attachments
products
coverages
reminders
profiles
```

Version 2 adds:

``` text
vaultSecurity
```

`VaultSecurityRecord` contains:

``` text
id
keyVersion
kdf: "PBKDF2"
kdfHash: "SHA-256"
kdfIterations
salt
wrappedVaultKey
createdAt
updatedAt
```

The user's passphrase is NOT stored.

The vault encryption key is NOT stored in plaintext.

## 7. Git / CI Status

Git was installed and configured.

Git identity:

``` text
user.name = mylifedock
user.email = mylifedock@gmail.com
```

Remote:

``` text
https://github.com/mylifedock/mylifedock.git
```

Initial React project was committed and pushed.

A GitHub Actions CI pipeline was added intentionally because it is
useful DevOps learning, but CI/CD remains secondary to product
development.

Routine Git operations do not need detailed teaching; user is
comfortable with:

``` text
git status
git add
git commit
git push
git branch
```

## 8. Completed Product Work

### Foundation

-   React + TypeScript + Vite initialized
-   Git/GitHub initialized
-   GitHub Actions CI added
-   Architecture folders created
-   Dexie installed
-   IndexedDB database established

### Dashboard

-   MyLifeDock dashboard exists
-   Sidebar/navigation exists
-   Local profile onboarding exists
-   Visual direction is already considered good and should be
    preserved/improved rather than redesigned unnecessarily

### Documents V1

Working features: - Create document metadata - Categories - Document
type - Issuer - Issue date - Expiry date - Sensitivity - Storage
policy - Notes - Attachment selection - Attachment validation -
PDF/JPG/JPEG/PNG/WebP support - 10 MB maximum file size - IndexedDB
persistence - Reactive updates with `useLiveQuery` - PDF preview - Image
preview - Download - Delete document - Delete related attachments -
Persistence after refresh - File input clears after successful save -
Duplicate-submit prevention with saving state

### Attachment validation behavior

Invalid files are validated BEFORE document creation.

Expected behavior:

``` text
invalid attachment
→ error
→ no document created
```

This was specifically fixed after an earlier bug where an invalid
attachment could leave a document behind.

### Atomic document + attachment save

Current application service has:

``` text
createDocument()
createDocumentWithAttachment()
deleteDocument()
```

`createDocumentWithAttachment()` uses a Dexie read/write transaction
over:

``` text
documents
attachments
```

Goal:

``` text
document + attachment
→ both commit
OR
→ neither commits
```

Delete also uses a transaction and removes related attachments.

## 9. Current Relevant Files

Important current files:

``` text
src/application/documentService.ts
src/application/attachmentService.ts
src/infrastructure/database/db.ts
src/security/vaultKeyService.ts
src/security/VaultGate.tsx
src/ui/pages/DocumentsPage.tsx
src/ui/components/DocumentCard.tsx
src/App.tsx
```

Temporary:

``` text
SecurityTestPage.tsx
```

was created for testing and then removed.

## 10. Security Architecture

### Vault key lifecycle

Implemented in:

``` text
src/security/vaultKeyService.ts
```

Current design:

``` text
User passphrase
    ↓
PBKDF2-SHA-256
600,000 iterations
    ↓
AES-256-KW wrapping key
    ↓
unwrap
    ↓
AES-256-GCM vault key
```

Random 16-byte salt is generated for the vault.

The actual vault key is kept only in application memory while unlocked.

Functions currently implemented:

``` text
isVaultConfigured()
initializeVault()
unlockVault()
lockVault()
isVaultUnlocked()
getUnlockedVaultKey()
```

### Vault gate

Implemented in:

``` text
src/security/VaultGate.tsx
```

App flow:

``` text
App starts
  ↓
load profile + vault configuration
  ↓
no profile
  → profile onboarding
  ↓
profile exists but vault not configured
  → create vault
  ↓
vault configured but locked
  → passphrase lock screen
  ↓
vault unlocked
  → normal MyLifeDock application
```

After browser refresh:

``` text
vault key is no longer in memory
→ application starts locked
```

## 11. Security Tests Completed

All passed:

``` text
✓ Fresh vault creation
✓ Dashboard opens after vault creation
✓ Refresh locks the vault
✓ Correct passphrase unlocks
✓ Wrong passphrase rejected
✓ Documents still works after security gate
✓ PDF preview still works
```

A development database reset was performed because an earlier temporary
test passphrase was unknown. This was safe because attachments have NOT
yet been encrypted.

Current development passphrase is known to the developer, but it should
NOT be considered a production credential.

## 12. Important Security Rule

Do NOT put the user's actual vault passphrase into source code, Git,
environment files, logs, analytics, or cloud services.

For production, recovery/export strategy must be designed BEFORE users
depend on encrypted data.

We must not accidentally create a system where forgotten credentials
cause irreversible loss without a carefully considered recovery design.

## 13. Current State: IMPORTANT

### Completed

``` text
Foundation                         ✅
React + TypeScript + Vite          ✅
Git/GitHub                         ✅
GitHub Actions CI                 ✅
Architecture                       ✅
Dexie/IndexedDB                   ✅
Dashboard                          ✅
Documents                          ✅
Attachments                        ✅
Attachment validation              ✅
Atomic persistence                 ✅
PDF/image preview                  ✅
Download                           ✅
Delete                             ✅
Refresh persistence                ✅
File-input reset UX                ✅
Vault security metadata            ✅
PBKDF2 key derivation              ✅
AES-KW wrapped vault key           ✅
AES-256-GCM vault key              ✅
Vault initialize                   ✅
Vault unlock                       ✅
Vault lock                         ✅
VaultGate UI                       ✅
Security lifecycle tests           ✅
```

### Current NEXT TASK

**Encrypt attachments at rest.**

Current:

``` text
File
 ↓
Blob
 ↓
IndexedDB
```

Target:

``` text
File
 ↓
AES-256-GCM encryption
 ↓
Encrypted binary
 ↓
IndexedDB
```

On unlock:

``` text
Encrypted attachment
 ↓
vault key
 ↓
decrypt
 ↓
PDF/image preview
```

On locked state:

``` text
No vault key
 ↓
Encrypted attachments cannot be decrypted
```

### Critical implementation caution

Before modifying attachment encryption: - Inspect the actual current
`attachmentService.ts` - Inspect the actual current `DocumentCard.tsx` -
Preserve current working PDF/image preview - Preserve download
behavior - Preserve IndexedDB persistence - Preserve atomic
document+attachment save - Avoid breaking existing unencrypted
development data - Decide how migration from existing plaintext
development attachments should work - Do NOT blindly encrypt existing
records without a migration plan - Use unique AES-GCM IVs/nonces per
encrypted attachment - Never reuse an IV with the same AES-GCM key -
Store required encryption metadata alongside the encrypted attachment -
Keep encryption/decryption logic in `src/security` or a clean
security/storage abstraction, not directly inside UI components

## 14. Development Process Rules

User explicitly wants fewer troubleshooting loops.

Before giving code: 1. Check complete dependency chain. 2. Verify file
paths/imports. 3. Verify types. 4. Verify DB APIs. 5. Verify React hook
placement. 6. Consider lint rules. 7. Consider TypeScript build. 8.
Consider runtime behavior. 9. Prefer complete-file replacements for
nontrivial changes.

After meaningful changes:

``` text
npm run lint
npm run build
```

Only run the dev server after lint/build pass.

User is comfortable with routine Git commands, so don't spend tokens
teaching basic Git unless something unusual happens.

Command explanations should be brief:

``` text
npm run lint
→ checks code quality/rules

npm run build
→ verifies TypeScript + production build
```

## 15. Product Roadmap
Current priority order:

``` text
1. Products V1
2. Warranty / extended warranty / AMC / insurance
3. Reminder engine
4. Broader Documents V2 improvements
5. Google Drive integration
6. PWA/offline refinement
7. Android/Capacitor
8. OCR/AI/search/voice/search/sharing
9. Larger UI polish pass
```

The roadmap can evolve, but do not deviate from the core product
objective without a reason.

## 16. Future Product Areas

MyLifeDock is intended to eventually manage: - Documents - Product
records - Warranty - Extended warranty - AMC - Insurance - Reminders -
Financial assets/liabilities - Vehicles - Properties - Travel
information - Tax information - Memberships - Important family
information - OCR/document extraction - Search - Voice search - Google
Drive backup/sync - Sharing/family access - Authentication -
Device/biometric protection

Sensitive information should be handled conservatively.

Do not store: - passwords - CVVs - bank credentials - full secret
credentials

Financial records should prefer limited metadata where appropriate, such
as:

``` text
Bank: HDFC
Card: Infinia
Last 4: 1234
```

## 17. UI Direction

Current UI is already described by the user as looking cool and should
continue in this direction.

Maintain: - dark/premium visual language - clean spacing - restrained
use of color - polished forms - readable native controls - smooth
transitions - useful empty states - meaningful loading states -
responsive desktop/mobile layout - accessibility and keyboard support

A dedicated design-system polish pass should happen later rather than
constantly redesigning during architecture work.

## 18. DevOps Learning Philosophy

The product is the main objective.

DevOps is integrated only where it provides real value:

``` text
Git
CI
lint
build
tests
release discipline
automation
deployment
observability
```

Do not turn MyLifeDock into a DevOps-centric demo project.

## 19. How to Resume in a New Chat

Start with:

> Resume MyLifeDock from PROJECT_STATE.md.

Then provide this file if the new conversation cannot access the
repository/file.

The assistant should: 1. Read this state. 2. Confirm the current
milestone. 3. Continue from **Products V1**. 4. Inspect the current
database schema and existing UI/service patterns before coding. 5. Avoid
re-teaching completed work or revisiting completed security/attachment
work unless a regression is found.

## 20. Last Known Clean Checkpoint

Security, encrypted attachments, recovery, locking, and document
download behavior have been validated end-to-end.

### Security / vault completed
- Vault passphrase initialization and unlock
- AES-256-GCM vault key architecture
- PBKDF2-SHA-256 passphrase wrapping
- 256-bit hexadecimal recovery key
- Recovery to a new passphrase
- Old passphrase rejected after recovery
- Repeated recovery-key use validated
- Vault key converted back to non-extractable runtime key
- Manual Lock Vault
- 30-minute inactivity auto-lock (30-second development test validated)
- Recovery/debug logging removed

### Documents / attachments completed
- Attachment encryption at rest with AES-256-GCM
- 12-byte random IV per encrypted attachment
- Encrypted Blob stored in IndexedDB
- PDF/JPG/PNG/WebP validation and 10 MB limit
- Encrypted attachment preview after in-memory decryption
- Download after decryption validated
- Encrypted attachments remain usable after vault recovery

### Validation
- `npm run lint` passes
- `npm run build` passes
- Manual lock/unlock tested
- Auto-lock tested
- Recovery tested
- Existing encrypted document tested after recovery

## 21. Exact Next Task

**Products V1 — start with the domain/database layer.**

Before coding, inspect the current Dexie schema and existing application
service/UI patterns. Then implement Products in this order:

1. ProductRecord/database table and indexes
2. productService.ts
3. ProductsPage foundation
4. Create product
5. Edit product
6. Delete product
7. Product details
8. Prepare the model for warranty/AMC/insurance coverage

Do not introduce Google authentication, cloud sync, Android, or a major
landing-page redesign during this milestone.
