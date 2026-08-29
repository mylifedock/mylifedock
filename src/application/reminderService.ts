import { scheduleReminderNotification, cancelReminderNotification } from './notificationService';
import {
  db,
  type ReminderRecord,
} from "../infrastructure/database/db";

const LOCAL_PROFILE_ID = "local-profile";

export type CreateReminderInput = Omit<
  ReminderRecord,
  "id" | "ownerId" | "createdAt" | "updatedAt"
>;

export type UpdateReminderInput =
  Partial<CreateReminderInput>;

function validateReminderInput(
  input: CreateReminderInput,
): void {
  if (!input.title.trim()) {
    throw new Error(
      "Reminder title is required.",
    );
  }

  if (!input.dueDate.trim()) {
    throw new Error(
      "Due date is required.",
    );
  }
}

export async function createReminder(
  input: CreateReminderInput,
): Promise<ReminderRecord> {
  validateReminderInput(input);

  const now = new Date().toISOString();

  const reminder: ReminderRecord = {
    ...input,

    title: input.title.trim(),

    id: crypto.randomUUID(),
    ownerId: LOCAL_PROFILE_ID,

    createdAt: now,
    updatedAt: now,
  };

  await db.reminders.add(reminder);

  if (reminder.enabled) {
    await scheduleReminderNotification(reminder);
  }

  return reminder;
}

export async function getReminder(
  id: string,
): Promise<ReminderRecord | undefined> {
  return db.reminders.get(id);
}

/**
 * Returns all reminders, sorted by due date
 * (soonest first).
 */
export async function getReminders(): Promise<
  ReminderRecord[]
> {
  const reminders = await db.reminders
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  return reminders.sort(
    (a, b) =>
      a.dueDate.localeCompare(
        b.dueDate,
      ),
  );
}

/**
 * Returns upcoming enabled reminders
 * within the given number of days.
 */
export async function getUpcomingReminders(
  withinDays: number,
): Promise<ReminderRecord[]> {
  const today = new Date();

  const futureDate = new Date(today);

  futureDate.setDate(
    futureDate.getDate() + withinDays,
  );

  const todayStr = today
    .toISOString()
    .slice(0, 10);

  const futureStr = futureDate
    .toISOString()
    .slice(0, 10);

  const reminders = await db.reminders
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  return reminders
    .filter(
      (r) =>
        r.enabled &&
        r.dueDate >= todayStr &&
        r.dueDate <= futureStr,
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(
          b.dueDate,
        ),
    );
}

/**
 * Returns overdue enabled reminders
 * (due date is before today).
 */
export async function getOverdueReminders(): Promise<
  ReminderRecord[]
> {
  const todayStr = new Date()
    .toISOString()
    .slice(0, 10);

  const reminders = await db.reminders
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  return reminders
    .filter(
      (r) =>
        r.enabled &&
        r.dueDate < todayStr,
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(
          b.dueDate,
        ),
    );
}

export async function updateReminder(
  id: string,
  input: UpdateReminderInput,
): Promise<ReminderRecord> {
  const existing =
    await db.reminders.get(id);

  if (!existing) {
    throw new Error(
      "Reminder not found.",
    );
  }

  if (
    existing.ownerId !== LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot update this reminder.",
    );
  }

  const updated: ReminderRecord = {
    ...existing,

    title:
      input.title?.trim() ??
      existing.title,

    dueDate:
      input.dueDate ??
      existing.dueDate,

    relatedEntityType:
      input.relatedEntityType ??
      existing.relatedEntityType,

    relatedEntityId:
      input.relatedEntityId ??
      existing.relatedEntityId,

    enabled:
      input.enabled ??
      existing.enabled,

    updatedAt:
      new Date().toISOString(),
  };

  validateReminderInput(updated);

  await db.reminders.put(updated);

  if (updated.enabled) {
    await scheduleReminderNotification(updated);
  } else {
    await cancelReminderNotification(updated.id);
  }

  return updated;
}

export async function deleteReminder(
  id: string,
): Promise<void> {
  const existing =
    await db.reminders.get(id);

  if (!existing) {
    return;
  }

  if (
    existing.ownerId !== LOCAL_PROFILE_ID
  ) {
    throw new Error(
      "You cannot delete this reminder.",
    );
  }

  await db.reminders.delete(id);
  await cancelReminderNotification(id);
}

