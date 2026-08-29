# MyLifeDock — PROJECT_STATE

> **Single source of truth for continuing MyLifeDock development across ChatGPT conversations.**
>
> Update this file at meaningful milestones and commit it to Git.
>
> **Last consolidated from:** `PROJECT_STATE(3).md` + `PROJECT_STATE1.md`
> **Consolidation date:** 2026-08-18

---

## 0. Current Resume Snapshot

**Product:** MyLifeDock  
**Current milestone:** **Products V1**  
**Security milestone:** **COMPLETE — do not revisit unless a regression is found**  
**Attachment encryption:** **COMPLETE**  
**Document/attachment download:** **WORKING**  
**Vault lock/unlock:** **WORKING**  
**Auto-lock:** **WORKING — production timeout restored to 30 minutes**  
**Lint:** **PASS**  
**Build:** **PASS**

### Immediate next objective

Build **Products V1**, beginning with the domain/database layer.

### Do NOT restart completed work

Do not re-implement or repeatedly troubleshoot:

- Vault initialization
- Vault unlock/lock
- Recovery flow
- AES-256-GCM attachment encryption
- Attachment preview/decryption
- Attachment download
- 30-minute production auto-lock
- Existing Documents V1 behavior

Only revisit those areas if a new regression is demonstrated.

---

# 1. Project Identity

- Product: **MyLifeDock**
- GitHub organization/user: `mylifedock`
- Repository: `mylifedock/mylifedock`
- GitHub email: `mylifedock@gmail.com`
- Local project path:
  `C:\Users\bollu_flogivn\Documents\PersonalVault\app`
- Primary development branch: `feature/project-foundation`
- Main branch: `main`

---

# 2. Product Vision

MyLifeDock is a **privacy-first personal/family life-management vault**.

The goal is to build a genuinely useful, polished product — **not a DevOps learning project disguised as an application**.

DevOps learning is secondary and should happen naturally through:

- Git/GitHub
- CI/CD
- Quality gates
- Build/release practices
- Configuration management
- Useful automation
- Deployment
- Observability

The product itself remains the priority.

---

# 3. Non-Negotiable Product Constraints

## Cost

Prefer free, open-source, native, or self-contained solutions wherever feasible.

Do not introduce:

- Paid SaaS
- Paid UI kits
- Paid APIs
- Unnecessary subscriptions
- Proprietary services where a good free/open-source/native alternative exists

Only unavoidable Google Play Store fees are acceptable.

If a paid dependency or service genuinely becomes necessary, **stop and discuss it before introducing it**.

## UI

Target:

- Premium
- Modern
- Classy
- Clean
- Simple
- Uncluttered
- Responsive
- Polished
- Smooth

Maintain thoughtful transitions and micro-interactions where useful.

Do not sacrifice UI quality merely to make a feature technically functional.

## Platform

Priority:

1. Web/PWA
2. Android later

Architecture should remain Android-ready, but Android must not derail web-first development.

Potential future Android approach: Capacitor or another suitable free/open-source approach. Decision deferred until needed.

---

# 4. Technology Stack

- React
- TypeScript
- Vite
- Dexie
- IndexedDB
- Browser Web Crypto API
- Git/GitHub
- GitHub Actions CI

Previously verified environment:

- Node: `v24.15.0`
- npm: `11.12.1`
- Git: `2.55.0.windows.4`
- VS Code: `1.133.0`

---

# 5. Architecture

Current architectural direction:

```text
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

## Architecture principles

1. UI must not directly own persistence logic.
2. Application services coordinate use cases.
3. Infrastructure owns database/storage concerns.
4. Security remains isolated in `src/security`.
5. Storage should remain abstract enough for future Google Drive support.
6. Avoid unnecessary dependencies.
7. Prefer complete, coherent changes over scattered patches.
8. Keep the architecture suitable for future Android packaging.
9. Do not introduce cloud architecture prematurely.
10. Do not mix security/encryption implementation into UI components.

### Important audit note

The two supplied state documents describe the intended/current architecture, but the actual source repository folder was **not included in the uploaded materials for this consolidation**.

Therefore this state document does **not invent file-level architecture findings** beyond what the supplied state documents establish.

When the actual repository is available, perform one deliberate architecture pass over the complete source tree before making major structural changes.

---

# 6. Current Database Model

Database: **MyLifeDock**, implemented with Dexie/IndexedDB.

## DocumentRecord

```text
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

## AttachmentRecord

