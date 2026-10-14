import type { DeviceLogFeedPort, DeviceLogObservation } from "@/lib/server/application/ports";
import { DEVICE_LOG_BACKLOG_LIMIT, type DeviceLogEntry } from "@/lib/types/device-log";

const MAX_TRACKED_DEVICE_STATES = 100;

type DeviceLogListener = (entry: DeviceLogEntry) => void;

interface DeviceLogState {
  entries: DeviceLogEntry[];
  lastTouchedOrder: number;
}

function cloneEntry(entry: DeviceLogEntry): DeviceLogEntry {
  return { ...entry };
}

export class InMemoryDeviceLogFeed implements DeviceLogFeedPort {
  private readonly deviceStates = new Map<string, DeviceLogState>();
  private readonly deviceSubscribers = new Map<string, Set<DeviceLogListener>>();
  private sequence = 0;
  private touchSequence = 0;

  constructor(
    private readonly backlogLimit = DEVICE_LOG_BACKLOG_LIMIT,
    private readonly maxTrackedDevices = MAX_TRACKED_DEVICE_STATES,
  ) {}

  append(entry: Omit<DeviceLogEntry, "id">): DeviceLogEntry {
    this.sequence += 1;
    const state = this.getDeviceState(entry.deviceId);
    const stored: DeviceLogEntry = { id: `${this.sequence}-${entry.deviceId}-${entry.timestamp}`, ...entry };

    state.entries.push(stored);
    if (state.entries.length > this.backlogLimit) {
      state.entries.splice(0, state.entries.length - this.backlogLimit);
    }
    for (const subscriber of this.deviceSubscribers.get(entry.deviceId) ?? []) {
      subscriber(cloneEntry(stored));
    }
    return cloneEntry(stored);
  }

  observe(deviceId: string): DeviceLogObservation {
    const state = this.deviceStates.get(deviceId);
    if (state) state.lastTouchedOrder = this.nextTouchOrder();

    return {
      snapshot: state?.entries.map(cloneEntry) ?? [],
      subscribe: (listener) => {
        let subscribers = this.deviceSubscribers.get(deviceId);
        if (!subscribers) {
          subscribers = new Set();
          this.deviceSubscribers.set(deviceId, subscribers);
        }
        const set = subscribers;
        set.add(listener);
        return () => {
          set.delete(listener);
          if (set.size === 0) this.deviceSubscribers.delete(deviceId);
        };
      },
    };
  }

  private getDeviceState(deviceId: string): DeviceLogState {
    let state = this.deviceStates.get(deviceId);
    if (!state) {
      state = { entries: [], lastTouchedOrder: this.nextTouchOrder() };
      this.deviceStates.set(deviceId, state);
      this.prune();
    }
    state.lastTouchedOrder = this.nextTouchOrder();
    return state;
  }

  private prune(): void {
    if (this.deviceStates.size <= this.maxTrackedDevices) return;
    const oldestFirst = [...this.deviceStates.entries()].sort((a, b) => a[1].lastTouchedOrder - b[1].lastTouchedOrder);
    while (this.deviceStates.size > this.maxTrackedDevices && oldestFirst.length > 0) {
      this.deviceStates.delete(oldestFirst.shift()![0]);
    }
  }

  private nextTouchOrder(): number {
    this.touchSequence += 1;
    return this.touchSequence;
  }
}

// Una sola instancia por proceso aunque Next cargue el módulo varias veces
// (bundles por ruta, HMR en dev).
const GLOBAL_KEY = Symbol.for("sake.deviceLogFeed");
const globalStore = globalThis as unknown as Record<symbol, InMemoryDeviceLogFeed | undefined>;
export const deviceLogFeed: InMemoryDeviceLogFeed = (globalStore[GLOBAL_KEY] ??= new InMemoryDeviceLogFeed());
