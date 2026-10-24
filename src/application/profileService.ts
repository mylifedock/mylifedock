import { db, type ProfileRecord, type ProfileRole } from "../infrastructure/database/db";

export const LOCAL_PROFILE_ID = "local-profile";
export const ACTIVE_PROFILE_STORAGE_KEY = "mld_active_profile_filter";
export const ACTIVE_PROFILE_CHANGE_EVENT = "mld_active_profile_change";

export async function getLocalProfile(): Promise<ProfileRecord | undefined> {
  return db.profiles.get(LOCAL_PROFILE_ID);
}

export async function createLocalProfile(
  displayName: string,
): Promise<ProfileRecord> {
  const now = new Date().toISOString();
  const existing = await db.profiles.get(LOCAL_PROFILE_ID);

  const profile: ProfileRecord = {
    id: LOCAL_PROFILE_ID,
    displayName: displayName.trim(),
    role: "primary",
    avatarIcon: "👤",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.profiles.put(profile);

  return profile;
}

/**
 * Returns all profiles (Primary/Self + all Dependent Kids/Family).
 */
export async function getAllProfiles(): Promise<ProfileRecord[]> {
  const all = await db.profiles.toArray();
  // Ensure primary profile is always first
  return all.sort((a, b) => {
    if (a.id === LOCAL_PROFILE_ID) return -1;
    if (b.id === LOCAL_PROFILE_ID) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface CreateDependentInput {
  displayName: string;
  role: ProfileRole;
  avatarIcon?: string;
  birthDate?: string;
  bloodGroup?: string;
  allergies?: string;
  pediatricianOrDoctor?: string;
  emergencyNotes?: string;
}

/**
 * Creates a new dependent profile (child, elder, or spouse).
 */
export async function createDependentProfile(
  input: CreateDependentInput,
): Promise<ProfileRecord> {
  const now = new Date().toISOString();
  const id = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const profile: ProfileRecord = {
    id,
    displayName: input.displayName.trim(),
    role: input.role,
    avatarIcon: input.avatarIcon || (input.role === "dependent_child" ? "👶" : "👤"),
    birthDate: input.birthDate?.trim() || undefined,
    bloodGroup: input.bloodGroup?.trim() || undefined,
    allergies: input.allergies?.trim() || undefined,
    pediatricianOrDoctor: input.pediatricianOrDoctor?.trim() || undefined,
    emergencyNotes: input.emergencyNotes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await db.profiles.put(profile);
  return profile;
}

/**
 * Updates an existing profile's metadata.
 */
export async function updateProfile(
  id: string,
  updates: Partial<Omit<ProfileRecord, "id" | "createdAt">>,
): Promise<void> {
  const existing = await db.profiles.get(id);
  if (!existing) throw new Error("Profile not found");

  await db.profiles.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Deletes a dependent profile and safely migrates all associated records
 * to the primary profile so no data is ever lost.
 */
export async function deleteDependentProfile(id: string): Promise<void> {
  if (id === LOCAL_PROFILE_ID) {
    throw new Error("Cannot delete primary vault profile");
  }

  // Safely re-assign any medical records to primary profile
  const medicals = await db.medicalRecords.where("ownerId").equals(id).toArray();
  for (const m of medicals) {
    await db.medicalRecords.update(m.id, { ownerId: LOCAL_PROFILE_ID });
  }

  // Safely re-assign any documents to primary profile
  const docs = await db.documents.where("ownerId").equals(id).toArray();
  for (const d of docs) {
    await db.documents.update(d.id, { ownerId: LOCAL_PROFILE_ID });
  }

  await db.profiles.delete(id);

  // If active filter was set to this profile, reset to "all"
  if (getActiveProfileFilter() === id) {
    setActiveProfileFilter("all");
  }
}

/**
 * Gets the current active profile filter ("all", "local-profile", or dependent ID).
 */
export function getActiveProfileFilter(): string {
  try {
    return sessionStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || "all";
  } catch {
    return "all";
  }
}

/**
 * Sets the current active profile filter and dispatches an event.
 */
export function setActiveProfileFilter(profileId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
    window.dispatchEvent(new CustomEvent(ACTIVE_PROFILE_CHANGE_EVENT, { detail: { profileId } }));
  } catch {
    // sessionStorage fallback
  }
}
