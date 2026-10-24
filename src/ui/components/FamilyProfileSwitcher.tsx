import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getAllProfiles,
  createDependentProfile,
  getActiveProfileFilter,
  setActiveProfileFilter,
  ACTIVE_PROFILE_CHANGE_EVENT,
  LOCAL_PROFILE_ID,
  type CreateDependentInput,
} from "../../application/profileService";
import type { ProfileRecord, ProfileRole } from "../../infrastructure/database/db";

const AVATAR_OPTIONS = ["��", "��", "��", "��", "����", "����", "����", "��", "��", "��"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

interface FamilyProfileSwitcherProps {
  onProfileSelect?: (profileId: string) => void;
}

export function FamilyProfileSwitcher({ onProfileSelect }: FamilyProfileSwitcherProps) {
  const profiles = useLiveQuery(() => getAllProfiles(), [], []) as ProfileRecord[];
  const [activeId, setActiveId] = useState<string>(() => getActiveProfileFilter());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    function handleProfileChange(e: Event) {
      const customEvent = e as CustomEvent<{ profileId: string }>;
      if (customEvent.detail?.profileId) {
        setActiveId(customEvent.detail.profileId);
      }
    }
    window.addEventListener(ACTIVE_PROFILE_CHANGE_EVENT, handleProfileChange);
    return () => window.removeEventListener(ACTIVE_PROFILE_CHANGE_EVENT, handleProfileChange);
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeId);

  function handleSelect(id: string) {
    setActiveId(id);
    setActiveProfileFilter(id);
    setIsDropdownOpen(false);
    if (onProfileSelect) {
      onProfileSelect(id);
    }
  }

  // Label to show in pill
  let displayLabel = "All Family";
  let displayIcon = "��‍��‍��‍��";
  if (activeId !== "all" && activeProfile) {
    displayLabel = activeProfile.displayName;
    displayIcon = activeProfile.avatarIcon || (activeProfile.role === "dependent_child" ? "��" : "��");
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          borderRadius: "20px",
          background: "rgba(56, 189, 248, 0.08)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          color: "#f8fafc",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "15px" }}>{displayIcon}</span>
        <span>{displayLabel}</span>
        <span style={{ fontSize: "10px", opacity: 0.7 }}>▼</span>
      </button>

      {isDropdownOpen && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2990,
            }}
            onClick={() => setIsDropdownOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "8px",
              minWidth: "220px",
              maxWidth: "calc(100vw - 32px)",
              boxSizing: "border-box",
              background: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "10px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              padding: "6px",
              zIndex: 3000,
            }}
          >
            <div style={{ padding: "6px 10px", fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>
              SWITCH PROFILE
            </div>

            <button
              type="button"
              onClick={() => handleSelect("all")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                border: "none",
                borderRadius: "6px",
                background: activeId === "all" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                color: activeId === "all" ? "#38bdf8" : "#f1f5f9",
                fontSize: "13px",
                fontWeight: activeId === "all" ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>��‍��‍��‍��</span>
              <div style={{ flex: 1 }}>
                <div>All Family Records</div>
                <small style={{ color: "#94a3b8", fontSize: "11px" }}>Combined overview</small>
              </div>
            </button>

            {profiles.map((p) => {
              const isSelected = activeId === p.id;
              const isChild = p.role === "dependent_child";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: "6px",
                    background: isSelected ? "rgba(56, 189, 248, 0.15)" : "transparent",
                    color: isSelected ? "#38bdf8" : "#f1f5f9",
                    fontSize: "13px",
                    fontWeight: isSelected ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>
                    {p.avatarIcon || (isChild ? "��" : "��")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{p.displayName}</span>
                      {p.id === LOCAL_PROFILE_ID ? (
                        <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "1px 5px", borderRadius: "4px" }}>
                          Self
                        </span>
                      ) : isChild ? (
                        <span style={{ fontSize: "10px", background: "rgba(244, 114, 182, 0.2)", color: "#f472b6", padding: "1px 5px", borderRadius: "4px" }}>
                          Child
                        </span>
                      ) : null}
                    </div>
                    {p.bloodGroup && (
                      <small style={{ color: "#94a3b8", fontSize: "11px" }}>Blood: {p.bloodGroup}</small>
                    )}
                  </div>
                </button>
              );
            })}

            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", margin: "6px 0" }} />

            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                setIsModalOpen(true);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                color: "#38bdf8",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>➕</span>
              <span>Add Child / Dependent</span>
            </button>
          </div>
        </>
      )}

      {isModalOpen && (
        <AddDependentModal
          onClose={() => setIsModalOpen(false)}
          onCreated={(newProfile) => {
            setIsModalOpen(false);
            handleSelect(newProfile.id);
          }}
        />
      )}
    </div>
  );
}

