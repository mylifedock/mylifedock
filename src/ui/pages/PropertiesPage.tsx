import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast";
import { getProperties, updateProperty, deleteProperty, type CreatePropertyInput } from "../../application/propertyService";
import { db, type PropertyRecord } from "../../infrastructure/database/db";
import { AttachmentManager } from "../components/AttachmentManager";

export function PropertiesPage() {
  const properties = useLiveQuery(() => getProperties(), [], []);
  const { showToast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyInput>({
    type: "house",
    address: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!isNewRecord && editingId) {
        await updateProperty(editingId, formData);
        showToast("Property updated", "success");
      } else if (editingId) {
        const now = new Date().toISOString();
        await db.properties.add({
          ...formData,
          id: editingId,
          ownerId: "local-profile",
          createdAt: now,
          updatedAt: now,
        });
        showToast("Property added", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setIsNewRecord(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error saving property", "error");
    }
  }

  function handleEdit(record: PropertyRecord) {
    setFormData({
      type: record.type,
      address: record.address,
      purchaseDate: record.purchaseDate || "",
      purchasePrice: record.purchasePrice || 0,
      notes: record.notes || "",
    });
    setEditingId(record.id);
    setIsNewRecord(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this property?")) return;
    try {
      await deleteProperty(id);
      showToast("Property deleted", "success");
    } catch {
      showToast("Error deleting property", "error");
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">Manage real estate and land assets securely.</p>
        </div>
        <button className="primary-button" onClick={() => {
          setEditingId(crypto.randomUUID());
          setIsNewRecord(true);
          setFormData({ type: "house", address: "" });
          setShowForm(true);
        }}>
          + Add Property
        </button>
      </div>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <h3>{editingId ? "Edit Property" : "Add Property"}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-field">
                <label>Property Type</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as "house" | "land" | "rental" | "commercial" | "other" })} required>
                  <option value="house">House / Apartment</option>
                  <option value="land">Land / Plot</option>
                  <option value="rental">Rental Property</option>
                  <option value="commercial">Commercial Space</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-field">
                <label>Address</label>
                <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} required rows={3} placeholder="Full address" />
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Purchase Price</label>
                  <input type="number" value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })} />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Purchase Date</label>
                  <input type="date" value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} />
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
                <button type="submit" className="primary-button">Save Property</button>
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
          {properties?.length === 0 ? (
            <div className="empty-state card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
              <h3>No properties added</h3>
              <p>Add your real estate and land assets here.</p>
            </div>
          ) : (
            properties?.map(record => (
              <div key={record.id} className="card fade-in">
                <div className="card-header">
                  <h3>{record.type.toUpperCase()}</h3>
                  <span className={`status-badge active`}>PROPERTY</span>
                </div>
                <div className="card-body">
                  <p><strong>Address:</strong> {record.address || "N/A"}</p>
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

export default PropertiesPage;
