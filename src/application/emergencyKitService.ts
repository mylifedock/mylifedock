import { db, type DocumentRecord, type CoverageRecord, type EmergencyKitData, type ProfileRecord } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

/**
 * What the Emergency Kit screen shows and edits for one person. Blood group,
 * allergies, doctor and notes are stored on the person's profile (the same
 * fields the family profile uses); the rest is stored in `profile.emergencyKit`.
 */
export interface EmergencyProfile {
  fullName: string;
  bloodGroup: string;
  allergies: string;
  medications: string;
  organDonor: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  doctorName: string;
  doctorPhone: string;
  willLocation: string;
  notes: string;
}

/** Builds before 1.4 kept the kit in plaintext localStorage; it is moved into the encrypted profile. */
const LEGACY_STORAGE_KEY = "mylifedock_emergency_profile";

export const EMPTY_EMERGENCY_PROFILE: EmergencyProfile = {
  fullName: "",
  bloodGroup: "",
  allergies: "",
  medications: "",
  organDonor: false,
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  doctorName: "",
  doctorPhone: "",
  willLocation: "",
  notes: "",
};

/** Keeps only known fields with the expected types (legacy data was free-form JSON). */
function normalize(value: unknown): EmergencyProfile {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    fullName: text(source.fullName),
    bloodGroup: text(source.bloodGroup),
    allergies: text(source.allergies),
    medications: text(source.medications),
    organDonor: source.organDonor === true,
    emergencyContactName: text(source.emergencyContactName),
    emergencyContactPhone: text(source.emergencyContactPhone),
    emergencyContactRelation: text(source.emergencyContactRelation),
    doctorName: text(source.doctorName),
    doctorPhone: text(source.doctorPhone),
    willLocation: text(source.willLocation),
    notes: text(source.notes),
  };
}

function fromProfile(profile: ProfileRecord): EmergencyProfile {
  const kit: Partial<EmergencyKitData> = profile.emergencyKit ?? {};
  return normalize({
    ...kit,
    fullName: kit.fullName || (profile.id === LOCAL_PROFILE_ID ? "" : profile.displayName),
    bloodGroup: profile.bloodGroup ?? kit.bloodGroup,
    allergies: profile.allergies ?? kit.allergies,
    doctorName: profile.pediatricianOrDoctor ?? kit.doctorName,
    notes: profile.emergencyNotes ?? kit.notes,
  });
}

