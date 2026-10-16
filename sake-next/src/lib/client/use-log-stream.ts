"use client";

import { useEffect, useState } from "react";

export type LogStreamState = "connecting" | "live" | "reconnecting" | "disconnected";

interface StreamStore<T> {
  url: string | null;
  entries: T[];
  state: LogStreamState;
  connectedOnce: boolean;
}

// Suscripción SSE (eventos `snapshot` y `entry`) a una ruta de logs, con backlog acotado.
// El estado va ligado a la URL: al cambiar de URL se ignora lo anterior sin resetear en el efecto.
export function useLogStream<T extends { id: string }>(url: string | null, limit: number) {
  const [store, setStore] = useState<StreamStore<T>>({ url: null, entries: [], state: "disconnected", connectedOnce: false });

  useEffect(() => {
    if (!url || typeof EventSource === "undefined") return;
    const source = new EventSource(url);
    const update = (change: (current: StreamStore<T>) => Partial<StreamStore<T>>) =>
      setStore((current) => {
        const base = current.url === url ? current : { url, entries: [], state: "connecting" as const, connectedOnce: false };
        return { ...base, ...change(base) };
      });
    const parse = <D,>(event: Event): D | null => {
      const data = (event as MessageEvent<string>).data;
      if (typeof data !== "string" || data.trim() === "") return null;
      try {
        return JSON.parse(data) as D;
      } catch {
        return null;
      }
    };

    source.addEventListener("open", () => update(() => ({ state: "live", connectedOnce: true })));
    source.addEventListener("snapshot", (event) => {
      const payload = parse<{ entries: T[] }>(event);
      if (payload) update(() => ({ entries: payload.entries.slice(-limit) }));
    });
    source.addEventListener("entry", (event) => {
      const payload = parse<T>(event);
      if (payload) update((current) => ({ entries: [...current.entries, payload].slice(-limit) }));
    });
    source.addEventListener("error", () => update((current) => ({ state: current.connectedOnce ? "reconnecting" : "connecting" })));

    return () => source.close();
  }, [url, limit]);

  const active = url !== null && store.url === url;
  return {
    entries: active ? store.entries : [],
    state: (url === null ? "disconnected" : active ? store.state : "connecting") as LogStreamState,
  };
}
