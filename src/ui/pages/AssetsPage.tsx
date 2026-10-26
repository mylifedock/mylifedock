import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type CoverageRecord, type PropertyRecord, type VehicleRecord } from "../../infrastructure/database/db";
import { createVehicle, deleteVehicle, getVehicles, updateVehicle } from "../../application/vehicleService";
import { createProperty, deleteProperty, getProperties, updateProperty } from "../../application/propertyService";
import { formatCurrency } from "../../application/currencyService";
import { RecordCollection, type FieldDef } from "../components/RecordCollection";
import { PageHeader, SectionTabs } from "../components/PageHeader";

type AssetTab = "vehicles" | "properties";

interface VehicleDraft {
  make: string;
  model: string;
  year?: number;
  registrationNumber: string;
  vin: string;
  purchaseDate: string;
  purchasePrice?: number;
  notes: string;
}

interface PropertyDraft {
  type: PropertyRecord["type"];
  address: string;
  purchaseDate: string;
  purchasePrice?: number;
  notes: string;
}

const PROPERTY_TYPES: { value: PropertyRecord["type"]; label: string }[] = [
  { value: "house", label: "House / Apartment" },
  { value: "land", label: "Land / Plot" },
  { value: "rental", label: "Rental property" },
  { value: "commercial", label: "Commercial space" },
  { value: "other", label: "Other" },
];

const VEHICLE_FIELDS: FieldDef<VehicleDraft>[] = [
  { key: "make", label: "Make", type: "text", required: true, placeholder: "e.g. Maruti Suzuki, Honda", half: true },
  { key: "model", label: "Model", type: "text", required: true, placeholder: "e.g. Swift, Activa", half: true },
  { key: "year", label: "Year", type: "number", inputMode: "numeric", step: "1", half: true },
  { key: "registrationNumber", label: "Registration number", type: "text", placeholder: "e.g. KA 01 AB 1234", half: true },
  { key: "vin", label: "Chassis / VIN", type: "text", half: true },
  { key: "purchaseDate", label: "Purchase date", type: "date", half: true },
  { key: "purchasePrice", label: "Purchase price", type: "number", step: "0.01", half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const PROPERTY_FIELDS: FieldDef<PropertyDraft>[] = [
  { key: "type", label: "Property type", type: "select", options: PROPERTY_TYPES, half: true },
  { key: "purchaseDate", label: "Purchase date", type: "date", half: true },
  { key: "address", label: "Address", type: "textarea", required: true, placeholder: "Full address" },
  { key: "purchasePrice", label: "Purchase price", type: "number", step: "0.01", half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const text = (v: string) => v.trim() || undefined;

/** "Star Health until 2027-03-31" for the policy covering this vehicle or property, if any. */
function useInsuranceLabels(key: "vehicleId" | "propertyId") {
  const linkedId = (c: CoverageRecord) => (key === "vehicleId" ? c.vehicleId : c.propertyId);
  const policies = useLiveQuery(async () => (await db.coverages.toArray()).filter((c) => c.type === "insurance" && linkedId(c)), [key], []);
  return (id: string) => {
    const policy = policies.filter((c) => linkedId(c) === id).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    return policy ? `${policy.provider || "Policy"} until ${policy.endDate}` : undefined;
  };
}

function VehiclesSection({ focusId }: { focusId?: string }) {
  const vehicles = useLiveQuery(() => getVehicles());
  const insuranceFor = useInsuranceLabels("vehicleId");

  return (
    <RecordCollection<VehicleRecord, VehicleDraft>
      noun="Vehicle"
      items={vehicles}
      fields={VEHICLE_FIELDS}
      attachments
      focusId={focusId}
      emptyDraft={() => ({ make: "", model: "", year: new Date().getFullYear(), registrationNumber: "", vin: "", purchaseDate: "", notes: "" })}
      toDraft={(r) => ({
        make: r.make,
        model: r.model,
        year: r.year,
        registrationNumber: r.registrationNumber ?? "",
        vin: r.vin ?? "",
        purchaseDate: r.purchaseDate ?? "",
        purchasePrice: r.purchasePrice,
        notes: r.notes ?? "",
      })}
      create={(d, id) => createVehicle(vehicleRecord(d), id)}
      update={(id, d) => updateVehicle(id, vehicleRecord(d))}
      remove={deleteVehicle}
      card={(r) => ({
        title: [r.year, r.make, r.model].filter(Boolean).join(" "),
        badge: "VEHICLE",
        lines: [
          ["Registration", r.registrationNumber],
          ["Chassis / VIN", r.vin],
          ["Purchased", r.purchaseDate],
          ["Price", r.purchasePrice === undefined ? undefined : formatCurrency(r.purchasePrice)],
          ["Insurance", insuranceFor(r.id)],
        ],
        notes: r.notes,
      })}
      empty={{ icon: "🚗", title: "No vehicles yet", text: "Add cars and bikes, then link their insurance under Insurance." }}
    />
  );
}

function vehicleRecord(d: VehicleDraft) {
  return {
    make: d.make.trim(),
    model: d.model.trim(),
    year: d.year,
    registrationNumber: text(d.registrationNumber),
    vin: text(d.vin),
    purchaseDate: text(d.purchaseDate),
    purchasePrice: d.purchasePrice,
    notes: text(d.notes),
  };
}

function PropertiesSection({ focusId }: { focusId?: string }) {
  const properties = useLiveQuery(() => getProperties());
  const insuranceFor = useInsuranceLabels("propertyId");

  return (
    <RecordCollection<PropertyRecord, PropertyDraft>
      noun="Property"
      items={properties}
      fields={PROPERTY_FIELDS}
      attachments
      focusId={focusId}
      emptyDraft={() => ({ type: "house", address: "", purchaseDate: "", notes: "" })}
      toDraft={(r) => ({
        type: r.type,
        address: r.address,
        purchaseDate: r.purchaseDate ?? "",
        purchasePrice: r.purchasePrice,
        notes: r.notes ?? "",
      })}
      create={(d, id) => createProperty(propertyRecord(d), id)}
      update={(id, d) => updateProperty(id, propertyRecord(d))}
      remove={deleteProperty}
      card={(r) => ({
        title: r.address,
        badge: PROPERTY_TYPES.find((t) => t.value === r.type)?.label.toUpperCase(),
        lines: [
          ["Purchased", r.purchaseDate],
          ["Price", r.purchasePrice === undefined ? undefined : formatCurrency(r.purchasePrice)],
          ["Insurance", insuranceFor(r.id)],
        ],
        notes: r.notes,
      })}
      empty={{ icon: "🏠", title: "No properties yet", text: "Add homes, land and rentals with their deeds and papers attached." }}
    />
  );
}

function propertyRecord(d: PropertyDraft) {
  return {
    type: d.type,
    address: d.address.trim(),
    purchaseDate: text(d.purchaseDate),
    purchasePrice: d.purchasePrice,
    notes: text(d.notes),
  };
}

export function AssetsPage({ initialTab, focusId }: { initialTab?: string; focusId?: string }) {
  const [tab, setTab] = useState<AssetTab>(initialTab === "properties" ? "properties" : "vehicles");

  return (
    <div className="page-container fade-in">
      <PageHeader title="Vehicles & Property" subtitle="Vehicles, homes and land with their papers and linked insurance." />
      <SectionTabs<AssetTab>
        label="Asset sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "vehicles", label: "Vehicles" },
          { id: "properties", label: "Properties" },
        ]}
      />
      {tab === "vehicles" ? <VehiclesSection focusId={focusId} /> : <PropertiesSection focusId={focusId} />}
    </div>
  );
}

export default AssetsPage;
