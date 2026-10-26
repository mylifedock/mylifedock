import { useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import {
  EMPTY_EMERGENCY_PROFILE,
  getEmergencyProfile,
  saveEmergencyProfile,
  generateEmergencySummaryHtml,
  type EmergencyProfile,
} from "../../application/emergencyKitService";
import { saveFile } from "../../platform/fileExport";
import { FamilyProfileSwitcher } from "../components/FamilyProfileSwitcher";
import { useActiveProfileFilter } from "../useActiveProfileFilter";
import { PageHeader } from "../components/PageHeader";
import { LOCAL_PROFILE_ID } from "../../application/profileService";

function hasKitData(profile: EmergencyProfile): boolean {
  return Boolean(profile.fullName || profile.bloodGroup || profile.emergencyContactName);
}

export function EmergencyKitPage() {
  const [profile, setProfile] = useState<EmergencyProfile>(EMPTY_EMERGENCY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  // One kit per family member; "All family" is not meaningful here.
  const [activeFilter] = useActiveProfileFilter();
  const profileId = activeFilter === "all" ? LOCAL_PROFILE_ID : activeFilter;

  useEffect(() => {
    let active = true;
    void getEmergencyProfile(profileId)
      .then((stored) => {
        if (!active) return;
        setProfile(stored);
        setHasExistingData(hasKitData(stored));
        setIsEditing(!hasKitData(stored));
      })
      .catch(() => {
        if (active) showToast("Could not load the emergency profile.", "error");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [showToast, profileId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveEmergencyProfile(profile, profileId);
      setHasExistingData(hasKitData(profile));
      setIsEditing(false);
      showToast("Emergency profile saved to secure vault", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save the emergency profile.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePrintOrExport() {
    if (!window.confirm("The exported kit is a readable (unencrypted) file so your family can open and print it. Keep it somewhere safe. Continue?")) {
      return;
    }
    try {
      const html = await generateEmergencySummaryHtml(profileId);
      const saved = await saveFile(new Blob([html], { type: "text/html" }), "MyLifeDock_Emergency_Kit.html", {
        title: "Save or Share Emergency Kit",
        filterName: "Web page (*.html)",
      });
      if (saved) showToast("Emergency kit exported. Open it in a browser to print or save as PDF.", "success");
    } catch {
      showToast("Error generating emergency kit", "error");
    }
  }

  if (!loaded) {
    return <div className="fade-in" aria-busy="true" />;
  }

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Emergency Kit"
        subtitle="Blood group, allergies, medicines and who to call, ready for family or doctors."
        actions={
          <div className="header-action-row">
            {!isEditing && (
              <button type="button" className="secondary-button" onClick={() => setIsEditing(true)}>
                ✏️ Edit
              </button>
            )}
            <button type="button" className="primary-button" onClick={handlePrintOrExport}>
              📄 Export to print
            </button>
          </div>
        }
      />

      <div className="section-toolbar section-toolbar-start">
        <FamilyProfileSwitcher allowAll={false} />
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
                  <label htmlFor="emergencyKit-fullLegalName">Full Legal Name</label>
                  <input id="emergencyKit-fullLegalName"
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "150px" }}>
                  <label htmlFor="emergencyKit-bloodGroup">Blood Group</label>
                  <input id="emergencyKit-bloodGroup"
                    type="text"
                    value={profile.bloodGroup}
                    onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                    placeholder="e.g. O+, A-, B+"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label htmlFor="emergencyKit-knownAllergies">Known Allergies (Penicillin, Peanuts, Latex, etc.)</label>
                  <input id="emergencyKit-knownAllergies"
                    type="text"
                    value={profile.allergies}
                    onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                    placeholder="None / Penicillin"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label htmlFor="emergencyKit-criticalDailyMedications">Critical Daily Medications</label>
                  <input id="emergencyKit-criticalDailyMedications"
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
                  <label htmlFor="emergencyKit-nextOfKinContactName">Next of Kin Contact Name</label>
                  <input id="emergencyKit-nextOfKinContactName"
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                    placeholder="Spouse / Parent / Sibling"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "150px" }}>
                  <label htmlFor="emergencyKit-relationship">Relationship</label>
                  <input id="emergencyKit-relationship"
                    type="text"
                    value={profile.emergencyContactRelation}
                    onChange={(e) => setProfile({ ...profile, emergencyContactRelation: e.target.value })}
                    placeholder="Spouse / Brother"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label htmlFor="emergencyKit-emergencyPhoneNumber">Emergency Phone Number</label>
                  <input id="emergencyKit-emergencyPhoneNumber"
                    type="tel"
                    value={profile.emergencyContactPhone}
                    onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
                  <label htmlFor="emergencyKit-primaryPhysicianPreferredHospital">Primary Physician / Preferred Hospital</label>
                  <input id="emergencyKit-primaryPhysicianPreferredHospital"
                    type="text"
                    value={profile.doctorName}
                    onChange={(e) => setProfile({ ...profile, doctorName: e.target.value })}
                    placeholder="Dr. Smith / City Hospital"
                  />
                </div>

                <div className="form-field" style={{ flex: 1, minWidth: "180px" }}>
                  <label htmlFor="emergencyKit-doctorClinicPhone">Doctor / Clinic Phone</label>
                  <input id="emergencyKit-doctorClinicPhone"
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
                <label htmlFor="emergencyKit-whereArePhysicalCopiesOfWillPropertyDeedsAndLockboxKeysStored">Where are physical copies of Will, Property Deeds, and Lockbox Keys stored?</label>
                <input id="emergencyKit-whereArePhysicalCopiesOfWillPropertyDeedsAndLockboxKeysStored"
                  type="text"
                  value={profile.willLocation}
                  onChange={(e) => setProfile({ ...profile, willLocation: e.target.value })}
                  placeholder="e.g. Master bedroom safe, combination with attorney"
                />
              </div>

              <div className="form-field">
                <label htmlFor="emergencyKit-additionalEmergencyNotesInstructions">Additional Emergency Notes / Instructions</label>
                <textarea id="emergencyKit-additionalEmergencyNotesInstructions"
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
            <button type="submit" className="primary-button" style={{ minWidth: "160px" }} disabled={isSaving}>
              {isSaving ? "Saving..." : "✓ Save Emergency Profile"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default EmergencyKitPage;
