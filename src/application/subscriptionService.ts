import { db } from "../infrastructure/database/db";
import { createReminder } from "./reminderService";

export interface SubscriptionItem {
  id: string;
  name: string;
  category: "entertainment" | "utilities" | "software" | "health" | "finance" | "other";
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly" | "quarterly";
  nextBillingDate: string;
  paymentMethod?: string;
  autoRenew: boolean;
  notes?: string;
}

const SUBSCRIPTIONS_KEY = "mylifedock_subscriptions_list";

export function getSubscriptions(): SubscriptionItem[] {
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [];
}

export async function saveSubscription(sub: Omit<SubscriptionItem, "id">, existingId?: string): Promise<SubscriptionItem> {
  const list = getSubscriptions();
  const id = existingId || crypto.randomUUID();
  const item: SubscriptionItem = { ...sub, id };

  const updatedList = existingId ? list.map(s => s.id === existingId ? item : s) : [...list, item];
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(updatedList));

  // If auto-renew or has a billing date, schedule a reminder 3 days before
  if (item.nextBillingDate) {
    try {
      const billingDate = new Date(item.nextBillingDate);
      const reminderDate = new Date(billingDate);
      reminderDate.setDate(reminderDate.getDate() - 3);

      const reminderDateStr = reminderDate.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      if (reminderDateStr >= todayStr) {
        // Check if reminder already exists
        const existingReminders = await db.reminders.where("ownerId").equals("local-profile").toArray();
        const alreadyHasReminder = existingReminders.some(r => r.relatedEntityId === item.id);

        if (!alreadyHasReminder) {
          await createReminder({
            title: `Upcoming Renewal: ${item.name} (${item.currency || "$"} ${item.amount})`,
            dueDate: reminderDateStr,
            relatedEntityType: "subscription",
            relatedEntityId: item.id,
            enabled: true,
          });
        }
      }
    } catch {
      // ignore reminder scheduling failure
    }
  }

  return item;
}

export function deleteSubscription(id: string): void {
  const list = getSubscriptions();
  const updatedList = list.filter(s => s.id !== id);
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(updatedList));
}
