/**
 * In-app notification feed for product chrome.
 * There is no notification backend yet — the product panel stays empty.
 */

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export const PRODUCT_NOTIFICATIONS: AppNotification[] = [];
