"use client";

import { useEffect } from "react";

/**
 * Remembers which lines this device has just been shown, so the next visit
 * gets a different one. (A cookie the server reads when it picks.)
 */
export function RememberLines({ cookies }: { cookies: Record<string, string> }) {
  useEffect(() => {
    for (const [name, value] of Object.entries(cookies)) document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
  }, [cookies]);
  return null;
}