/**
 * Dismiss a reminder by disabling it.
 */
export async function dismissReminder(
  id: string,
): Promise<void> {
  await updateReminder(id, {
    enabled: false,
  });
}

/**
 * Generates automatic reminders for coverages
 * that have reminders enabled and are approaching
 * their end date.
 *
 * This checks whether a reminder already exists
 * for each coverage to avoid duplicates.
 */
export async function syncCoverageReminders(): Promise<
  number
> {
  const coverages = await db.coverages
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  const existingReminders =
    await db.reminders
      .where("ownerId")
      .equals(LOCAL_PROFILE_ID)
      .toArray();

  const existingCoverageReminderIds =
    new Set(
      existingReminders
        .filter(
          (r) =>
            r.relatedEntityType ===
            "coverage",
        )
        .map(
          (r) => r.relatedEntityId,
        ),
    );

  const todayStr = new Date()
    .toISOString()
    .slice(0, 10);

  let created = 0;

  for (const coverage of coverages) {
    if (!coverage.reminderEnabled) {
      continue;
    }

    if (coverage.endDate < todayStr) {
      continue;
    }

    if (
      existingCoverageReminderIds.has(
        coverage.id,
      )
    ) {
      continue;
    }

    /*
     * Calculate the reminder due date:
     *
     * endDate - reminderDaysBefore
     */
    const endDate = new Date(
      coverage.endDate,
    );

    const reminderDate = new Date(
      endDate,
    );

    reminderDate.setDate(
      reminderDate.getDate() -
        coverage.reminderDaysBefore,
    );

    const reminderDateStr =
      reminderDate
        .toISOString()
        .slice(0, 10);

    /*
     * Lookup the product name for a helpful
     * reminder title.
     */
    let productName = "Item";
    if (coverage.productId) {
      const product = await db.products.get(coverage.productId);
      if (product) productName = product.name;
    }

    const coverageLabel =
      coverage.type === "warranty"
        ? "Warranty"
        : coverage.type ===
            "extended-warranty"
          ? "Extended Warranty"
          : coverage.type === "amc"
            ? "AMC"
            : "Insurance";

    await createReminder({
      title: `${coverageLabel} expiring for ${productName}`,
      dueDate: reminderDateStr,
      relatedEntityType: "coverage",
      relatedEntityId: coverage.id,
      enabled: true,
    });

    created += 1;
  }

  return created;
}

/**
 * Generates automatic reminders for documents
 * that have an expiry date set.
 */
export async function syncDocumentReminders(): Promise<
  number
> {
  const documents = await db.documents
    .where("ownerId")
    .equals(LOCAL_PROFILE_ID)
    .toArray();

  const existingReminders =
    await db.reminders
      .where("ownerId")
      .equals(LOCAL_PROFILE_ID)
      .toArray();

  const existingDocReminderIds =
    new Set(
      existingReminders
        .filter(
          (r) =>
            r.relatedEntityType ===
            "document",
        )
        .map(
          (r) => r.relatedEntityId,
        ),
    );

  const todayStr = new Date()
    .toISOString()
    .slice(0, 10);

  let created = 0;

  for (const doc of documents) {
    if (!doc.expiryDate) {
      continue;
    }

    if (doc.expiryDate < todayStr) {
      continue;
    }

    if (
      existingDocReminderIds.has(doc.id)
    ) {
      continue;
    }

    /*
     * Remind 30 days before document expiry
     * by default.
     */
    const expiryDate = new Date(
      doc.expiryDate,
    );

    const reminderDate = new Date(
      expiryDate,
    );

    reminderDate.setDate(
      reminderDate.getDate() - 30,
    );

    const reminderDateStr =
      reminderDate
        .toISOString()
        .slice(0, 10);

    await createReminder({
      title: `${doc.title} expiring soon`,
      dueDate: reminderDateStr,
      relatedEntityType: "document",
      relatedEntityId: doc.id,
      enabled: true,
    });

    created += 1;
  }

  return created;
}

