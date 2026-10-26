import { db } from "../infrastructure/database/db";
import { LOCAL_PROFILE_ID } from "./profileService";

export type SearchResultType =
  | "document"
  | "product"
  | "finance"
  | "subscription"
  | "vehicle"
  | "property"
  | "insurance"
  | "warranty"
  | "reminder"
  | "secret"
  | "medical";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
}

function matches(q: string, ...values: (string | undefined | null)[]): boolean {
  return values.some((v) => typeof v === "string" && v.toLowerCase().includes(q));
}

/**
 * Searches every section, for the vault owner and family members. Results
 * carry the record id so the app can open that exact item. Secret values are
 * never searched, only their titles.
 */
export async function universalSearch(query: string): Promise<SearchResult[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const [profiles, docs, prods, fins, vehs, props, secrets, coverages, reminders, medicals] = await Promise.all([
    db.profiles.toArray(),
    db.documents.toArray(),
    db.products.toArray(),
    db.finance.toArray(),
    db.vehicles.toArray(),
    db.properties.toArray(),
    db.secrets.toArray(),
    db.coverages.toArray(),
    db.reminders.toArray(),
    db.medicalRecords.toArray(),
  ]);

  const ownerName = new Map(profiles.map((p) => [p.id, p.displayName]));
  /** " • Aarav" for a family member's record, nothing for the vault owner's. */
  const forWhom = (ownerId: string) =>
    ownerId !== LOCAL_PROFILE_ID && ownerName.has(ownerId) ? ` • ${ownerName.get(ownerId)}` : "";

  const results: SearchResult[] = [];

  for (const d of docs) {
    if (matches(q, d.title, d.issuer, d.documentType, ...(d.tags ?? []))) {
      results.push({ id: d.id, type: "document", title: d.title, subtitle: `Document • ${d.category}${forWhom(d.ownerId)}` });
    }
  }

  for (const p of prods) {
    if (matches(q, p.name, p.brand, p.model, p.category)) {
      results.push({ id: p.id, type: "product", title: `${p.brand || ""} ${p.name}`.trim(), subtitle: `Product • ${p.category}` });
    }
  }

  for (const c of coverages) {
    if (matches(q, c.provider, c.policyNumber, c.type, c.policyKind)) {
      const isInsurance = c.type === "insurance";
      results.push({
        id: isInsurance ? c.id : c.productId ?? c.id,
        type: isInsurance ? "insurance" : "warranty",
        title: c.provider || (isInsurance ? "Insurance policy" : "Warranty"),
        subtitle: `${isInsurance ? "Insurance" : "Warranty"} • ${c.policyNumber || "No policy number"} • ends ${c.endDate}`,
      });
    }
  }

  for (const f of fins) {
    if (matches(q, f.institution, f.accountType, f.category)) {
      results.push({ id: f.id, type: "finance", title: f.institution, subtitle: `Account • ${f.accountType || f.category}` });
    }
  }

  for (const profile of profiles) {
    for (const s of profile.subscriptions ?? []) {
      if (matches(q, s.name, s.category, s.paymentMethod)) {
        results.push({ id: s.id, type: "subscription", title: s.name, subtitle: `Subscription • ${s.billingCycle} • next ${s.nextBillingDate}` });
      }
    }
  }

  for (const v of vehs) {
    if (matches(q, v.make, v.model, v.registrationNumber, v.vin)) {
      results.push({ id: v.id, type: "vehicle", title: `${v.year || ""} ${v.make} ${v.model}`.trim(), subtitle: `Vehicle • ${v.registrationNumber || "Unregistered"}` });
    }
  }

  for (const p of props) {
    if (matches(q, p.address, p.type)) {
      results.push({ id: p.id, type: "property", title: p.address, subtitle: `Property • ${p.type}` });
    }
  }

  for (const s of secrets) {
    if (matches(q, s.title, s.category)) {
      results.push({ id: s.id, type: "secret", title: s.title, subtitle: `Secret • ${s.category}` });
    }
  }

  for (const r of reminders) {
    if (matches(q, r.title)) {
      results.push({ id: r.id, type: "reminder", title: r.title, subtitle: `Reminder • due ${r.dueDate}` });
    }
  }

  for (const m of medicals) {
    if (matches(q, m.title, m.department, m.doctorOrClinic, m.diagnosis, m.medicationsOrSummary)) {
      const typeLabel = m.type === "prescription" ? "Prescription" : "Lab Report";
      results.push({ id: m.id, type: "medical", title: m.title, subtitle: `Medical • ${typeLabel} (${m.department}) • ${m.date}${forWhom(m.ownerId)}` });
    }
  }

  return results.slice(0, 100);
}
