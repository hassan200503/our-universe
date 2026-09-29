/** Call shapes shared by the API and the browser (safe to import on the client). */

export type CallStatus = "calling" | "ringing" | "active" | "ended" | "missed" | "declined" | "cancelled" | "busy" | "failed";

export type CallView = {
  id: string;
  kind: "audio" | "video";
  status: CallStatus;
  /** My side of it. */
  role: "caller" | "callee";
  partnerSlug: string;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
};

export type CallSignal = { id: number; kind: "offer" | "answer" | "ice" | "restart"; payload: string };

export type CallSync = { serverNow: string; call: CallView; signals: CallSignal[] };

export const isLive = (s: CallStatus) => s === "calling" || s === "ringing" || s === "active";
