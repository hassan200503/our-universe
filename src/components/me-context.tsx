"use client";

import { createContext, useContext } from "react";

export type Me = { id: string; slug: string; displayName: string; theme: string; avatarUrl?: string | null };
export type Member = Me;

const MeContext = createContext<{ me: Me; members: Member[] } | null>(null);

export function MeProvider({ me, members, children }: { me: Me | null; members?: Member[]; children: React.ReactNode }) {
  return <MeContext.Provider value={me ? { me, members: members ?? [me] } : null}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const v = useContext(MeContext);
  if (!v) throw new Error("useMe outside a signed-in page");
  return v.me;
}

/** Everyone in the relationship, me first. */
export function useMembers(): Member[] {
  return useContext(MeContext)?.members ?? [];
}

export function usePartners(): Member[] {
  const v = useContext(MeContext);
  return v ? v.members.filter((m) => m.id !== v.me.id) : [];
}