```text
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

Encrypted attachment state additionally requires the encryption metadata used by the implemented attachment encryption architecture.

## ProductRecord

```text
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

## CoverageRecord

Coverage types:

```text
warranty
extended-warranty
amc
insurance
```

Fields:

```text
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

## ReminderRecord

```text
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

## ProfileRecord

```text
id
displayName
createdAt
updatedAt
```

## Sensitivity

```text
normal
sensitive
critical
```

## Storage policies

```text
local-only
drive-allowed
sync-allowed
```

## Database versions

Version 1:

```text
documents
attachments
products
coverages
reminders
profiles
```

Version 2 added:

```text
vaultSecurity
```

`VaultSecurityRecord`:

```text
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

The user's passphrase is never stored.

The vault encryption key is never stored in plaintext.

---

# 7. Completed Product Functionality

## Foundation

- React + TypeScript + Vite initialized
- Git/GitHub initialized
- GitHub Actions CI added
- Architecture folders created
- Dexie installed
- IndexedDB database established

## Dashboard

- Dashboard exists
- Sidebar/navigation exists
- Local profile onboarding exists
- Existing visual direction is considered good
- Avoid unnecessary redesign

## Documents V1

Working functionality:

- Create document metadata
- Categories
- Document type
- Issuer
- Issue date
- Expiry date
- Sensitivity
- Storage policy
- Notes
- Attachment selection
- Attachment validation
- PDF/JPG/JPEG/PNG/WebP support
- 10 MB maximum file size
- IndexedDB persistence
- Reactive updates via `useLiveQuery`
- PDF preview
- Image preview
- Download
- Delete document
- Delete related attachment
- Persistence after refresh
- File input reset after successful save
- Duplicate-submit prevention

## Attachment validation

Validation occurs before document creation.

Required behavior:

```text
invalid attachment
    ↓
error
    ↓
no document created
```

This prevents the earlier bug where invalid attachments could leave an orphaned document.

## Atomic document + attachment persistence

Application service includes:

```text
createDocument()
createDocumentWithAttachment()
deleteDocument()
```

`createDocumentWithAttachment()` uses a Dexie read/write transaction covering:

```text
documents
attachments
```

Required atomic behavior:

```text
document + attachment
    ↓
both commit

OR

neither commits
```

Deletion also uses a transaction and removes related attachments.

---

# 8. Important Current Files

Known important files:

```text
src/application/documentService.ts
src/application/attachmentService.ts
src/infrastructure/database/db.ts
src/security/vaultKeyService.ts
src/security/VaultGate.tsx
src/ui/pages/DocumentsPage.tsx
src/ui/components/DocumentCard.tsx
src/App.tsx
```

Temporary security test page:

```text
SecurityTestPage.tsx
```

was created during testing and removed.

Before modifying an area, inspect the actual current file rather than assuming its contents from this document.

---

# 9. Security Architecture — COMPLETE

## Vault key lifecycle

Implemented in:

```text
src/security/vaultKeyService.ts
```

Architecture:

```text
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

- Random 16-byte salt is generated.
- The actual vault key remains only in application memory while unlocked.
- User passphrase is not stored.

Implemented functions:

```text
isVaultConfigured()
initializeVault()
unlockVault()
lockVault()
isVaultUnlocked()
getUnlockedVaultKey()
```

## Vault gate

Implemented in:

```text
src/security/VaultGate.tsx
```

Application flow:

```text
App starts
    ↓
load profile + vault configuration
    ↓
no profile
    → profile onboarding

profile exists but vault not configured
    → create vault

vault configured but locked
    → passphrase lock screen

vault unlocked
    → normal MyLifeDock application
```

Browser refresh removes the in-memory vault key and starts the application locked.

---

# 10. Security / Recovery / Locking Status

Completed and validated:

- Fresh vault creation
- Vault initialization
- Correct passphrase unlock
- Wrong passphrase rejection
- Refresh → locked state
- Manual Lock Vault
- 30-second development auto-lock test
- 30-minute production auto-lock restored
- Recovery key flow
- Recovery to a new passphrase
- Old passphrase rejected after recovery
- Repeated recovery-key use
- Recovery/debug logging removed
- Vault key returned to a non-extractable runtime key
- Existing encrypted document remains usable after recovery

### Security rule

Never place an actual user vault passphrase in:

- Source code
- Git
- Environment files
- Logs
- Analytics
- Cloud services

Recovery/export behavior must be designed carefully before production users depend on encrypted data.

---

