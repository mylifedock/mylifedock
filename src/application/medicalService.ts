import { db, type MedicalRecord, type MedicalRecordType, type ReminderRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export interface CreateMedicalRecordInput {
  ownerId?: string; // "local-profile" (self) or child/dependent profile ID
  type: MedicalRecordType;
  title: string;
  date: string; // YYYY-MM-DD
  department?: string; // Optional: defaults to "General"
  doctorOrClinic?: string;
  diagnosis?: string;
  medicationsOrSummary?: string;
  followUpDate?: string;
  reminderEnabled?: boolean;
  attachmentIds?: string[];
}

export interface UpdateMedicalRecordInput {
  ownerId?: string;
  type?: MedicalRecordType;
  title?: string;
  date?: string;
  department?: string;
  doctorOrClinic?: string;
  diagnosis?: string;
  medicationsOrSummary?: string;
  followUpDate?: string;
  reminderEnabled?: boolean;
  attachmentIds?: string[];
}

export const COMMON_DEPARTMENTS = [
  "General",
  "Cardiology",
  "Pediatrics",
  "Dermatology",
  "Orthopedics",
  "Ophthalmology / Eye",
  "Dental",
  "ENT (Ear, Nose, Throat)",
  "Neurology",
  "Gynecology & Obstetrics",
  "Gastroenterology",
  "Pathology & Diagnostics",
  "Radiology / Imaging",
  "Pulmonology",
  "Endocrinology",
  "Psychiatry",
  "Other"
] as const;

export async function createMedicalRecord(input: CreateMedicalRecordInput): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const department = input.department?.trim() ? input.department.trim() : "General";

  const record: MedicalRecord = {
    id,
    ownerId: input.ownerId || LOCAL_PROFILE_ID,
    type: input.type,
    title: input.title.trim() || (input.type === "prescription" ? `Consultation - ${department}` : `Lab Report - ${department}`),
    date: input.date || now.split("T")[0],
    department,
    doctorOrClinic: input.doctorOrClinic?.trim() || undefined,
    diagnosis: input.diagnosis?.trim() || undefined,
    medicationsOrSummary: input.medicationsOrSummary?.trim() || undefined,
    followUpDate: input.followUpDate?.trim() || undefined,
    attachmentIds: input.attachmentIds || [],
    createdAt: now,
    updatedAt: now,
  };

  await db.medicalRecords.add(record);

  // If follow-up date and reminder are specified, create a linked reminder in db.reminders
  if (input.reminderEnabled && input.followUpDate) {
    const reminderId = crypto.randomUUID();
    const reminder: ReminderRecord = {
      id: reminderId,
      ownerId: LOCAL_PROFILE_ID,
      title: `Medical Follow-up: ${record.title} (${department})`,
      dueDate: input.followUpDate,
      relatedEntityType: "medical",
      relatedEntityId: id,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.reminders.add(reminder);
  }

  return id;
}

export async function getMedicalRecords(filter?: { ownerId?: string }): Promise<MedicalRecord[]> {
  let records = await db.medicalRecords.toArray();
  if (filter?.ownerId && filter.ownerId !== "all") {
    records = records.filter((r) => r.ownerId === filter.ownerId);
  }
  // Sort date-wise: newest consultation/report date first
  return records.sort((a, b) => {
    const dateA = a.date || a.createdAt;
    const dateB = b.date || b.createdAt;
    return dateB.localeCompare(dateA);
  });
}

export async function getMedicalRecordById(id: string): Promise<MedicalRecord | undefined> {
  return db.medicalRecords.get(id);
}

export async function updateMedicalRecord(id: string, input: UpdateMedicalRecordInput): Promise<void> {
  const existing = await db.medicalRecords.get(id);
  if (!existing) throw new Error("Medical record not found");

  const now = new Date().toISOString();
  const department = input.department !== undefined
    ? (input.department.trim() || "General")
    : existing.department;

  const updates: Partial<MedicalRecord> = {
    ...input,
    department,
    updatedAt: now,
  };

  await db.medicalRecords.update(id, updates);

  // Manage linked follow-up reminder
  if (input.reminderEnabled !== undefined || input.followUpDate !== undefined) {
    const existingReminder = await db.reminders.where("relatedEntityId").equals(id).first();
    const followUp = input.followUpDate !== undefined ? input.followUpDate : existing.followUpDate;
    const shouldEnable = input.reminderEnabled !== undefined ? input.reminderEnabled : Boolean(existingReminder);

    if (shouldEnable && followUp) {
      const title = `Medical Follow-up: ${input.title || existing.title} (${department})`;
      if (existingReminder) {
        await db.reminders.update(existingReminder.id, {
          title,
          dueDate: followUp,
          enabled: true,
          updatedAt: now,
        });
      } else {
        await db.reminders.add({
          id: crypto.randomUUID(),
          ownerId: LOCAL_PROFILE_ID,
          title,
          dueDate: followUp,
          relatedEntityType: "medical",
          relatedEntityId: id,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (!shouldEnable && existingReminder) {
      await db.reminders.delete(existingReminder.id);
    }
  }
}

export async function deleteMedicalRecord(id: string): Promise<void> {
  await db.medicalRecords.delete(id);

  // Clean up linked reminders
  const linkedReminders = await db.reminders.where("relatedEntityId").equals(id).toArray();
  for (const r of linkedReminders) {
    await db.reminders.delete(r.id);
  }

  // Clean up linked attachments
  const linkedAttachments = await db.attachments.where("documentId").equals(id).toArray();
  for (const att of linkedAttachments) {
    await db.attachments.delete(att.id);
  }
}

/**
 * Returns distinct departments present in stored medical records merged with common standards.
 */
export async function getExistingDepartments(): Promise<string[]> {
  const records = await db.medicalRecords.toArray();
  const set = new Set<string>(COMMON_DEPARTMENTS);
  for (const r of records) {
    if (r.department) set.add(r.department);
  }
  return Array.from(set);
}

export interface ParsedMedicalScan {
  detectedType: MedicalRecordType;
  detectedDate?: string;
  detectedDoctorOrClinic?: string;
  detectedDepartment: string;
  detectedDiagnosis?: string;
  detectedSummary?: string;
}

/**
 * Beta Smart Capture: Parses OCR text extracted from a prescription or lab report
 * to intelligently pre-fill form fields.
 */
export function parseMedicalOcrText(rawText: string): ParsedMedicalScan {
  const text = rawText || "";
  const lower = text.toLowerCase();

  // 1. Detect Type
  let detectedType: MedicalRecordType = "prescription";
  const labKeywords = ["lab", "report", "test", "investigation", "serum", "specimen", "reference range", "haemoglobin", "cbc", "lipid", "pathology", "diagnostics", "result", "normal range", "biochemistry"];
  const prescriptionKeywords = ["rx", "prescription", "tablet", "tab.", "capsule", "cap.", "syrup", "syp.", "dosage", "mg", "once daily", "twice daily", "after food", "before food", "dr."];

  let labScore = 0;
  for (const kw of labKeywords) {
    if (lower.includes(kw)) labScore++;
  }
  let rxScore = 0;
  for (const kw of prescriptionKeywords) {
    if (lower.includes(kw)) rxScore++;
  }
  if (labScore > rxScore) {
    detectedType = "lab_report";
  }

  // 2. Detect Department
  let detectedDepartment = "General";
  const deptMap: Record<string, string[]> = {
    "Cardiology": ["cardio", "heart", "ecg", "echo", "troponin", "blood pressure", "hypertension", "angio"],
    "Dermatology": ["derma", "skin", "rash", "eczema", "acne", "psoriasis", "scalp"],
    "Pediatrics": ["pediatr", "paediatr", "child", "infant", "vaccin", "growth", "baby"],
    "Orthopedics": ["ortho", "bone", "fracture", "joint", "spine", "arthritis", "ligament", "knee", "x-ray"],
    "Ophthalmology / Eye": ["ophthal", "eye", "vision", "cataract", "retina", "glaucoma", "lens", "optom"],
    "Dental": ["dental", "tooth", "teeth", "molar", "caries", "root canal", "gums", "dentist"],
    "ENT (Ear, Nose, Throat)": ["ent", "ear", "nose", "throat", "tonsil", "sinus", "larynx", "otitis"],
    "Neurology": ["neuro", "brain", "eeg", "migraine", "stroke", "seizure", "nerve"],
    "Gynecology & Obstetrics": ["gyn", "obstetr", "pregnan", "ultrasound", "pelvis", "uterus", "pcos"],
    "Gastroenterology": ["gastro", "liver", "stomach", "endoscopy", "colon", "abdomen", "pancreas"],
    "Pathology & Diagnostics": ["cbc", "complete blood", "urine", "culture", "thyroid", "tsh", "hba1c", "creatinine"],
    "Radiology / Imaging": ["mri", "ct scan", "sonography", "mammography", "ultrasonography"],
    "Pulmonology": ["pulmo", "chest", "lung", "asthma", "cough", "spiro", "bronch"],
    "Endocrinology": ["diabet", "sugar", "insulin", "glucose", "hormone", "thyroid"]
  };

  for (const [dept, keywords] of Object.entries(deptMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detectedDepartment = dept;
      break;
    }
  }

  // 3. Detect Date (e.g. 21/10/2026, 2026-10-21, 21-10-2026, 21 Oct 2026)
  let detectedDate: string | undefined;
  const isoDateMatch = text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
  if (isoDateMatch) {
    detectedDate = isoDateMatch[1].replace(/[/.]/g, "-");
  } else {
    const dmyMatch = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      detectedDate = `${year}-${month}-${day}`;
    } else {
      const namedMonthMatch = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(20\d{2})\b/i);
      if (namedMonthMatch) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const day = namedMonthMatch[1].padStart(2, "0");
        const monthIdx = monthNames.indexOf(namedMonthMatch[2].toLowerCase().slice(0, 3)) + 1;
        const month = String(monthIdx).padStart(2, "0");
        const year = namedMonthMatch[3];
        detectedDate = `${year}-${month}-${day}`;
      }
    }
  }

  // 4. Detect Doctor, Clinic, or Hospital
  let detectedDoctorOrClinic: string | undefined;
  const drMatch = text.match(/(?:Dr\.|Doctor)\s+([A-Za-z.\s]{3,40})/);
  if (drMatch) {
    const rawName = drMatch[1].split(/[\r\n,;]/)[0].trim();
    if (rawName) {
      detectedDoctorOrClinic = `Dr. ${rawName}`;
    }
  } else {
    const clinicMatch = text.match(/([A-Z][A-Za-z0-9&'\s]+(?:Hospital|Clinic|Healthcare|Diagnostic|Labs|Medical Center))/i);
    if (clinicMatch) {
      detectedDoctorOrClinic = clinicMatch[1].trim();
    }
  }

  // 5. Detect Medications or Findings for Summary
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 5);
  const relevantLines = lines.filter((l) => {
    const lineLower = l.toLowerCase();
    return lineLower.includes("tab") ||
      lineLower.includes("cap") ||
      lineLower.includes("mg") ||
      lineLower.includes("daily") ||
      lineLower.includes("diagnos") ||
      lineLower.includes("result") ||
      lineLower.includes("normal") ||
      lineLower.includes("high") ||
      lineLower.includes("low") ||
      lineLower.includes("g/dl") ||
      lineLower.includes("range") ||
      lineLower.includes("haemo") ||
      lineLower.includes("hemo") ||
      lineLower.includes("glucose") ||
      lineLower.includes("cholesterol") ||
      lineLower.includes("count") ||
      lineLower.includes("serum");
  });

  const detectedSummary = relevantLines.slice(0, 8).join("\n") || undefined;

  return {
    detectedType,
    detectedDate,
    detectedDoctorOrClinic,
    detectedDepartment,
    detectedSummary,
  };
}
