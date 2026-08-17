import { db, type ProfileRecord } from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

export async function getLocalProfile(): Promise<ProfileRecord | undefined> {
  return db.profiles.get(LOCAL_PROFILE_ID);
}

export async function createLocalProfile(
  displayName: string,
): Promise<ProfileRecord> {
  const now = new Date().toISOString();

  const profile: ProfileRecord = {
    id: LOCAL_PROFILE_ID,
    displayName: displayName.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await db.profiles.put(profile);

  return profile;
}