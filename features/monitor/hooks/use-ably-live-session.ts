/**
 * Ably live session helpers.
 * AblyService lifecycle is owned by useMonitorSession — do not mount it twice.
 */

import { AblyService, ConnectionStatus } from "@/services/ably-service";
import { getApiBaseUrl } from "@/services/api-config";

export function createMonitorAblyService(
  onStatus: (status: ConnectionStatus) => void
): AblyService {
  const apiBaseUrl = getApiBaseUrl();
  return new AblyService(apiBaseUrl + "/services/ably", onStatus);
}

export function isAblyLiveConnected(status: ConnectionStatus): boolean {
  return status === ConnectionStatus.CONNECTED;
}

export type AblyLiveSlice = {
  ablyStatus: ConnectionStatus;
  authToken: string;
  userId: number;
  deviceCode: string;
};

export function selectAblyLiveSlice(session: AblyLiveSlice) {
  return {
    ...session,
    isAblyConnected: isAblyLiveConnected(session.ablyStatus),
  };
}

/** @deprecated Prefer selectAblyLiveSlice(session) to avoid duplicate listeners. */
export function useAblyLiveSession(): never {
  throw new Error(
    "useAblyLiveSession must not mount a second session. Use selectAblyLiveSlice(useMonitorSession())."
  );
}
