import { db } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export interface SearchResult {
  id: string;
  type: "document" | "product" | "finance" | "vehicle" | "property" | "coverage" | "reminder" | "secret" | "medical";
  title: string;
  subtitle: string;
}

export async function universalSearch(query: string): Promise<SearchResult[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Documents
  const docs = await db.documents.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  docs.forEach(d => {
    if (d.title.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q))) {
      results.push({ id: d.id, type: "document", title: d.title, subtitle: `Document • ${d.category}` });
    }
  });

  // Products
  const prods = await db.products.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  prods.forEach(p => {
    if (p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)) {
      results.push({ id: p.id, type: "product", title: `${p.brand || ""} ${p.name}`.trim(), subtitle: `Product • ${p.category}` });
    }
  });

  // Finance
  const fins = await db.finance.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  fins.forEach(f => {
    if (f.institution.toLowerCase().includes(q) || f.accountType?.toLowerCase().includes(q)) {
      results.push({ id: f.id, type: "finance", title: f.institution, subtitle: `Finance • ${f.accountType || f.category}` });
    }
  });

  // Vehicles
  const vehs = await db.vehicles.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  vehs.forEach(v => {
    if (v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.registrationNumber?.toLowerCase().includes(q)) {
      results.push({ id: v.id, type: "vehicle", title: `${v.year || ""} ${v.make} ${v.model}`.trim(), subtitle: `Vehicle • ${v.registrationNumber || "Unregistered"}` });
    }
  });

  // Properties
  const props = await db.properties.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  props.forEach(p => {
    if (p.address.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)) {
      results.push({ id: p.id, type: "property", title: p.type.toUpperCase(), subtitle: p.address });
    }
  });

  // Secrets
  const secrets = await db.secrets.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  secrets.forEach(s => {
    if (s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) {
      results.push({ id: s.id, type: "secret", title: s.title, subtitle: `Secret • ${s.category.toUpperCase()}` });
    }
  });

  // Coverages / Insurance & Warranties
  const coverages = await db.coverages.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  coverages.forEach(c => {
    if ((c.provider && c.provider.toLowerCase().includes(q)) || (c.policyNumber && c.policyNumber.toLowerCase().includes(q)) || c.type.toLowerCase().includes(q)) {
      results.push({ id: c.id, type: "coverage", title: c.provider || c.type.toUpperCase(), subtitle: `Coverage • ${c.type} (${c.policyNumber || "No Policy #"})` });
    }
  });

  // Reminders
  const reminders = await db.reminders.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  reminders.forEach(r => {
    if (r.title.toLowerCase().includes(q)) {
      results.push({ id: r.id, type: "reminder", title: r.title, subtitle: `Reminder • Due: ${r.dueDate}` });
    }
  });

  // Medical Records (Prescriptions & Lab Reports)
  const medicals = await db.medicalRecords.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  medicals.forEach(m => {
    if (
      m.title.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      (m.doctorOrClinic && m.doctorOrClinic.toLowerCase().includes(q)) ||
      (m.diagnosis && m.diagnosis.toLowerCase().includes(q)) ||
      (m.medicationsOrSummary && m.medicationsOrSummary.toLowerCase().includes(q))
    ) {
      const typeLabel = m.type === "prescription" ? "Prescription" : "Lab Report";
      results.push({
        id: m.id,
        type: "medical",
        title: m.title,
        subtitle: `Medical • ${typeLabel} (${m.department}) • ${m.date}`
      });
    }
  });

  return results.slice(0, 100);
}
