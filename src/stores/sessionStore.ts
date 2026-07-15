import { create } from "zustand";

// Client-side session state. The source of truth for authentication is
// always the httpOnly `sns_token` cookie (checked server-side by
// proxy.ts) — this store only mirrors UI-facing session info
// (e.g. the operator's display name) for components that need it without
// prop-drilling. It never reads or stores the JWT itself.
export interface SocOperator {
  email: string;
  tenantId?: string;
  role?: string;
}

interface SessionState {
  operator: SocOperator | null;
  setOperator: (operator: SocOperator | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  operator: null,
  setOperator: (operator) => set({ operator }),
  clear: () => set({ operator: null }),
}));
