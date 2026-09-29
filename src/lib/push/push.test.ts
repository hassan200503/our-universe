import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import webpush from "web-push";
import { vapidKeys } from "./server";

describe("push keys", () => {
  it("derives a valid VAPID key pair from the deployment secret and signs a real push request", () => {
    const { publicKey, privateKey } = vapidKeys();
    expect(Buffer.from(publicKey, "base64url")).toHaveLength(65);
    expect(Buffer.from(privateKey, "base64url")).toHaveLength(32);
    // Same secret, same keys: every server instance agrees without any setup.
    expect(vapidKeys()).toEqual({ publicKey, privateKey });

    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: browser.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
    const req = webpush.generateRequestDetails(sub, JSON.stringify({ type: "message", title: "Whitney", body: "hi", url: "/together/chat", tag: "chat" }), {
      vapidDetails: { subject: "mailto:our-universe@users.noreply.github.com", publicKey, privateKey },
      TTL: 60,
      urgency: "high",
    });
    expect(req.endpoint).toBe(sub.endpoint);
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(req.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(req.headers.Urgency).toBe("high");
  });
});