interface AddDependentModalProps {
  onClose: () => void;
  onCreated: (profile: ProfileRecord) => void;
}

export function AddDependentModal({ onClose, onCreated }: AddDependentModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<ProfileRole>("dependent_child");
  const [avatarIcon, setAvatarIcon] = useState("��");
  const [birthDate, setBirthDate] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [pediatricianOrDoctor, setPediatricianOrDoctor] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter the name of your child or dependent.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const input: CreateDependentInput = {
        displayName: displayName.trim(),
        role,
        avatarIcon,
        birthDate: birthDate || undefined,
        bloodGroup: bloodGroup || undefined,
        allergies: allergies || undefined,
        pediatricianOrDoctor: pediatricianOrDoctor || undefined,
        emergencyNotes: emergencyNotes || undefined,
      };

      const created = await createDependentProfile(input);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dependent profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        className="card fade-in"
        style={{
          maxWidth: "480px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#111827",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>��</span> Add Child / Dependent Profile
          </h3>
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            style={{ fontSize: "20px", color: "#94a3b8" }}
          >
            ✕
          </button>
        </div>

        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "18px" }}>
          Manage your child�s pediatric records, vaccinations, school documents, and emergency details under your secure vault.
        </p>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px 14px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Avatar & Role */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
              Choose Icon & Relationship
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setAvatarIcon(av)}
                  style={{
                    fontSize: "20px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: avatarIcon === av ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: avatarIcon === av ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  {av}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setRole("dependent_child");
                  setAvatarIcon("��");
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: role === "dependent_child" ? "1px solid #f472b6" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: role === "dependent_child" ? "rgba(244, 114, 182, 0.15)" : "#1e293b",
                  color: role === "dependent_child" ? "#f472b6" : "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                �� Child
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole("dependent_elder");
                  setAvatarIcon("��");
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: role === "dependent_elder" ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: role === "dependent_elder" ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
                  color: role === "dependent_elder" ? "#38bdf8" : "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                �� Parent / Elder
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole("spouse");
                  setAvatarIcon("��");
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: role === "spouse" ? "1px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: role === "spouse" ? "rgba(168, 85, 247, 0.15)" : "#1e293b",
                  color: role === "spouse" ? "#c084fc" : "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                �� Spouse
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="depName" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
              Full Name *
            </label>
            <input
              id="depName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Leo Sharma"
              required
              autoFocus
            />
          </div>

          {/* Date of Birth & Blood Group */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div className="form-field">
              <label htmlFor="depDob" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
                Date of Birth
              </label>
              <input
                id="depDob"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="depBlood" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
                Blood Group
              </label>
              <select
                id="depBlood"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                <option value="">Unknown / None</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Allergies */}
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="depAllergies" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
              Allergies (Critical)
            </label>
            <input
              id="depAllergies"
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Peanut allergy, Penicillin, Asthmatic"
            />
          </div>

          {/* Pediatrician / Doctor */}
          <div className="form-field" style={{ marginBottom: "14px" }}>
            <label htmlFor="depDoctor" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
              Pediatrician / Family Doctor & Contact
            </label>
            <input
              id="depDoctor"
              type="text"
              value={pediatricianOrDoctor}
              onChange={(e) => setPediatricianOrDoctor(e.target.value)}
              placeholder="e.g. Dr. Kapoor (+91 98765 43210)"
            />
          </div>

          {/* Emergency Notes */}
          <div className="form-field" style={{ marginBottom: "20px" }}>
            <label htmlFor="depNotes" style={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
              Emergency Notes / School Info
            </label>
            <textarea
              id="depNotes"
              rows={2}
              value={emergencyNotes}
              onChange={(e) => setEmergencyNotes(e.target.value)}
              placeholder="e.g. DPS Kindergarten, Class 1-A. Carries inhaler."
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!displayName.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Create Profile →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
