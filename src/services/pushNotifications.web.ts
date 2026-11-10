export const ANNOUNCEMENTS_TOPIC = "cuevas-announcements";
export async function configureNotificationChannel() {}
export async function requestPushPermission(): Promise<boolean> { return false; }
export async function syncPushSubscription(_enabled: boolean) {}
export function observePushNotifications(_onTokenChanged: () => void) { return () => {}; }
