import { db, type DocumentRecord, type CoverageRecord } from "../infrastructure/database/db";

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

const EMERGENCY_PROFILE_KEY = "mylifedock_emergency_profile";

export function getEmergencyProfile(): EmergencyProfile {
  try {
    const raw = localStorage.getItem(EMERGENCY_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }

  return {
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
}

export function saveEmergencyProfile(profile: EmergencyProfile): void {
  localStorage.setItem(EMERGENCY_PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Generate a clean, standalone, printable Emergency Summary document for family and medical personnel
 */
export async function generateEmergencySummaryHtml(): Promise<string> {
  const profile = getEmergencyProfile();
  const documents = await db.documents.toArray();
  const coverages = await db.coverages.toArray();

  const idDocs = documents.filter((d: DocumentRecord) => d.category === "identity" || d.category === "insurance");
  const healthInsurances = coverages.filter((c: CoverageRecord) => c.type === "insurance");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MyLifeDock - Emergency Family Kit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; padding: 32px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .badge { background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; }
    .section { margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; }
    h2 { margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .item strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .item span { font-size: 14px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { color: #64748b; font-size: 11px; text-transform: uppercase; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Emergency Family Kit</h1>
      <small style="color: #64748b;">Generated from MyLifeDock Private Vault on ${new Date().toLocaleDateString()}</small>
    </div>
    <span class="badge">CONFIDENTIAL MEDICAL & LEGAL</span>
  </div>

  <div class="section">
    <h2>1. Primary Medical Profile</h2>
    <div class="grid">
      <div class="item"><strong>Full Name</strong><span>${profile.fullName || "Not Specified"}</span></div>
      <div class="item"><strong>Blood Group</strong><span style="color: #dc2626; font-weight: bold;">${profile.bloodGroup || "Not Specified"}</span></div>
      <div class="item"><strong>Allergies</strong><span>${profile.allergies || "None Reported"}</span></div>
      <div class="item"><strong>Critical Medications</strong><span>${profile.medications || "None"}</span></div>
      <div class="item"><strong>Organ Donor Status</strong><span>${profile.organDonor ? "Yes (Registered Donor)" : "No / Unspecified"}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>2. Emergency Contacts</h2>
    <div class="grid">
      <div class="item"><strong>Next of Kin</strong><span>${profile.emergencyContactName} (${profile.emergencyContactRelation || "Contact"})</span></div>
      <div class="item"><strong>Emergency Phone</strong><span>${profile.emergencyContactPhone || "N/A"}</span></div>
      <div class="item"><strong>Primary Doctor / Hospital</strong><span>${profile.doctorName || "N/A"}</span></div>
      <div class="item"><strong>Doctor Phone</strong><span>${profile.doctorPhone || "N/A"}</span></div>
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
              <td>${c.type.toUpperCase()}</td>
              <td>${c.provider || "N/A"}</td>
              <td><strong>${c.policyNumber || "N/A"}</strong></td>
              <td>${c.endDate}</td>
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
              <td>${doc.title}</td>
              <td>${doc.issuer || "N/A"}</td>
              <td>${doc.expiryDate || "N/A"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `}
  </div>

  <div class="section">
    <h2>5. Legal & Critical Notes</h2>
    <div class="grid">
      <div class="item"><strong>Will / Property Deeds Location</strong><span>${profile.willLocation || "Stored securely"}</span></div>
    </div>
    ${profile.notes ? `<p style="margin-top: 10px; font-size: 13px;">${profile.notes}</p>` : ""}
  </div>

  <div class="no-print" style="margin-top: 24px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>
</body>
</html>
  `;
}
