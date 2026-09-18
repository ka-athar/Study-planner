// StudyFlow Service Worker for Background Push & Interactive Lock-Screen Actions
const SW_VERSION = 'studyflow-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Push Events
self.addEventListener('push', (event) => {
  let data = {
    title: '🎯 StudyFlow Academic Alert',
    body: 'You have scheduled revision sets due today!',
    tag: 'studyflow-alert'
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || `study-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'start-timer', title: '⏱️ Start 25m Timer' },
      { action: 'mark-done', title: '✅ Mark Done' }
    ],
    data: {
      url: data.url || '/',
      topicId: data.topicId,
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle Interactive Lock-Screen Action Clicks
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and broadcast action
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_CLICK',
            action: action || 'open',
            data: notification.data
          });
          return client.focus();
        }
      }

      // If no window is open, open a new one with query param
      const targetUrl = action === 'start-timer' ? '/?action=start-timer' : '/';
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle Background Sync Events for Offline Mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'studyflow-sync' || event.tag === 'studyflow-queue-flush') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'OFFLINE_BACKGROUND_SYNC_TRIGGER',
            timestamp: Date.now()
          });
        }
      })
    );
  }
});