export async function saveEmergencyProfile(data: EmergencyProfile, profileId: string = LOCAL_PROFILE_ID): Promise<void> {
  const kit = normalize(data);
  const updated = await db.profiles.update(profileId, {
    bloodGroup: kit.bloodGroup.trim() || undefined,
    allergies: kit.allergies.trim() || undefined,
    pediatricianOrDoctor: kit.doctorName.trim() || undefined,
    emergencyNotes: kit.notes.trim() || undefined,
    emergencyKit: {
      fullName: kit.fullName,
      medications: kit.medications,
      organDonor: kit.organDonor,
      emergencyContactName: kit.emergencyContactName,
      emergencyContactPhone: kit.emergencyContactPhone,
      emergencyContactRelation: kit.emergencyContactRelation,
      doctorPhone: kit.doctorPhone,
      willLocation: kit.willLocation,
    },
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error("This profile could not be found. Restart the app and try again.");
}

/** Reads one person's kit from the encrypted profile, migrating a plaintext copy left by older builds. */
export async function getEmergencyProfile(profileId: string = LOCAL_PROFILE_ID): Promise<EmergencyProfile> {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }

  if (legacy !== null) {
    const owner = await db.profiles.get(LOCAL_PROFILE_ID);
    if (owner && !owner.emergencyKit) {
      try {
        await saveEmergencyProfile(normalize(JSON.parse(legacy)), LOCAL_PROFILE_ID);
      } catch {
        // Unreadable legacy data is dropped below rather than kept in plaintext.
      }
    }
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
  }

  const profile = await db.profiles.get(profileId);
  return profile ? fromProfile(profile) : { ...EMPTY_EMERGENCY_PROFILE };
}
/** Escapes user text for the generated document. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate a clean, standalone, printable Emergency Summary document for family and medical personnel
 */
export async function generateEmergencySummaryHtml(profileId: string = LOCAL_PROFILE_ID): Promise<string> {
  const profile = await getEmergencyProfile(profileId);
  const documents = await db.documents.where("ownerId").equals(profileId).toArray();
  const coverages = await db.coverages.toArray();

  const idDocs = documents.filter((d: DocumentRecord) => d.category === "identity" || d.category === "insurance");
  const healthInsurances = coverages.filter((c: CoverageRecord) => c.type === "insurance");
  const e = escapeHtml;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>MyLifeDock - Emergency Family Kit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; padding: 32px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .badge { background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; }
    .section { margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; }
    h2 { margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .item strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .item span { font-size: 14px; font-weight: 500; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { color: #64748b; font-size: 11px; text-transform: uppercase; }
    .hint { margin-top: 24px; text-align: center; font-size: 13px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Emergency Family Kit</h1>
      <small style="color: #64748b;">Generated from MyLifeDock Private Vault on ${e(new Date().toLocaleDateString())}</small>
    </div>
    <span class="badge">CONFIDENTIAL MEDICAL &amp; LEGAL</span>
  </div>

  <div class="section">
    <h2>1. Primary Medical Profile</h2>
    <div class="grid">
      <div class="item"><strong>Full Name</strong><span>${e(profile.fullName || "Not Specified")}</span></div>
      <div class="item"><strong>Blood Group</strong><span style="color: #dc2626; font-weight: bold;">${e(profile.bloodGroup || "Not Specified")}</span></div>
      <div class="item"><strong>Allergies</strong><span>${e(profile.allergies || "None Reported")}</span></div>
      <div class="item"><strong>Critical Medications</strong><span>${e(profile.medications || "None")}</span></div>
      <div class="item"><strong>Organ Donor Status</strong><span>${profile.organDonor ? "Yes (Registered Donor)" : "No / Unspecified"}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>2. Emergency Contacts</h2>
    <div class="grid">
      <div class="item"><strong>Next of Kin</strong><span>${e(profile.emergencyContactName || "N/A")} (${e(profile.emergencyContactRelation || "Contact")})</span></div>
      <div class="item"><strong>Emergency Phone</strong><span>${e(profile.emergencyContactPhone || "N/A")}</span></div>
      <div class="item"><strong>Primary Doctor / Hospital</strong><span>${e(profile.doctorName || "N/A")}</span></div>
      <div class="item"><strong>Doctor Phone</strong><span>${e(profile.doctorPhone || "N/A")}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>3. Insurance Quick Reference</h2>
    ${healthInsurances.length === 0 ? "<p style='font-size:13px; color:#64748b;'>No policies logged in vault.</p>" : `
      <table>
        <thead><tr><th>Type</th><th>Provider</th><th>Policy Number</th><th>End Date</th></tr></thead>
        <tbody>
          ${healthInsurances.map((c: CoverageRecord) => `
            <tr>
              <td>${e(c.type.toUpperCase())}</td>
              <td>${e(c.provider || "N/A")}</td>
              <td><strong>${e(c.policyNumber || "N/A")}</strong></td>
              <td>${e(c.endDate || "N/A")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `}
  </div>

  <div class="section">
    <h2>4. Key Identity Records in Vault</h2>
    ${idDocs.length === 0 ? "<p style='font-size:13px; color:#64748b;'>No identity documents registered.</p>" : `
      <table>
        <thead><tr><th>Document</th><th>Issuer</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${idDocs.map((doc: DocumentRecord) => `
            <tr>
              <td>${e(doc.title)}</td>
              <td>${e(doc.issuer || "N/A")}</td>
              <td>${e(doc.expiryDate || "N/A")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `}
  </div>

  <div class="section">
    <h2>5. Legal & Critical Notes</h2>
    <div class="grid">
      <div class="item"><strong>Will / Property Deeds Location</strong><span>${e(profile.willLocation || "Stored securely")}</span></div>
    </div>
    ${profile.notes ? `<p style="margin-top: 10px; font-size: 13px; white-space: pre-wrap;">${e(profile.notes)}</p>` : ""}
  </div>

  <p class="hint">Use your browser's Print command to print this page or save it as a PDF.</p>
</body>
</html>
`;
}
