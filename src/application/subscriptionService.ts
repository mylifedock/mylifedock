import { db, type SubscriptionData } from "../infrastructure/database/db";
import { createReminder, deleteReminder, updateReminder } from "./reminderService";
import { LOCAL_PROFILE_ID } from "./profileService";
import { getPreferredCurrency } from "./currencyService";
import { assertCanAddItem } from "./vaultLimitService";

export type SubscriptionItem = SubscriptionData;

/** Builds before 1.4 kept subscriptions in plaintext localStorage; they move into the encrypted profile. */
const LEGACY_STORAGE_KEY = "mylifedock_subscriptions_list";

const CATEGORIES = new Set<SubscriptionItem["category"]>(["entertainment", "utilities", "software", "health", "finance", "other"]);
const CYCLES = new Set<SubscriptionItem["billingCycle"]>(["monthly", "yearly", "quarterly"]);

function normalize(value: unknown): SubscriptionItem | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return null;
  const amount = Number(v.amount);
  return {
    id: v.id,
    name: v.name,
    category: CATEGORIES.has(v.category as SubscriptionItem["category"]) ? (v.category as SubscriptionItem["category"]) : "other",
    amount: Number.isFinite(amount) ? amount : 0,
    currency: typeof v.currency === "string" ? v.currency : "INR",
    billingCycle: CYCLES.has(v.billingCycle as SubscriptionItem["billingCycle"]) ? (v.billingCycle as SubscriptionItem["billingCycle"]) : "monthly",
    nextBillingDate: typeof v.nextBillingDate === "string" ? v.nextBillingDate : "",
    paymentMethod: typeof v.paymentMethod === "string" ? v.paymentMethod : undefined,
    autoRenew: v.autoRenew !== false,
    notes: typeof v.notes === "string" ? v.notes : undefined,
  };
}

async function writeSubscriptions(list: SubscriptionItem[]): Promise<void> {
  const updated = await db.profiles.update(LOCAL_PROFILE_ID, {
    subscriptions: list,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) throw new Error("Your profile could not be found. Restart the app and try again.");
}

export async function getSubscriptions(): Promise<SubscriptionItem[]> {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }

  if (legacy !== null) {
    const profile = await db.profiles.get(LOCAL_PROFILE_ID);
    if (profile && !profile.subscriptions) {
      try {
        const parsed: unknown = JSON.parse(legacy);
        // Older builds had no currency field in the form: every item was saved as "USD"
        // but shown in the user's preferred currency, which is what the user entered.
        const shownCurrency = getPreferredCurrency();
        const items = Array.isArray(parsed)
          ? parsed
              .map(normalize)
              .filter((s): s is SubscriptionItem => s !== null)
              .map((s) => ({ ...s, currency: shownCurrency }))
          : [];
        await writeSubscriptions(items);
      } catch {
        // Unreadable legacy data is dropped below rather than kept in plaintext.
      }
    }
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
  }

  const profile = await db.profiles.get(LOCAL_PROFILE_ID);
  return (profile?.subscriptions ?? []).map(normalize).filter((s): s is SubscriptionItem => s !== null);
}

/** The renewal reminder fires three days before the billing date. */
function reminderDateFor(item: SubscriptionItem): string | null {
  if (!item.nextBillingDate) return null;
  const billingDate = new Date(`${item.nextBillingDate}T00:00:00`);
  if (Number.isNaN(billingDate.getTime())) return null;
  billingDate.setDate(billingDate.getDate() - 3);
  const reminderDate = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, "0")}-${String(billingDate.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return reminderDate >= todayStr ? reminderDate : null;
}

async function remindersFor(subscriptionId: string) {
  const reminders = await db.reminders.where("ownerId").equals(LOCAL_PROFILE_ID).toArray();
  return reminders.filter((r) => r.relatedEntityType === "subscription" && r.relatedEntityId === subscriptionId);
}

async function syncRenewalReminder(item: SubscriptionItem): Promise<void> {
  const dueDate = reminderDateFor(item);
  const existing = await remindersFor(item.id);
  const title = `Upcoming Renewal: ${item.name} (${item.currency || "INR"} ${item.amount})`;

  if (!dueDate) {
    for (const reminder of existing) await deleteReminder(reminder.id);
    return;
  }
  if (existing.length === 0) {
    await createReminder({ title, dueDate, relatedEntityType: "subscription", relatedEntityId: item.id, enabled: true });
    return;
  }
  const [first, ...duplicates] = existing;
  await updateReminder(first.id, { title, dueDate });
  for (const reminder of duplicates) await deleteReminder(reminder.id);
}

export async function saveSubscription(sub: Omit<SubscriptionItem, "id">, existingId?: string): Promise<SubscriptionItem> {
  if (!existingId) await assertCanAddItem();
  const list = await getSubscriptions();
  const item = normalize({ ...sub, id: existingId || crypto.randomUUID() });
  if (!item) throw new Error("Invalid subscription.");

  const updatedList = existingId ? list.map((s) => (s.id === existingId ? item : s)) : [...list, item];
  await writeSubscriptions(updatedList);

  try {
    await syncRenewalReminder(item);
  } catch {
    // The subscription is saved even if its reminder could not be scheduled.
  }
  return item;
}

export async function deleteSubscription(id: string): Promise<void> {
  const list = await getSubscriptions();
  await writeSubscriptions(list.filter((s) => s.id !== id));
  for (const reminder of await remindersFor(id)) {
    await deleteReminder(reminder.id);
  }
}
