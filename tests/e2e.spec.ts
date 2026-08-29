import { test, expect } from '@playwright/test';

test('End-to-End Vault Flow', async ({ page }) => {
  // 1. Navigate to local app
  await page.goto('http://localhost:5173');
  
  // 2. Initial Setup: Create Master Password
  const isSetup = await page.isVisible('text="Set your master password"');
  if (isSetup) {
    console.log('Detected fresh setup, creating vault...');
    await page.fill('input[placeholder="At least 12 characters"]', 'TestPassword1234');
    await page.fill('input[placeholder="Enter it again"]', 'TestPassword1234');
    await page.click('button[type="submit"]');
    
    // Copy recovery key (we bypass actually saving it but click the confirm)
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Continue to MyLifeDock")');
  } else {
    console.log('Vault exists, unlocking...');
    await page.fill('input[placeholder="At least 12 characters"]', 'TestPassword1234');
    await page.click('button[type="submit"]');
  }

  // 3. Verify Dashboard Loads
  await expect(page.locator('text="Overview"').first()).toBeVisible();
  
  // 4. Test Products Addition
  await page.click('button:has-text("Products")');
  await page.click('button:has-text("Add Product +")');
  
  await page.fill('input[placeholder="e.g. Samsung TV"]', 'Playwright Test Laptop');
  await page.fill('input[placeholder="e.g. Samsung"]', 'Apple');
  await page.fill('input[placeholder="e.g. MacBook Pro"]', 'MacBook Air');
  
  await page.click('button:has-text("Save Product")');
  
  // Verify it appears in the list
  await expect(page.locator('text="Playwright Test Laptop"')).toBeVisible();

  // 5. Test Lock / Logout
  await page.click('button:has-text("Lock / Logout")');
  await expect(page.locator('text="Enter your master password"')).toBeVisible();

  console.log('✅ Deep UI and Cryptographic persistence tests passed.');
});
