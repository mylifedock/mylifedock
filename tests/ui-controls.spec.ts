import { test, expect, type Page } from '@playwright/test';

// Every section, add form and dialog, at desktop and phone width: dropdowns must be opaque
// (otherwise Windows/Android draw the open list white with white text), no light-on-light
// text, and no horizontal overflow.
const PASS = 'Audit-Pass-2026';

async function setup(page: Page) {
  await page.goto('/');
  await page.locator('button:has-text("Skip"), input#displayName').first().waitFor({ timeout: 60000 });
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.fill('input#displayName', 'Auditor');
  await page.check('input#termsCheckbox');
  await page.click('button:has-text("Create my local vault")');
  await page.fill('input#vaultPassphrase', PASS);
  await page.fill('input#confirmVaultPassphrase', PASS);
  await page.click('button[type="submit"]');
  await page.locator('button:has-text("Continue to MyLifeDock")').waitFor({ timeout: 20000 });
  await page.check('input[type="checkbox"]');
  await page.click('button:has-text("Continue to MyLifeDock")');
  await page.locator('text="Overview"').first().waitFor();
}

async function audit(page: Page, label: string): Promise<string[]> {
  return page.evaluate((where) => {
    const issues: string[] = [];
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
      return { r: +r, g: +g, b: +b, a: +a };
    };
    const lum = (c: { r: number; g: number; b: number }) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;

    for (const sel of Array.from(document.querySelectorAll('select'))) {
      if (!(sel as HTMLElement).offsetParent) continue;
      const bg = parse(getComputedStyle(sel).backgroundColor);
      if (!bg || bg.a < 1) issues.push(`${where}: see-through select ${name(sel)} (${getComputedStyle(sel).backgroundColor})`);
      for (const opt of Array.from(sel.options)) {
        const ob = parse(getComputedStyle(opt).backgroundColor);
        const oc = parse(getComputedStyle(opt).color);
        if (ob && oc && ob.a > 0 && Math.abs(lum(ob) - lum(oc)) < 0.4) issues.push(`${where}: low-contrast option in ${name(sel)}`);
        if (ob && ob.a > 0 && lum(ob) > 0.8) issues.push(`${where}: light option list in ${name(sel)}`);
      }
    }

    // Light text on a light (opaque) background anywhere visible.
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const he = el as HTMLElement;
      if (!he.offsetParent || !he.childNodes.length) continue;
      const hasText = Array.from(he.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!hasText) continue;
      const cs = getComputedStyle(he);
      const fg = parse(cs.color);
      let node: HTMLElement | null = he;
      let bg = null;
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a >= 0.9) { bg = c; break; }
        node = node.parentElement;
      }
      if (fg && bg && lum(bg) > 0.75 && lum(fg) > 0.7) issues.push(`${where}: light-on-light text in ${name(he)} "${he.textContent?.trim().slice(0, 30)}"`);
    }

    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      const wide = Array.from(document.querySelectorAll('body *')).find((e) => (e as HTMLElement).getBoundingClientRect().right > document.documentElement.clientWidth + 1);
      issues.push(`${where}: horizontal overflow (${wide ? name(wide) : 'unknown'})`);
    }
    return issues;
  }, label);
}

for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 360, height: 740 }]) {
  test(`readable controls and no overflow: ${vp.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setup(page);
    const issues: string[] = [...(await audit(page, 'dashboard'))];

    const sections: { nav: string; add?: string; tabs?: { tab: string; add?: string }[] }[] = [
      { nav: 'Documents', add: '+ Add Document' },
      { nav: 'Products & Warranties', add: '+ Add Product' },
      { nav: 'Reminders', add: '+ Add Reminder' },
      { nav: 'Insurance', add: '+ Add Policy' },
      { nav: 'Money', add: '+ Add Account', tabs: [{ tab: 'Subscriptions', add: '+ Add Subscription' }] },
      { nav: 'Vehicles & Property', add: '+ Add Vehicle', tabs: [{ tab: 'Properties', add: '+ Add Property' }] },
      { nav: 'Medical & Health', add: '+ Add Prescription' },
      { nav: 'Secrets', add: '+ Add Secret' },
      { nav: 'Emergency Kit' },
      { nav: 'Settings & Backup', tabs: [{ tab: 'Security' }, { tab: 'Family' }, { tab: 'Preferences' }, { tab: 'Plan' }] },
      { nav: 'Help & Feedback' },
    ];

    const go = async (nav: string) => {
      if (vp.name === 'phone') await page.locator('.mobile-menu-btn').first().click();
      await page.locator(`aside button:has-text("${nav}")`).click();
      await page.waitForTimeout(300);
    };
    const add = async (label: string, where: string) => {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
        issues.push(...(await audit(page, `${where} form`)));
      } else {
        issues.push(`${where}: add button "${label}" not found`);
      }
    };

    for (const s of sections) {
      await go(s.nav);
      issues.push(...(await audit(page, s.nav)));
      if (s.add) await add(s.add, s.nav);
      for (const t of s.tabs ?? []) {
        await go(s.nav);
        await page.getByRole('tab', { name: t.tab }).click();
        await page.waitForTimeout(200);
        issues.push(...(await audit(page, `${s.nav} > ${t.tab}`)));
        if (t.add) await add(t.add, `${s.nav} > ${t.tab}`);
      }
    }

    // Upgrade screen and family dialog.
    await go('Settings & Backup');
    await page.getByRole('tab', { name: 'Family' }).click();
    await page.locator('button:has-text("Add family member")').first().click();
    issues.push(...(await audit(page, 'Add family member dialog')));
    await page.locator('[role="dialog"] button:has-text("Cancel")').click();

    expect([...new Set(issues)]).toEqual([]);
  });
}
