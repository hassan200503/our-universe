/*
 * Our Universe service worker: push only. It never intercepts page loads,
 * so the site always behaves exactly as it does without it.
 *
 * Alerts reach this device whether or not anyone is signed in on it, and
 * whether or not the site is open, the way a phone's messenger does:
 *
 *  - An incoming call rings as a notification with Answer / Decline, and rings
 *    again every few seconds until it's picked up, declined or missed (unless
 *    a signed-in page is on screen, which rings by itself).
 *  - A message shows as a notification when a signed-in page isn't on screen,
 *    and the app icon shows how many are unread.
 *  - "call-end" closes a ringing notification: a call nobody answered becomes
 *    a "Missed call" notice; one answered on another device just goes quiet.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ICON = "/icon-192.png";

async function windows() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

/** A signed-in page on screen right now (the sign-in page doesn't count: it can't ring). */
async function visibleApp() {
  const list = await windows();
  for (const c of list) c.postMessage({ type: "push" });
  return list.find((c) => c.visibilityState === "visible" && !new URL(c.url).pathname.startsWith("/login"));
}

function badge(n) {
  if (!self.navigator.setAppBadge) return Promise.resolve();
  return (n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {});
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    return;
  }
  event.waitUntil(
    (async () => {
      const open = await visibleApp();
      if (data.type === "call-end") {
        const tag = `call-${data.callId}`;
        (await self.registration.getNotifications({ tag })).forEach((n) => n.close());
        if (open) return;
        const kind = data.kind === "video" ? "video" : "voice";
        if (data.reason === "missed") {
          await self.registration.showNotification(`Missed ${kind} call`, {
            body: `${data.title || "Your partner"} tried to reach you`,
            tag: `missed-${data.callId}`,
            icon: ICON,
            badge: ICON,
            data: { url: "/together/chat" },
          });
          return;
        }
        // Every push must show something while the site is closed: say it briefly and silently, then clear it.
        await self.registration.showNotification(data.title || "Our Universe", {
          body: data.reason === "answered" ? "Answered on another device" : "Call declined",
          tag,
          silent: true,
          icon: ICON,
          badge: ICON,
        });
        await new Promise((r) => setTimeout(r, 3000));
        (await self.registration.getNotifications({ tag })).forEach((n) => n.close());
        return;
      }
      if (data.type === "call") {
        if (open) return;
        await self.registration.showNotification(data.title || "Our Universe", {
          body: data.body || "Incoming call",
          tag: `call-${data.callId}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [600, 300, 600, 300, 600, 300, 600],
          icon: ICON,
          badge: ICON,
          timestamp: Date.now(),
          data: { url: data.url, callId: data.callId, token: data.token },
          actions: [
            { action: "answer", title: data.kind === "video" ? "Answer video" : "Answer" },
            { action: "decline", title: "Decline" },
          ],
        });
        return;
      }
      if (data.type === "message") {
        await badge(data.unread || 0);
        if (open) return;
        await self.registration.showNotification(data.title || "Our Universe", {
          body: data.body || "New message",
          tag: data.tag || "chat",
          renotify: true,
          icon: ICON,
          badge: ICON,
          timestamp: Date.now(),
          data: { url: data.url || "/together/chat" },
        });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const { url = "/", callId, token } = n.data || {};
  n.close();
  event.waitUntil(
    (async () => {
      if (event.action === "decline" && callId) {
        // The signed token lets this work even when nobody is signed in on this device.
        await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "decline", id: callId, token }) }).catch(() => {});
        return;
      }
      const target = new URL(url, self.location.origin);
      if (event.action === "answer" && callId) target.searchParams.set("answer", "1");
      const list = await windows();
      const existing = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        const signedOut = new URL(existing.url).pathname.startsWith("/login");
        // A signed-in tab takes the call where it is; otherwise open the destination (sign-in first, then straight there).
        if (!signedOut && callId) {
          existing.postMessage({ type: "push", answer: event.action === "answer" ? callId : null });
          return;
        }
        if ("navigate" in existing) {
          const went = await existing.navigate(target.href).catch(() => null);
          if (went) return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
