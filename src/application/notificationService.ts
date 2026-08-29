import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { ReminderRecord } from '../infrastructure/database/db';
import { isTauri, showDesktopNotification } from '../platform/desktopBridge';

const CHANNEL_ID = 'reminders_channel';

/**
 * Hash a UUID string to a 32-bit integer for the Local Notification ID
 */
function uuidToInt(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Initialize Android notification channel with high priority and sound
 */
export async function initializeNotificationChannels(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Vault Reminders & Expirations',
      description: 'Alerts for upcoming document expirations, product warranties, and tasks',
      importance: 5, // High priority (heads-up notification + sound)
      visibility: 1, // Public on lock screen
      vibration: true,
      sound: undefined,
    });
  } catch (error) {
    console.warn("Could not create notification channel:", error);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isTauri()) {
    return true;
  }
  if (Capacitor.getPlatform() === 'web') {
    return false;
  }

  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'granted') {
      await initializeNotificationChannels();
      return true;
    }

    const requestStatus = await LocalNotifications.requestPermissions();
    const granted = requestStatus.display === 'granted';
    if (granted) {
      await initializeNotificationChannels();
    }
    return granted;
  } catch (error) {
    console.warn("Failed to request notification permissions", error);
    return false;
  }
}

export async function scheduleReminderNotification(reminder: ReminderRecord): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return;
  if (!reminder.enabled) return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Convert YYYY-MM-DD to a JS Date at 9:00 AM local time
    const [year, month, day] = reminder.dueDate.split('-').map(Number);
    const scheduleDate = new Date();
    scheduleDate.setFullYear(year, month - 1, day);
    scheduleDate.setHours(9, 0, 0, 0);

    const now = Date.now();
    let atTime: Date = scheduleDate;

    // If due date is today and 9 AM has already passed, schedule 5 seconds from now for demonstration/utility
    const today = new Date();
    const isToday = 
      today.getFullYear() === year && 
      today.getMonth() === (month - 1) && 
      today.getDate() === day;

    if (scheduleDate.getTime() < now) {
      if (isToday) {
        atTime = new Date(now + 5000); // 5 seconds from now
      } else {
        // Due date was in previous days - don't schedule stale alert
        return;
      }
    }

    const notifId = uuidToInt(reminder.id);

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "MyLifeDock Reminder",
          body: reminder.title,
          id: notifId,
          schedule: { at: atTime },
          channelId: CHANNEL_ID,
          sound: undefined,
          actionTypeId: "",
          extra: { reminderId: reminder.id }
        }
      ]
    });
  } catch (error) {
    console.error("Failed to schedule notification", error);
  }
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: uuidToInt(reminderId) }]
    });
  } catch (error) {
    console.error("Failed to cancel notification", error);
  }
}

/**
 * Send an immediate test notification to verify system capabilities on device
 */
export async function sendTestNotification(): Promise<boolean> {
  if (isTauri()) {
    await showDesktopNotification("MyLifeDock Notifications Active 🛡️", "Vault alerts and expiration reminders are working properly on desktop!");
    return true;
  }

  if (Capacitor.getPlatform() === 'web') {
    return false;
  }

  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: "MyLifeDock Notifications Active 🛡️",
          body: "Vault alerts and expiration reminders are working properly!",
          id: 99999,
          schedule: { at: new Date(Date.now() + 1500) }, // 1.5 seconds from now
          channelId: CHANNEL_ID,
        }
      ]
    });
    return true;
  } catch (error) {
    console.error("Failed to send test notification", error);
    return false;
  }
}
