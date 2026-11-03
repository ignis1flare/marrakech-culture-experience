type Listener = (event?: string) => void;
type EventListener = (event: string, payload: unknown) => void;
export type SessionConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/**
 * Small Socket.IO boundary for live session refreshes. The client is loaded lazily,
 * so the experience remains usable in installations where realtime is not bundled yet.
 */
async function connectToSession(
  code: string,
  onChange: Listener,
  onEvent?: EventListener,
  role?: "projector",
  onConnectionChange?: (state: SessionConnectionState) => void,
) {
  if (!code) return () => undefined;
  onConnectionChange?.("connecting");
  try {
    const { io } = await import('socket.io-client');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;
    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 20000,
      auth: { sessionCode: code, ...(role ? { role } : {}) },
    });
    const refresh = (event?: string) => onChange(event);
    const connected = () => {
      onConnectionChange?.("connected");
      refresh();
    };
    const disconnected = (reason: string) => {
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        onConnectionChange?.("disconnected");
      } else {
        onConnectionChange?.("reconnecting");
      }
    };
    const reconnectAttempt = () => {
      onConnectionChange?.("reconnecting");
    };
    const connectionError = () => {
      onConnectionChange?.(socket.active ? "reconnecting" : "disconnected");
    };
    socket.on('connect', connected);
    socket.on('disconnect', disconnected);
    socket.on('connect_error', connectionError);
    socket.io.on('reconnect_attempt', reconnectAttempt);
    socket.io.on('reconnect', connected);
    const handleEvent = (event: string, payload?: unknown) => {
      refresh(event);
      onEvent?.(event, payload);
    };
    socket.onAny(handleEvent);
    return () => {
      socket.off('connect', connected);
      socket.off('disconnect', disconnected);
      socket.off('connect_error', connectionError);
      socket.io.off('reconnect_attempt', reconnectAttempt);
      socket.io.off('reconnect', connected);
      socket.offAny(handleEvent);
      socket.disconnect();
    };
  } catch (error) {
    console.error("Unable to load the live session connection.", error);
    onConnectionChange?.("disconnected");
    return () => undefined;
  }
}

export function subscribeToSession(
  code: string,
  onChange: Listener,
  onEvent?: EventListener,
  onConnectionChange?: (state: SessionConnectionState) => void,
) {
  return connectToSession(code, onChange, onEvent, undefined, onConnectionChange);
}

export function subscribeToProjectorSession(
  code: string,
  onChange: Listener,
  onEvent?: EventListener,
  onConnectionChange?: (state: SessionConnectionState) => void,
) {
  return connectToSession(code, onChange, onEvent, "projector", onConnectionChange);
}