# 11. Attachment Encryption — COMPLETE

Attachment encryption at rest is complete.

Target architecture:

```text
File
 ↓
AES-256-GCM encryption
 ↓
Encrypted binary
 ↓
IndexedDB
```

Implemented/validated behavior:

- AES-256-GCM
- Unique random 12-byte IV per encrypted attachment
- Encrypted Blob stored in IndexedDB
- Supported PDF/JPG/JPEG/PNG/WebP files
- 10 MB validation remains intact
- Preview decrypts only after vault unlock
- Download decrypts before returning the file
- Encrypted attachments remain usable after vault recovery

Locked state:

```text
No vault key
    ↓
Encrypted attachment cannot be decrypted
```

### Critical invariant

Never reuse an AES-GCM IV with the same encryption key.

Encryption/decryption logic must remain outside UI components.

---

# 12. Current Validation Checkpoint

Latest known clean checkpoint:

```text
npm run lint   → PASS
npm run build  → PASS
```

Validated manually:

```text
✓ Vault creation
✓ Vault unlock
✓ Vault lock
✓ Auto-lock
✓ Recovery
✓ Document persistence
✓ Encrypted attachment persistence
✓ PDF preview
✓ Image preview
✓ Attachment download
✓ Existing encrypted document after recovery
```

The attachment download issue that existed during development has been resolved.

---

# 13. Product Roadmap

Current priority:

```text
1. Products V1
2. Warranty / extended warranty / AMC / insurance
3. Reminder engine
4. Documents V2 improvements
5. Google Drive integration
6. PWA/offline refinement
7. Android/Capacitor
8. OCR / AI / search / voice search / sharing
9. Larger UI/design-system polish pass
```

Roadmap may evolve, but changes should remain aligned with the core product objective.

---

# 14. EXACT NEXT MILESTONE — Products V1

Start with the **domain/database layer**.

Before coding:

1. Inspect the actual current Dexie schema.
2. Inspect current application service patterns.
3. Inspect current page/component patterns.
4. Verify existing imports and types.
5. Confirm database migration/version strategy.
6. Then implement Products coherently.

Implementation order:

```text
1. ProductRecord / database table / indexes
2. productService.ts
3. ProductsPage foundation
4. Create product
5. Edit product
6. Delete product
7. Product details
8. Prepare model for warranty / AMC / insurance coverage
```

Do not introduce during this milestone:

- Google authentication
- Cloud sync
- Android/Capacitor
- Major landing-page redesign
- Unnecessary dependencies
- Unrelated security rewrites

---

# 15. Future Product Areas

Eventually MyLifeDock may manage:

- Documents
- Products
- Warranty
- Extended warranty
- AMC
- Insurance
- Reminders
- Financial assets/liabilities
- Vehicles
- Properties
- Travel information
- Tax information
- Memberships
- Important family information
- OCR/document extraction
- Search
- Voice search
- Google Drive backup/sync
- Family sharing
- Authentication
- Device/biometric protection

### Sensitive data policy

Do not store:

- Passwords
- CVVs
- Bank credentials
- Full secret credentials

Financial records should prefer limited metadata where appropriate, e.g.:

```text
Bank: HDFC
Card: Infinia
Last 4: 1234
```

---

# 16. UI Direction

Preserve the existing visual direction.

Maintain:

- Dark/premium visual language
- Clean spacing
- Restrained use of color
- Polished forms
- Readable native controls
- Smooth transitions
- Useful empty states
- Meaningful loading states
- Responsive desktop/mobile layout
- Accessibility
- Keyboard support

Do not repeatedly redesign the UI during architecture/product foundation work.

A dedicated design-system polish pass should happen later.

---

# 17. Development Process Rules

The user explicitly wants fewer troubleshooting loops.

Before giving implementation code:

1. Inspect the complete dependency chain.
2. Verify file paths and imports.
3. Verify TypeScript types.
4. Verify database APIs.
5. Verify React hook placement.
6. Consider lint rules.
7. Consider TypeScript build behavior.
8. Consider runtime behavior.
9. Prefer complete-file replacements for nontrivial changes.
10. Preserve existing working behavior unless the change intentionally modifies it.

After meaningful changes:

```text
npm run lint
npm run build
```

Only run the dev server after lint/build pass.

Routine Git commands do not need basic teaching.

---

# 18. Working Style for Future ChatGPT Sessions

When continuing MyLifeDock:

### First

Read this file and identify:

