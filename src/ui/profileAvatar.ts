import type { ProfileRecord } from "../infrastructure/database/db";

export const ROLE_ICONS = {
  primary: "🧑",
  dependent_child: "👶",
  dependent_elder: "👴",
  spouse: "💑",
} as const;

/** Default icon for a relationship. */
export function roleIcon(role: ProfileRecord["role"]): string {
  switch (role) {
    case "dependent_child":
      return ROLE_ICONS.dependent_child;
    case "dependent_elder":
      return ROLE_ICONS.dependent_elder;
    case "spouse":
      return ROLE_ICONS.spouse;
    default:
      return ROLE_ICONS.primary;
  }
}

export const AVATAR_OPTIONS = ["👶", "👧", "👦", "🧒", "👩", "👨", "👵", "👴", "💑", "🧑"];

/**
 * Avatar for a profile. Builds before 1.4 saved some avatars as broken
 * characters (U+FFFD); those fall back to the icon for the person's role.
 */
export function profileAvatar(profile: Pick<ProfileRecord, "avatarIcon" | "role">): string {
  const icon = profile.avatarIcon?.trim();
  if (icon && !icon.includes("\uFFFD")) return icon;
  return roleIcon(profile.role);
}
