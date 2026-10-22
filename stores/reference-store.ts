import { create } from "zustand";

export type ReferenceStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "streaming"
  | "error";

export interface ReferenceCandidate {
  deviceId: string;
  name: string;
}

interface ReferenceState {
  status: ReferenceStatus;
  candidates: ReferenceCandidate[];
  deviceId: string | null;
  deviceName: string | null;
  errorMessage: string | null;

  setStatus: (status: ReferenceStatus, errorMessage?: string | null) => void;
  upsertCandidate: (candidate: ReferenceCandidate) => void;
  clearCandidates: () => void;
  setDevice: (deviceId: string | null, name: string | null) => void;
  reset: () => void;
}

export const useReferenceStore = create<ReferenceState>((set) => ({
  status: "idle",
  candidates: [],
  deviceId: null,
  deviceName: null,
  errorMessage: null,

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
  upsertCandidate: (candidate) =>
    set((state) =>
      state.candidates.some((c) => c.deviceId === candidate.deviceId)
        ? state
        : { candidates: [...state.candidates, candidate] }
    ),
  clearCandidates: () => set({ candidates: [] }),
  setDevice: (deviceId, deviceName) => set({ deviceId, deviceName }),
  reset: () =>
    set({
      status: "idle",
      candidates: [],
      deviceId: null,
      deviceName: null,
      errorMessage: null,
    }),
}));
