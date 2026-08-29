# 🏛️ MyLifeDock Product Architecture & Technical Specifications
**Document Ref:** MLD-ARCH-V1.0  
**Classification:** Technical Architecture, Security Model & System Topology  
**Security Level:** Zero-Knowledge, Client-Side AES-256-GCM, 100% Offline-First  

---

## 🌐 1. Complete System Architecture Overview (High-Level View)

The following diagram illustrates the complete end-to-end architecture of MyLifeDock across all platforms, abstraction layers, hardware bridges, and security boundaries.

```mermaid
graph TD
    subgraph UI["1. PRESENTATION & USER INTERACTION LAYER (React 19)"]
        Dashboard["📊 Dashboard & Stats"]
        Docs["📄 Documents & Attachments"]
        Products["📦 Products & Warranties"]
        Finance["💳 Finance & Subscriptions"]
        Secrets["🔐 Secrets & Keys"]
        Emergency["🚨 Emergency Family Kit"]
        Settings["⚙️ Settings & Backups"]
    end

    subgraph Bridge["2. PLATFORM ADAPTATION & HARDWARE BRIDGE"]
        WebBridge["🌐 Browser / PWA Engine"]
        TauriBridge["🪟 Tauri v2 Desktop Bridge (Rust)<br/>Windows Hello • OS Save Dialog • Tray • Windows Action Center"]
        CapBridge["📱 Capacitor v8 Mobile Bridge<br/>Biometric Keystore • Filesystem • Local Notifications • Native Share"]
    end

    subgraph Core["3. APPLICATION DOMAIN & WORKER SERVICES"]
        DocService["Document Engine"]
        ProdService["Warranty Engine"]
        OCRWorker["👁️ Tesseract.js OCR Worker<br/>(On-Device WebAssembly)"]
        BackupService["💾 Backup & Export Engine"]
        NotifService["🔔 Reminder & Push Scheduler"]
        DriveService["☁️ Google Drive Sync Bridge"]
    end

    subgraph Security["4. CRYPTOGRAPHIC & SECURITY BOUNDARY (Zero-Knowledge)"]
        KDF["🔑 PBKDF2-SHA256<br/>100,000 Iterations • 16-byte Salt"]
        MasterKey["🛡️ Ephemeral AES-256 Key<br/>(In-Memory Only, extractable: false)"]
        CipherEngine["🔒 AES-GCM 256-bit Engine<br/>12-byte Unique Nonce per Entity"]
        AutoLock["⏱️ 30-Minute Inactivity Sentinel"]
    end

    subgraph Storage["5. PERSISTENCE & DATA STORAGE LAYER"]
        IndexedDB["🗄️ IndexedDB / Dexie.js<br/>(Client Encrypted Tables)"]
        TauriStore["📂 OS AppData Store<br/>(mylifedock.dat)"]
        DriveAppData["☁️ Google Drive appDataFolder<br/>(Hidden Encrypted .mldv)"]
    end

    UI --> Bridge
    Bridge --> Core
    Core --> Security
    Security --> Storage
    DocService --> OCRWorker
    BackupService --> Security
    DriveService --> Security
```

---

## 🔒 2. Data Flow Diagram: Ingestion & Encryption (Level 1 DFD)

This diagram details the exact cryptographic lifecycle of documents, metadata, and binary attachments from the moment the user selects a file.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant UI as 🖥️ React UI
    participant OCR as 👁️ WebAssembly OCR
    participant Core as ⚙️ Document Service
    participant Crypto as 🔐 Web Crypto API (AES-256)
    participant DB as 🗄️ Encrypted Storage (Dexie)

    User->>UI: Select Document / Bill (PDF or Photo)
    UI->>OCR: Send Image Buffer to Web Worker
    OCR-->>UI: Extract Invoice Date, Amount & Warranty Period
    User->>UI: Review & Confirm Document Metadata
    UI->>Core: Save Document & Attachment Blob
    Core->>Crypto: Request Encryption with Master Key
    Note over Crypto: Generates Unique 12-byte Random IV<br/>Applies AES-GCM 256-bit + 128-bit Auth Tag
    Crypto-->>Core: Returns [12-byte IV + Encrypted Ciphertext]
    Core->>DB: Persist Encrypted Entity Record & Blob
    DB-->>UI: Confirm Write Success
    UI-->>User: Display Document in Vault with Active Shield
