import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  // Dismiss onboarding slides if present on fresh run
  const skipPillarsBtn = page.locator('button:has-text("Skip")').first();
  if (await skipPillarsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipPillarsBtn.click();
  }

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Medical Tester');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
  }

  const confirmInput = page.locator('input#confirmVaultPassphrase');
  const isSetup = await confirmInput.isVisible({ timeout: 4000 }).catch(() => false);
  if (isSetup) {
    await page.fill('input#vaultPassphrase', 'TestPassword1234');
    await page.fill('input#confirmVaultPassphrase', 'TestPassword1234');
    await page.click('button[type="submit"]');

    const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
    await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[type="checkbox"]');
    await continueBtn.click();
  } else {
    const isLocked = await page.locator('input#vaultPassphrase').isVisible({ timeout: 4000 }).catch(() => false);
    if (isLocked) {
      await page.fill('input#vaultPassphrase', 'TestPassword1234');
      await page.click('button[type="submit"]');
    }
  }

  await expect(page.locator('.sidebar, .mobile-topbar-home').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Medical Profile & Health Records Suite', () => {
  test('Medical Profile Service: CRUD, Department Defaulting & Linked Reminders', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const { 
        createMedicalRecord, 
        getMedicalRecords, 
        getMedicalRecordById, 
        updateMedicalRecord, 
        deleteMedicalRecord 
      } = await import('../src/application/medicalService');
      const { db } = await import('../src/infrastructure/database/db');

      // 1. Create a Prescription with no department specified -> Should default to "General"
      const rxId = await createMedicalRecord({
        type: 'prescription',
        title: 'Morning Consultation',
        date: '2026-10-21',
        doctorOrClinic: 'Dr. Sarah Jenkins',
        diagnosis: 'Seasonal Bronchitis',
        medicationsOrSummary: 'Tab Azithromycin 500mg once daily',
        followUpDate: '2026-10-28',
        reminderEnabled: true,
      });

      const rxRecord = await getMedicalRecordById(rxId);
      const isRxSaved = Boolean(rxRecord);
      const isDefaultDeptGeneral = rxRecord?.department === 'General';

      // Verify linked reminder was automatically generated in db.reminders
      const linkedReminder = await db.reminders.where('relatedEntityId').equals(rxId).first();
      const hasLinkedReminder = Boolean(linkedReminder && linkedReminder.dueDate === '2026-10-28');

      // 2. Create a Lab Report with a specific department
      const labId = await createMedicalRecord({
        type: 'lab_report',
        title: 'Comprehensive Lipid Profile',
        date: '2026-10-22',
        department: 'Cardiology',
        doctorOrClinic: 'Metro Diagnostics',
        diagnosis: 'Annual Heart Checkup',
        medicationsOrSummary: 'Total Cholesterol: 185 mg/dL (Desirable < 200)',
      });

      const labRecord = await getMedicalRecordById(labId);
      const isCustomDeptPreserved = labRecord?.department === 'Cardiology';

      // 3. Test Date-wise chronological ordering (newest first)
      const allRecords = await getMedicalRecords();
      const isOrderedNewestFirst = allRecords.length >= 2 && allRecords[0].date >= allRecords[1].date;

      // 4. Update Medical Record
      await updateMedicalRecord(rxId, {
        diagnosis: 'Resolved Bronchitis - Follow up optional',
      });
      const updatedRx = await getMedicalRecordById(rxId);
      const isUpdated = updatedRx?.diagnosis === 'Resolved Bronchitis - Follow up optional';

      // 5. Delete and verify cascade cleanup of linked reminder
      await deleteMedicalRecord(rxId);
      const deletedCheck = await getMedicalRecordById(rxId);
      const reminderCleanedUp = !(await db.reminders.where('relatedEntityId').equals(rxId).first());

      // Clean up lab report
      await deleteMedicalRecord(labId);

      return {
        isRxSaved,
        isDefaultDeptGeneral,
        hasLinkedReminder,
        isCustomDeptPreserved,
        isOrderedNewestFirst,
        isUpdated,
        isDeleted: !deletedCheck,
        reminderCleanedUp,
      };
    });

    expect(result.isRxSaved).toBe(true);
    expect(result.isDefaultDeptGeneral).toBe(true);
    expect(result.hasLinkedReminder).toBe(true);
    expect(result.isCustomDeptPreserved).toBe(true);
    expect(result.isOrderedNewestFirst).toBe(true);
    expect(result.isUpdated).toBe(true);
    expect(result.isDeleted).toBe(true);
    expect(result.reminderCleanedUp).toBe(true);
  });

  test('Beta Smart Capture: Heuristics & OCR Medical Text Parsing', async ({ page }) => {
    await page.goto('/');

    const parseVerification = await page.evaluate(async () => {
      const { parseMedicalOcrText } = await import('../src/application/medicalService');

      // Sample OCR text from a Doctor Prescription
      const samplePrescriptionOcr = `
        APOLLO HEALTHCARE CLINIC
        Dr. Marcus Aurelius, M.D. (Cardiology)
        Date: 2026-10-21
        Patient: John Doe, Age: 38

        Rx:
        1. Tab Metoprolol 50mg - 1-0-0 after food
        2. Tab Atorvastatin 20mg - 0-0-1 after dinner
        Follow-up after 2 weeks for blood pressure review.
      `;

      const rxParsed = parseMedicalOcrText(samplePrescriptionOcr);

      // Sample OCR text from a Laboratory Report
      const sampleLabOcr = `
        METROPOLIS PATHOLOGY & DIAGNOSTIC LABS
        Investigation: Complete Blood Count & Serum Glucose
        Specimen: Venous Blood
        Collection Date: 2026-10-20

        TEST NAME          RESULT       REFERENCE RANGE
        Haemoglobin        14.2 g/dL    13.0 - 17.0
        Fasting Glucose    95 mg/dL     70 - 100
        Status: Normal
      `;

      const labParsed = parseMedicalOcrText(sampleLabOcr);

      return {
        rxType: rxParsed.detectedType,
        rxDate: rxParsed.detectedDate,
        rxDept: rxParsed.detectedDepartment,
        rxHasSummary: Boolean(rxParsed.detectedSummary && rxParsed.detectedSummary.includes('Metoprolol')),
        labType: labParsed.detectedType,
        labDate: labParsed.detectedDate,
        labDept: labParsed.detectedDepartment,
        labHasSummary: Boolean(labParsed.detectedSummary && labParsed.detectedSummary.includes('Haemoglobin')),
      };
    });

    expect(parseVerification.rxType).toBe('prescription');
    expect(parseVerification.rxDate).toBe('2026-10-21');
    expect(parseVerification.rxDept).toBe('Cardiology');
    expect(parseVerification.rxHasSummary).toBe(true);

    expect(parseVerification.labType).toBe('lab_report');
    expect(parseVerification.labDate).toBe('2026-10-20');
    expect(parseVerification.labDept).toBe('Pathology & Diagnostics');
    expect(parseVerification.labHasSummary).toBe(true);
  });

  test('Universal Search: Indexes and Finds Medical Prescriptions & Lab Reports', async ({ page }) => {
    await page.goto('/');

    const searchVerification = await page.evaluate(async () => {
      const { createMedicalRecord, deleteMedicalRecord } = await import('../src/application/medicalService');
      const { universalSearch } = await import('../src/application/searchService');

      const id = await createMedicalRecord({
        type: 'prescription',
        title: 'Neurology Consultation',
        date: '2026-10-22',
        department: 'Neurology',
        doctorOrClinic: 'Dr. Gregory House',
        diagnosis: 'Tension Headache',
        medicationsOrSummary: 'Tab Sumatriptan 50mg SOS',
      });

      // Search by doctor name
      const searchByDoctor = await universalSearch('Gregory House');
      const foundDoctor = searchByDoctor.some((r) => r.type === 'medical' && r.title.includes('Neurology Consultation'));

      // Search by medication
      const searchByMed = await universalSearch('Sumatriptan');
      const foundMed = searchByMed.some((r) => r.type === 'medical');

      // Search by department
      const searchByDept = await universalSearch('Neurology');
      const foundDept = searchByDept.some((r) => r.type === 'medical');

      // Clean up
      await deleteMedicalRecord(id);

      return {
        foundDoctor,
        foundMed,
        foundDept,
      };
    });

    expect(searchVerification.foundDoctor).toBe(true);
    expect(searchVerification.foundMed).toBe(true);
    expect(searchVerification.foundDept).toBe(true);
  });

  test('UI & Sub-module Flow: Adding Prescription, Tab Filtering & Timeline Card Rendering', async ({ page }) => {
    await ensureUnlocked(page);

    // Navigate to Medical & Health Records from Sidebar
    const navBtn = page.locator('button.nav-item:has-text("Medical & Health")');
    if (await navBtn.isVisible()) {
      await navBtn.click();
    } else {
      // If mobile view, open sidebar or navigate
      const dirBtn = page.locator('button[aria-label="Sections"]');
      if (await dirBtn.isVisible()) {
        await dirBtn.click();
      }
      await page.click('button.nav-item:has-text("Medical & Health")');
    }

    // Verify Page Title is rendered
    await expect(page.locator('h1.page-title:has-text("Medical & Health")')).toBeVisible();

    // Verify Sub-module Tabs exist
    await expect(page.locator('button.tab:has-text("All Records")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Prescriptions")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Lab Reports")')).toBeVisible();

    // Click "+ Add Prescription"
    await page.click('button:has-text("+ Add Prescription")');
    await expect(page.locator('h2:has-text("Add Prescription / Lab Report")')).toBeVisible();

    // Fill form
    await page.fill('input#med-title', 'Ophthalmology Eye Exam');
    await page.fill('input#med-department', 'Ophthalmology / Eye');
    await page.fill('input#med-doctor', 'Dr. Watson Eye Care');
    await page.fill('input#med-diagnosis', 'Dry Eyes & Astigmatism');
    await page.fill('textarea#med-summary', '1. Carboxymethylcellulose eye drops 0.5% (4 times daily)');

    // Save record
    await page.click('button[type="submit"]:has-text("Save Record")');

    // Verify timeline card is rendered with correct badges
    await expect(page.locator('h3:has-text("Ophthalmology Eye Exam")')).toBeVisible();
    await expect(page.locator('span:has-text("Prescription")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Ophthalmology / Eye")').first()).toBeVisible();
  });
});
