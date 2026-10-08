/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

/*
 * This is the single production service worker for the NSTA PWA.
 * Keeping Firebase Messaging here is important: PWA scanners and installed
 * browsers inspect /sw.js, not a second worker registered on another scope.
 */
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

type NstaPushPayload = {
  data?: Record<string, string>;
  notification?: { title?: string; body?: string; icon?: string };
  from?: string;
  messageId?: string;
  collapse_key?: string;
  fcmOptions?: unknown;
};

const showNstaNotification = (payload: NstaPushPayload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'NSTA Study App';
  const body = notification.body || data.body || 'New notification received!';
  const type = data.type || 'DEFAULT';
  const url = data.url || '/';
  const urgent = type === 'CHAT' || type === 'FRIEND_REQUEST' || type === 'DIRECT_MESSAGE';

  const rawIcon = notification.icon || data.icon || data.senderPhoto;
  const icon = (rawIcon && !rawIcon.endsWith('.svg')) ? rawIcon : '/icons/icon-192.png';

  const options = {
    body,
    icon,
    badge: '/icons/icon-192.png',
    tag: data.senderId ? `nsta-${type}-${data.senderId}` : `nsta-${type}-${Date.now()}`,
    renotify: urgent,
    requireInteraction: urgent,
    vibrate: urgent ? [200, 100, 200] : [80],
    data: { url, ...data },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  } as NotificationOptions & {
    renotify?: boolean;
    vibrate?: number[];
  };

  return self.registration.showNotification(title, options).catch(() => {
    // Graceful fallback for mobile browsers that reject actions/vibrate
    return self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url, ...data },
    });
  });
};

// Handle all background push notifications (Web Push + Firebase Cloud Messaging)
// Displays alert banner and sound/vibration even when app is closed or device is locked
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: NstaPushPayload;
  try {
    payload = event.data.json() as NstaPushPayload;
  } catch {
    payload = { data: { body: event.data.text() } };
  }

  event.waitUntil(showNstaNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) void client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});