- Current milestone
- Completed work
- Immediate next task
- Relevant architecture
- Relevant constraints

### Then

Inspect the actual current repository files relevant to the task.

Do not assume that an old state description is more accurate than the current source code.

### During implementation

- Make coherent changes.
- Keep UI/application/domain/infrastructure/security responsibilities separated.
- Avoid unnecessary dependencies.
- Avoid unrelated refactoring.
- Preserve working features.
- Think through migration and backward compatibility before changing persisted data.
- Prefer a complete dependency-chain review before providing code.

### After implementation

Run:

```text
npm run lint
npm run build
```

Then perform targeted runtime/manual validation where appropriate.

### Communication

Do not re-teach already completed work.

Do not repeatedly reopen completed security work.

Explain unusual decisions, risks, migrations, and failures clearly, but keep routine Git/CLI explanations brief.

---

# 19. Architecture Audit Rule

A deliberate full architecture review should be performed **once** when the actual repository source is available.

Review:

```text
src/app/
src/application/
src/domain/
src/infrastructure/
src/security/
src/shared/
src/ui/
```

And relevant configuration:

```text
package.json
tsconfig files
vite config
ESLint config
GitHub Actions workflows
Dexie/database schema
```

The review should answer:

- Are responsibilities correctly separated?
- Are there circular dependencies?
- Is UI leaking persistence/security logic?
- Are application services being used consistently?
- Is the domain model coherent?
- Is the database migration strategy safe?
- Is the security boundary clean?
- Are abstractions justified rather than over-engineered?
- Is the architecture still Android-ready?
- Are there unnecessary dependencies?
- Is the current structure appropriate for the next roadmap stages?

**Do not perform large refactors merely because a different architecture is theoretically cleaner.** Refactor only where there is a concrete product or engineering benefit.

---

# 20. Git / CI Status

Git identity:

```text
user.name  = mylifedock
user.email = mylifedock@gmail.com
```

Remote:

```text
https://github.com/mylifedock/mylifedock.git
```

GitHub Actions CI exists and is intentionally useful for DevOps learning.

CI/CD remains secondary to product development.

User is comfortable with:

```text
git status
git add
git commit
git push
git branch
```

---

# 21. Resume Instruction

In a new conversation, say:

> **Resume MyLifeDock from PROJECT_STATE.md**

Then provide this file if repository context is unavailable.

The assistant should:

1. Read this state.
2. Confirm the current milestone.
3. Inspect the actual relevant repository files.
4. Continue from **Products V1**.
5. Avoid revisiting completed security/attachment work unless a regression is found.
6. Avoid unrelated architectural redesign.
7. Keep the product objective above DevOps-learning objectives.

---

# 22. Current State Summary

```text
FOUNDATION                         ✅
React + TypeScript + Vite          ✅
Git/GitHub                         ✅
GitHub Actions CI                 ✅
Architecture foundation            ✅
Dexie / IndexedDB                 ✅
Dashboard                          ✅
Profile onboarding                 ✅

DOCUMENTS V1                       ✅
Document CRUD                      ✅
Attachment support                 ✅
Attachment validation              ✅
Atomic persistence                 ✅
PDF/image preview                  ✅
Download                           ✅
Delete                             ✅
Refresh persistence                ✅
File-input reset UX                ✅

VAULT / SECURITY                   ✅
Vault initialization               ✅
PBKDF2-SHA-256                     ✅
AES-KW wrapped vault key           ✅
AES-256-GCM vault key              ✅
Vault unlock                       ✅
Vault lock                         ✅
Recovery                           ✅
Recovery to new passphrase         ✅
Manual lock                        ✅
30-second auto-lock test           ✅
30-minute production timeout       ✅
Security lifecycle validation      ✅

ATTACHMENT ENCRYPTION              ✅
AES-256-GCM at rest                ✅
Unique 12-byte IV                  ✅
Encrypted IndexedDB Blob           ✅
Encrypted preview                  ✅
Encrypted download                 ✅
Recovery compatibility             ✅

QUALITY                            ✅
npm run lint                       PASS
npm run build                      PASS

CURRENT MILESTONE                  → PRODUCTS V1
NEXT ACTION                        → DATABASE / DOMAIN LAYER
```

---

## Final Rule

**Build MyLifeDock as a real product.**

Security is foundational and already completed for the current milestone. Do not keep polishing the security layer instead of moving the product forward.

The next meaningful work is:

> **Products V1 → database/domain → service → UI → CRUD → details → coverage-ready model.**