```

---

## 🔄 3. Zero-Knowledge Cloud Sync & Recovery Dataflow

```mermaid
flowchart TD
    subgraph DeviceA["📱 Local Device (Source)"]
        A1["Unencrypted Vault Tables in RAM"] -->|Serialize to JSON| A2["Plaintext JSON Payload"]
        A2 -->|Compress & Pack| A3["Memory Stream"]
        A3 -->|Encrypt with AES-256-GCM + Random IV| A4["Encrypted .mldv Binary Blob"]
    end

    subgraph Transport["☁️ Zero-Knowledge Cloud Transport"]
        A4 -->|Google OAuth 2.0 Scope: drive.appdata| T1["Google Drive Hidden appDataFolder"]
        Note1["Google servers only see<br/>opaque ciphertext. Zero access to keys."]
    end

    subgraph DeviceB["💻 New Device (Destination)"]
        T1 -->|Download Blob via OAuth| B1["Encrypted .mldv Blob"]
        B1 -->|Provide Master Passphrase OR 24-Word Recovery Key| B2["PBKDF2 Key Derivation"]
        B2 -->|Decrypt AES-GCM| B3["Integrity Verified JSON"]
        B3 -->|Dexie Transaction Bulk Replace| B4["Vault Restored Successfully 🎉"]
    end
```

---

## ⏱️ 4. Vault Lifecycle & Auto-Lock State Machine

```mermaid
stateDiagram-v2
    [*] --> LockedState : App Launch / Cold Boot

    state LockedState {
        [*] --> PromptInput
        PromptInput --> PassphraseInput : Type Passphrase
        PromptInput --> BiometricPrompt : Touch Fingerprint / Windows Hello
        PassphraseInput --> KeyDerivation : Validate Hash
        BiometricPrompt --> KeyRetrieval : Hardware Decrypt
    }

    LockedState --> UnlockedState : Key Validated (AES-256 in RAM)
    LockedState --> LockedState : Invalid Passphrase / Cancelled

    state UnlockedState {
        [*] --> ActiveTimer
        ActiveTimer --> ActiveTimer : User Activity (Click / Scroll / Keypress)
        ActiveTimer --> AutoLocked : 30 Minutes Inactivity
        ActiveTimer --> ManualLocked : Click "Lock Vault" / Tray Menu
    }

    UnlockedState --> LockedState : Master Key Purged from Memory (Garbage Collected)
```

---

## ⚙️ 5. Technical Specifications Matrix

| Dimension | Specification | Standard / Compliance |
| :--- | :--- | :--- |
| **Symmetric Encryption** | AES-256-GCM (Galois/Counter Mode) | FIPS 197 / NIST SP 800-38D |
| **Key Derivation** | PBKDF2-HMAC-SHA256 (100,000 rounds) | NIST SP 800-132 |
| **Nonce / IV Generation** | Cryptographically Secure CSPRNG (`crypto.getRandomValues`) | 96-bit (12 bytes) unique per operation |
| **Integrity Tag** | 128-bit Authentication Tag | AEAD (Authenticated Encryption) |
| **Client Memory Model** | Ephemeral Non-Extractable CryptoKey | Web Crypto API (`extractable: false`) |
| **OCR Processing** | Tesseract.js (WebAssembly on-device) | 100% Offline, Zero Cloud Telemetry |
| **Desktop Shell** | Tauri v2 (Rust 2021, Webview2 / WKWebView) | Memory-safe, ~3.4 MB bundle footprint |
| **Mobile Shell** | Capacitor v8 (Android / iOS) | Android Keystore / Apple Keychain isolation |
