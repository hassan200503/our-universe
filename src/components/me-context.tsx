"use client";

import { createContext, useContext } from "react";

export type Me = { id: string; slug: string; displayName: string; theme: string };

const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me | null; children: React.ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside a signed-in page");
  return me;
}
