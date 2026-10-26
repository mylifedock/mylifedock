import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getAllProfiles,
  createDependentProfile,
  LOCAL_PROFILE_ID,
  type CreateDependentInput,
} from "../../application/profileService";
import type { ProfileRecord, ProfileRole } from "../../infrastructure/database/db";
import { AVATAR_OPTIONS, ROLE_ICONS, profileAvatar, roleIcon } from "../profileAvatar";
import { useActiveProfileFilter } from "../useActiveProfileFilter";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const ALL_FAMILY_ICON = "👨‍👩‍👧‍👦";

const ROLE_LABELS = new Map<ProfileRole, string>([
  ["primary", "You"],
  ["dependent_child", "Child"],
  ["dependent_elder", "Parent / elder"],
  ["spouse", "Spouse"],
]);

interface FamilyProfileSwitcherProps {
  onProfileSelect?: (profileId: string) => void;
  /** Hide "All family" where one person must be chosen (Emergency Kit). */
  allowAll?: boolean;
}

export function FamilyProfileSwitcher({ onProfileSelect, allowAll = true }: FamilyProfileSwitcherProps) {
  const profiles = useLiveQuery(() => getAllProfiles(), [], []) as ProfileRecord[];
  const [activeId, setActiveId] = useActiveProfileFilter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const effectiveId = !allowAll && activeId === "all" ? LOCAL_PROFILE_ID : activeId;
  const activeProfile = profiles.find((p) => p.id === effectiveId);

  function handleSelect(id: string) {
    setActiveId(id);
    setIsDropdownOpen(false);
    onProfileSelect?.(id);
  }

  const showingAll = effectiveId === "all" || !activeProfile;
  const displayLabel = showingAll ? (allowAll ? "All Family" : profiles[0]?.displayName ?? "You") : activeProfile.displayName;
  const displayIcon = showingAll ? (allowAll ? ALL_FAMILY_ICON : ROLE_ICONS.primary) : profileAvatar(activeProfile);

  return (
    <div className="family-switcher">
      <button
        type="button"
        className="family-switcher-pill"
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <span aria-hidden="true">{displayIcon}</span>
        <span>{displayLabel}</span>
        <span aria-hidden="true" className="family-switcher-caret">▼</span>
      </button>

      {isDropdownOpen && (
        <>
          <div className="family-switcher-backdrop" onClick={() => setIsDropdownOpen(false)} />
          <div className="family-switcher-menu" role="listbox" aria-label="Family member">
            <div className="family-switcher-heading">SWITCH PROFILE</div>

            {allowAll && (
              <button
                type="button"
                role="option"
                aria-selected={effectiveId === "all"}
                className={`family-switcher-option ${effectiveId === "all" ? "active" : ""}`}
                onClick={() => handleSelect("all")}
              >
                <span aria-hidden="true">{ALL_FAMILY_ICON}</span>
                <span className="family-switcher-option-text">
                  <span>All Family</span>
                  <small>Everyone's records</small>
                </span>
              </button>
            )}

            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={effectiveId === p.id}
                className={`family-switcher-option ${effectiveId === p.id ? "active" : ""}`}
                onClick={() => handleSelect(p.id)}
              >
                <span aria-hidden="true">{profileAvatar(p)}</span>
                <span className="family-switcher-option-text">
                  <span>
                    {p.displayName}{" "}
                    <span className="family-role-tag">{p.id === LOCAL_PROFILE_ID ? "Self" : ROLE_LABELS.get(p.role ?? "dependent_child")}</span>
                  </span>
                  {p.bloodGroup && <small>Blood: {p.bloodGroup}</small>}
                </span>
              </button>
            ))}

            <div className="family-switcher-divider" />

            <button
              type="button"
              className="family-switcher-option family-switcher-add"
              onClick={() => {
                setIsDropdownOpen(false);
                setIsModalOpen(true);
              }}
            >
              <span aria-hidden="true">➕</span>
              <span>Add family member</span>
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
  const [avatarIcon, setAvatarIcon] = useState<string>(ROLE_ICONS.dependent_child);
  const [birthDate, setBirthDate] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [pediatricianOrDoctor, setPediatricianOrDoctor] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseRole(next: Exclude<ProfileRole, "primary">) {
    setRole(next);
    setAvatarIcon(roleIcon(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter a name.");
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
      onCreated(await createDependentProfile(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this family member.");
    } finally {
      setIsSaving(false);
    }
  }

  const roleButtons: { role: Exclude<ProfileRole, "primary">; label: string }[] = [
    { role: "dependent_child", label: `${ROLE_ICONS.dependent_child} Child` },
    { role: "dependent_elder", label: `${ROLE_ICONS.dependent_elder} Parent / Elder` },
    { role: "spouse", label: `${ROLE_ICONS.spouse} Spouse` },
  ];

  return (
    <div className="product-detail-overlay" role="presentation">
      <div className="card modal-card fade-in" role="dialog" aria-modal="true" aria-labelledby="add-family-title">
        <div className="modal-card-header">
          <h3 id="add-family-title">Add family member</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="muted-text">Keep their documents, medical records and emergency details in your vault.</p>

        {error && <div className="vault-error">{error}</div>}

        <form onSubmit={handleSubmit} className="record-form">
          <fieldset className="form-fieldset">
            <legend>Relationship & icon</legend>
            <div className="chip-row">
              {roleButtons.map((b) => (
                <button
                  key={b.role}
                  type="button"
                  className={`chip ${role === b.role ? "active" : ""}`}
                  aria-pressed={role === b.role}
                  onClick={() => chooseRole(b.role)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  type="button"
                  className={`avatar-chip ${avatarIcon === av ? "active" : ""}`}
                  aria-pressed={avatarIcon === av}
                  aria-label={`Icon ${av}`}
                  onClick={() => setAvatarIcon(av)}
                >
                  {av}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="depName">Full name *</label>
              <input id="depName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Aarav Sharma" required autoFocus />
            </div>
            <div className="form-field form-field-half">
              <label htmlFor="depDob">Date of birth</label>
              <input id="depDob" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="form-field form-field-half">
              <label htmlFor="depBlood">Blood group</label>
              <select id="depBlood" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field-full">
              <label htmlFor="depAllergies">Allergies</label>
              <input id="depAllergies" type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Peanuts, Penicillin" />
            </div>
            <div className="form-field form-field-full">
              <label htmlFor="depDoctor">Doctor / paediatrician & phone</label>
              <input id="depDoctor" type="text" value={pediatricianOrDoctor} onChange={(e) => setPediatricianOrDoctor(e.target.value)} placeholder="e.g. Dr. Kapoor (+91 98765 43210)" />
            </div>
            <div className="form-field form-field-full">
              <label htmlFor="depNotes">Emergency notes / school</label>
              <textarea id="depNotes" rows={2} value={emergencyNotes} onChange={(e) => setEmergencyNotes(e.target.value)} placeholder="e.g. DPS, Class 1-A. Carries an inhaler." />
            </div>
          </div>

          <div className="form-actions form-actions-end">
            <button type="button" className="secondary-button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={!displayName.trim() || isSaving}>
              {isSaving ? "Saving..." : "Add family member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
