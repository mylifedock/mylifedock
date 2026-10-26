import { test, expect } from '@playwright/test';

test('OCR runs on-device with the self-hosted engine under the app CSP (no CDN)', async ({ page }) => {
  test.setTimeout(120_000);
  const cdnRequests: string[] = [];
  const cspViolations: string[] = [];
  page.on('request', (r) => {
    if (/jsdelivr|unpkg|tessdata/.test(r.url())) cdnRequests.push(r.url());
  });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text());
  });

  await page.goto('/');
  const text = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 260;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 56px Arial';
    ctx.fillText('ACME STORES', 40, 90);
    ctx.fillText('TOTAL 1499.00', 40, 190);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));

    const ocr = await import(/* @vite-ignore */ '/src/application/ocrService.ts');
    const raw = await ocr.extractTextFromImage(blob);
    await ocr.cleanupOcrWorker();
    return raw;
  });

  expect(text.toUpperCase()).toContain('TOTAL');
  expect(text).toContain('1499');
  expect(cdnRequests).toEqual([]);
  expect(cspViolations).toEqual([]);
});
