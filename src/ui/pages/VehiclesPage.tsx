import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast";
import { getVehicles, updateVehicle, deleteVehicle, type CreateVehicleInput } from "../../application/vehicleService";
import { db, type VehicleRecord } from "../../infrastructure/database/db";
import { AttachmentManager } from "../components/AttachmentManager";

export function VehiclesPage() {
  const vehicles = useLiveQuery(() => getVehicles(), [], []);
  const { showToast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [formData, setFormData] = useState<CreateVehicleInput>({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    registrationNumber: "",
    vin: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!isNewRecord && editingId) {
        await updateVehicle(editingId, formData);
        showToast("Vehicle updated", "success");
      } else if (editingId) {
        const now = new Date().toISOString();
        await db.vehicles.add({
          ...formData,
          id: editingId,
          ownerId: "local-profile",
          createdAt: now,
          updatedAt: now,
        });
        showToast("Vehicle added", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setIsNewRecord(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error saving vehicle", "error");
    }
  }

  function handleEdit(record: VehicleRecord) {
    setFormData({
      make: record.make,
      model: record.model,
      year: record.year || new Date().getFullYear(),
      registrationNumber: record.registrationNumber || "",
      vin: record.vin || "",
      purchaseDate: record.purchaseDate || "",
      purchasePrice: record.purchasePrice || 0,
      notes: record.notes || "",
    });
    setEditingId(record.id);
    setIsNewRecord(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this vehicle?")) return;
    try {
      await deleteVehicle(id);
      showToast("Vehicle deleted", "success");
    } catch {
      showToast("Error deleting vehicle", "error");
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">Manage cars, bikes, and their registration details.</p>
        </div>
        <button className="primary-button" onClick={() => {
          setEditingId(crypto.randomUUID());
          setIsNewRecord(true);
          setFormData({ make: "", model: "", year: new Date().getFullYear(), registrationNumber: "", vin: "" });
          setShowForm(true);
        }}>
          + Add Vehicle
        </button>
      </div>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingId ? "Edit Vehicle" : "Add Vehicle"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Make</label>
                  <input type="text" value={formData.make} onChange={e => setFormData({ ...formData, make: e.target.value })} required placeholder="e.g. Toyota, Honda" />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Model</label>
                  <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} required placeholder="e.g. Camry, Civic" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Year</label>
                  <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} required />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Registration Number</label>
                  <input type="text" value={formData.registrationNumber} onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })} placeholder="e.g. XYZ 1234" />
                </div>
              </div>
              <div className="form-field">
                <label>VIN (Vehicle Identification Number)</label>
                <input type="text" value={formData.vin} onChange={e => setFormData({ ...formData, vin: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Purchase Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Purchase Price</label>
                  <input type="number" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>

              <div style={{ marginTop: "8px", borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
                <AttachmentManager entityId={editingId!} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="submit" className="primary-button">Save Vehicle</button>
                <button type="button" className="secondary-button" onClick={() => {
                  setShowForm(false);
                  setIsNewRecord(false);
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="grid-list">
          {vehicles?.length === 0 ? (
            <div className="empty-state card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚗</div>
              <h3>No vehicles added</h3>
              <p>Add your cars, motorcycles, and RVs here.</p>
            </div>
          ) : (
            vehicles?.map(record => (
              <div key={record.id} className="card fade-in">
                <div className="card-header">
                  <h3>{record.year} {record.make} {record.model}</h3>
                  <span className={`status-badge active`}>VEHICLE</span>
                </div>
                <div className="card-body">
                  <p><strong>Reg:</strong> {record.registrationNumber || "N/A"}</p>
                  <p><strong>VIN:</strong> {record.vin || "N/A"}</p>
                  {record.purchaseDate && <p><strong>Purchased:</strong> {new Date(record.purchaseDate).toLocaleDateString()}</p>}
                  {record.notes && <p style={{ fontSize: "14px", color: "#7a8ba8", marginTop: "12px" }}>{record.notes}</p>}
                  <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                    <button className="secondary-button" onClick={() => handleEdit(record)}>Edit</button>
                    <button className="text-button" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(record.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default VehiclesPage;
