import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type CoverageRecord, type InsurancePolicyKind } from "../../infrastructure/database/db";
import { coverageStatus, createCoverage, deleteCoverage, updateCoverage } from "../../application/coverageService";
import { RecordCollection, type FieldDef } from "../components/RecordCollection";
import { getLocalDateString } from "../../utils/dateUtils";

const POLICY_KINDS: { value: InsurancePolicyKind; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "life", label: "Life" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home / Property" },
  { value: "travel", label: "Travel" },
  { value: "device", label: "Device / Gadget" },
  { value: "other", label: "Other" },
];

interface PolicyDraft {
  policyKind: InsurancePolicyKind;
  provider: string;
  policyNumber: string;
  /** "" | "product:<id>" | "vehicle:<id>" | "property:<id>" */
  coveredItem: string;
  startDate: string;
  endDate: string;
  reminderEnabled: boolean;
  reminderDaysBefore?: number;
}

function kindLabel(kind: InsurancePolicyKind | undefined): string {
  return POLICY_KINDS.find((k) => k.value === kind)?.label ?? "Insurance";
}

function linkOf(c: CoverageRecord): string {
  if (c.vehicleId) return `vehicle:${c.vehicleId}`;
  if (c.propertyId) return `property:${c.propertyId}`;
  if (c.productId) return `product:${c.productId}`;
  return "";
}

function linkFields(coveredItem: string): Pick<CoverageRecord, "productId" | "vehicleId" | "propertyId"> {
  const [kind, id] = coveredItem.split(":");
  return {
    productId: kind === "product" ? id : undefined,
    vehicleId: kind === "vehicle" ? id : undefined,
    propertyId: kind === "property" ? id : undefined,
  };
}

/**
 * Every insurance policy in one place: standalone (health, life, travel) and
 * those covering a product, vehicle or property.
 */
export function InsurancePage({ focusId }: { focusId?: string }) {
  const policies = useLiveQuery(
    async () => (await db.coverages.toArray()).filter((c) => c.type === "insurance").sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [],
  );
  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [], []);
  const properties = useLiveQuery(() => db.properties.toArray(), [], []);

  const coveredOptions = useMemo(
    () => [
      { value: "", label: "Nothing specific (health, life, travel…)" },
      ...vehicles.map((v) => ({ value: `vehicle:${v.id}`, label: `Vehicle: ${[v.make, v.model, v.registrationNumber].filter(Boolean).join(" ")}` })),
      ...properties.map((p) => ({ value: `property:${p.id}`, label: `Property: ${p.address}` })),
      ...products.map((p) => ({ value: `product:${p.id}`, label: `Product: ${[p.brand, p.name].filter(Boolean).join(" ")}` })),
    ],
    [products, vehicles, properties],
  );

  const coveredName = useCallback(
    (c: CoverageRecord) => coveredOptions.find((o) => o.value === linkOf(c) && o.value !== "")?.label,
    [coveredOptions],
  );

  const fields: FieldDef<PolicyDraft>[] = [
    { key: "policyKind", label: "Policy type", type: "select", options: POLICY_KINDS, half: true },
    { key: "provider", label: "Insurer", type: "text", required: true, placeholder: "e.g. LIC, Star Health, HDFC ERGO", half: true },
    { key: "policyNumber", label: "Policy number", type: "text", half: true },
    { key: "coveredItem", label: "Covers", type: "select", options: coveredOptions, half: true },
    { key: "startDate", label: "Start date", type: "date", required: true, half: true },
    { key: "endDate", label: "Expiry / renewal date", type: "date", required: true, half: true },
    { key: "reminderEnabled", label: "Remind me before it expires", type: "checkbox", half: true },
    { key: "reminderDaysBefore", label: "Days before expiry", type: "number", inputMode: "numeric", step: "1", half: true },
  ];

  return (
    <div className="page-container fade-in">
      <RecordCollection<CoverageRecord, PolicyDraft>
        noun="Policy"
        header={{ title: "Insurance", subtitle: "Health, life, vehicle and home policies with renewal reminders." }}
        items={policies}
        fields={fields}
        attachments
        focusId={focusId}
        emptyDraft={() => ({
          policyKind: "health",
          provider: "",
          policyNumber: "",
          coveredItem: "",
          startDate: getLocalDateString(),
          endDate: "",
          reminderEnabled: true,
          reminderDaysBefore: 30,
        })}
        toDraft={(c) => ({
          policyKind: c.policyKind ?? "other",
          provider: c.provider ?? "",
          policyNumber: c.policyNumber ?? "",
          coveredItem: linkOf(c),
          startDate: c.startDate,
          endDate: c.endDate,
          reminderEnabled: c.reminderEnabled,
          reminderDaysBefore: c.reminderDaysBefore,
        })}
        create={(d, id) =>
          createCoverage(
            {
              type: "insurance",
              policyKind: d.policyKind,
              provider: d.provider,
              policyNumber: d.policyNumber,
              startDate: d.startDate,
              endDate: d.endDate,
              reminderEnabled: d.reminderEnabled,
              reminderDaysBefore: d.reminderDaysBefore ?? 30,
              ...linkFields(d.coveredItem),
            },
            id,
          )
        }
        update={(id, d) =>
          updateCoverage(id, {
            policyKind: d.policyKind,
            provider: d.provider,
            policyNumber: d.policyNumber,
            startDate: d.startDate,
            endDate: d.endDate,
            reminderEnabled: d.reminderEnabled,
            reminderDaysBefore: d.reminderDaysBefore ?? 30,
            ...linkFields(d.coveredItem),
          })
        }
        remove={deleteCoverage}
        card={(c) => {
          const status = coverageStatus(c);
          return {
            title: c.provider || "Insurance policy",
            badge: status === "expired" ? "EXPIRED" : status === "expiring-soon" ? "RENEW SOON" : kindLabel(c.policyKind).toUpperCase(),
            badgeTone: status === "expired" ? "danger" : status === "expiring-soon" ? "warning" : "active",
            lines: [
              ["Policy #", c.policyNumber],
              ["Covers", coveredName(c)],
              ["Valid", `${c.startDate} → ${c.endDate}`],
            ],
          };
        }}
        empty={{ icon: "🛡️", title: "No policies yet", text: "Add health, life, vehicle or home insurance to get renewal reminders." }}
      />
    </div>
  );
}

export default InsurancePage;
