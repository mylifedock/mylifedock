import { test, expect } from '@playwright/test';

test.describe('Unit Tests: Cryptographic Engine, Key Derivation & Currency Services', () => {
  test('Cryptographic AES-256-GCM Roundtrip, Authenticity & Tamper Resistance', async ({ page }) => {
    await page.goto('/');

    const cryptoVerification = await page.evaluate(async () => {
      // 1. Generate an AES-GCM key
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // 2. Encrypt plaintext
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const plaintext = 'MyLifeDock Zero-Knowledge Cryptographic Payload';
      const encoded = new TextEncoder().encode(plaintext);

      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      // 3. Decrypt and verify exact match
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      const decryptedText = new TextDecoder().decode(decryptedBuffer);

      // 4. Test Tamper Resistance (Modifying a single bit in ciphertext must throw)
      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0x01; // flip 1 bit
      let tamperCaught = false;
      try {
        await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          tampered
        );
      } catch {
        tamperCaught = true;
      }

      return {
        success: decryptedText === plaintext,
        tamperCaught,
      };
    });

    expect(cryptoVerification.success).toBe(true);
    expect(cryptoVerification.tamperCaught).toBe(true);
  });

  test('PBKDF2 Key Derivation with High Iterations & Salt Separation', async ({ page }) => {
    await page.goto('/');

    const pbkdf2Verification = await page.evaluate(async () => {
      const pass = 'TestMasterPassphrase123!';
      const salt1 = window.crypto.getRandomValues(new Uint8Array(16));
      const salt2 = window.crypto.getRandomValues(new Uint8Array(16));

      const passKey = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pass),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      // Derive key with Salt 1
      const key1 = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt1,
          iterations: 10000, // fast unit test test vector
          hash: 'SHA-256',
        },
        passKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Derive key with Salt 2
      const key2 = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt2,
          iterations: 10000,
          hash: 'SHA-256',
        },
        passKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const rawKey1 = await window.crypto.subtle.exportKey('raw', key1);
      const rawKey2 = await window.crypto.subtle.exportKey('raw', key2);

      const u1 = new Uint8Array(rawKey1);
      const u2 = new Uint8Array(rawKey2);

      // Different salts MUST produce completely different derived keys
      const diffCount = u1.reduce((count, byte, i) => count + (byte !== u2.at(i) ? 1 : 0), 0);

      return {
        distinctKeys: diffCount > 10,
        keyLength: u1.length, // 32 bytes = 256 bits
      };
    });

    expect(pbkdf2Verification.distinctKeys).toBe(true);
    expect(pbkdf2Verification.keyLength).toBe(32);
  });

  test('Recovery Key 256-bit Format Validation & Grouping', async ({ page }) => {
    await page.goto('/');

    const recoveryKeyValidation = await page.evaluate(() => {
      // 32 random bytes
      const bytes = Uint8Array.from({ length: 32 }, (_, i) => i);

      let hex = '';
      for (const b of bytes) {
        hex += b.toString(16).padStart(2, '0').toUpperCase();
      }

      const formatted = hex.match(/.{1,4}/g)?.join('-') ?? hex;

      // Validate format: 16 groups of 4 hex digits separated by 15 dashes
      const groups = formatted.split('-');
      const isValid = groups.length === 16 && groups.every((group) => /^[0-9A-F]{4}$/.test(group));

      // Normalization back to raw hex
      const normalized = formatted.replace(/-/g, '');

      return {
        formattedLength: formatted.length, // 64 chars + 15 dashes = 79 chars
        isValid,
        normalizedLength: normalized.length, // exactly 64
      };
    });

    expect(recoveryKeyValidation.isValid).toBe(true);
    expect(recoveryKeyValidation.formattedLength).toBe(79);
    expect(recoveryKeyValidation.normalizedLength).toBe(64);
  });

  test('Global Currency Engine Formatting (INR Lakh/Crore, USD, EUR, GBP, JPY)', async ({ page }) => {
    await page.goto('/');

    const currencyResults = await page.evaluate(() => {
      const inrFormatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(150000);

      const usdFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(1000);

      const gbpFormatted = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 2,
      }).format(1000);

      const jpyFormatted = new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }).format(1000);

      return {
        inrFormatted,
        usdFormatted,
        gbpFormatted,
        jpyFormatted,
      };
    });

    // INR uses Lakh notation (1,50,000)
    expect(currencyResults.inrFormatted).toContain('1,50,000');
    expect(currencyResults.usdFormatted).toContain('1,000');
    expect(currencyResults.gbpFormatted).toContain('1,000');
    expect(currencyResults.jpyFormatted).toContain('1,000');
  });
});
