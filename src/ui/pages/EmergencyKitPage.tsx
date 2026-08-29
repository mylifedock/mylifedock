import { useState } from "react";
import { useToast } from "../components/Toast";
import { getEmergencyProfile, saveEmergencyProfile, generateEmergencySummaryHtml, type EmergencyProfile } from "../../application/emergencyKitService";

export function EmergencyKitPage() {
  const [profile, setProfile] = useState<EmergencyProfile>(() => getEmergencyProfile());
  const hasExistingData = Boolean(profile.fullName || profile.bloodGroup || profile.emergencyContactName);
  const [isEditing, setIsEditing] = useState<boolean>(!hasExistingData);
  const { showToast } = useToast();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveEmergencyProfile(profile);
    setIsEditing(false);
    showToast("Emergency profile saved to secure vault", "success");
  }

  async function handlePrintOrExport() {
    try {
      const html = await generateEmergencySummaryHtml();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        showToast("Please allow popups to view the printable emergency kit", "info");
      }
    } catch {
      showToast("Error generating emergency kit", "error");
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">🆘 Emergency Family Kit</h1>
          <p className="page-subtitle">Lifeboat Protocol: Essential medical & legal summary for your family during critical moments.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {!isEditing && (
            <button 
              type="button"
              className="secondary-button"
              onClick={() => setIsEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>✏️</span> Edit Profile
            </button>
          )}
          <button 
            type="button"
            className="primary-button" 
            onClick={handlePrintOrExport}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>📄</span> Print / Export Binder
          </button>
        </div>
      </div>

      <div className="card fade-in" style={{ marginBottom: "24px", borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.04)" }}>
        <div className="card-header">
          <h3 style={{ color: "#f87171" }}>🛡️ Lifeboat Protocol Active</h3>
        </div>
        <div className="card-body">
          <p style={{ color: "#cbd5e1" }}>
            In medical or legal emergencies, loved ones often struggle to find insurance policy numbers, blood types, or critical document locations.
            Keep this summary updated, and you can export a secure offline document to place in your home safe or give to your family.
          </p>
        </div>
      </div>

      {!isEditing ? (
        /* Clean Summary Dashboard View */
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Medical Summary Card */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>1. Medical Profile</h3>
              {profile.bloodGroup && (
                <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "4px 12px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px" }}>
                  Blood Group: {profile.bloodGroup}
                </span>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>FULL LEGAL NAME</small>
                  <strong style={{ fontSize: "15px" }}>{profile.fullName || "Not Specified"}</strong>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>KNOWN ALLERGIES</small>
                  <span style={{ fontSize: "15px" }}>{profile.allergies || "None Reported"}</span>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>CRITICAL MEDICATIONS</small>
                  <span style={{ fontSize: "15px" }}>{profile.medications || "None"}</span>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>ORGAN DONOR STATUS</small>
                  <span style={{ fontSize: "15px" }}>{profile.organDonor ? "✓ Registered Donor" : "Unspecified"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contacts Summary Card */}
          <div className="card">
            <div className="card-header">
              <h3>2. Emergency Contacts & Primary Doctor</h3>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>NEXT OF KIN</small>
                  <strong style={{ fontSize: "15px" }}>{profile.emergencyContactName || "Not Specified"} {profile.emergencyContactRelation ? `(${profile.emergencyContactRelation})` : ""}</strong>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>EMERGENCY PHONE</small>
                  <a href={`tel:${profile.emergencyContactPhone}`} style={{ color: "#a78bfa", fontSize: "15px", fontWeight: "bold", textDecoration: "none" }}>
                    {profile.emergencyContactPhone || "N/A"}
                  </a>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>PRIMARY DOCTOR / HOSPITAL</small>
                  <span style={{ fontSize: "15px" }}>{profile.doctorName || "Not Specified"}</span>
                </div>
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>DOCTOR PHONE</small>
                  <a href={`tel:${profile.doctorPhone}`} style={{ color: "#a78bfa", fontSize: "15px", textDecoration: "none" }}>
                    {profile.doctorPhone || "N/A"}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Legal / Will Summary Card */}
          <div className="card">
            <div className="card-header">
              <h3>3. Physical Documents & Legal Notes</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: "12px" }}>
                <small style={{ color: "#94a3b8", display: "block" }}>PHYSICAL WILL & PROPERTY DEEDS LOCATION</small>
                <span style={{ fontSize: "15px" }}>{profile.willLocation || "Stored securely"}</span>
              </div>
              {profile.notes && (
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>EMERGENCY INSTRUCTIONS / NOTES</small>
                  <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "14px" }}>{profile.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Edit Form */
        <form onSubmit={handleSave} className="fade-in">
          {/* Medical Section */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="card-header">
              <h3>1. Medical Essentials</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label>Full Legal Name</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "150px" }}>
                  <label>Blood Group</label>
                  <input
                    type="text"
                    value={profile.bloodGroup}
                    onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                    placeholder="e.g. O+, A-, B+"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label>Known Allergies (Penicillin, Peanuts, Latex, etc.)</label>
                  <input
                    type="text"
                    value={profile.allergies}
                    onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                    placeholder="None / Penicillin"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label>Critical Daily Medications</label>
                  <input
                    type="text"
                    value={profile.medications}
                    onChange={(e) => setProfile({ ...profile, medications: e.target.value })}
                    placeholder="Insulin, BP meds..."
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <input
                  type="checkbox"
                  id="organDonor"
                  checked={profile.organDonor}
                  onChange={(e) => setProfile({ ...profile, organDonor: e.target.checked })}
                />
                <label htmlFor="organDonor" style={{ cursor: "pointer", fontSize: "14px", margin: 0 }}>
                  Registered Organ Donor
                </label>
              </div>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div className="card-header">
              <h3>2. Emergency Contacts & Primary Doctor</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label>Next of Kin Contact Name</label>
                  <input
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                    placeholder="Spouse / Parent / Sibling"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "150px" }}>
                  <label>Relationship</label>
                  <input
                    type="text"
                    value={profile.emergencyContactRelation}
                    onChange={(e) => setProfile({ ...profile, emergencyContactRelation: e.target.value })}
                    placeholder="Spouse / Brother"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label>Emergency Phone Number</label>
                  <input
                    type="tel"
                    value={profile.emergencyContactPhone}
                    onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label>Primary Physician / Preferred Hospital</label>
                  <input
                    type="text"
                    value={profile.doctorName}
                    onChange={(e) => setProfile({ ...profile, doctorName: e.target.value })}
                    placeholder="Dr. Smith / City Hospital"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label>Doctor / Clinic Phone</label>
                  <input
                    type="tel"
                    value={profile.doctorPhone}
                    onChange={(e) => setProfile({ ...profile, doctorPhone: e.target.value })}
                    placeholder="Clinic Contact"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Legal Location */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="card-header">
              <h3>3. Physical Document & Will Location</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-field">
                <label>Where are physical copies of Will, Property Deeds, and Lockbox Keys stored?</label>
                <input
                  type="text"
                  value={profile.willLocation}
                  onChange={(e) => setProfile({ ...profile, willLocation: e.target.value })}
                  placeholder="e.g. Master bedroom safe, combination with attorney"
                />
              </div>

              <div className="form-field">
                <label>Additional Emergency Notes / Instructions</label>
                <textarea
                  rows={3}
                  value={profile.notes}
                  onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                  placeholder="Any special instructions for guardians or executors..."
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            {hasExistingData && (
              <button 
                type="button" 
                className="secondary-button" 
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="primary-button" style={{ minWidth: "160px" }}>
              ✓ Save Emergency Profile
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default EmergencyKitPage;
