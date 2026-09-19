import { useCallback, useEffect, useRef, useState } from "react";
import { API, api, session } from "../services/api";
import type { Meeting } from "../../../shared/types";
export function useMeeting(id: string | undefined) {
  const [meeting, setMeeting] = useState<Meeting | null>(null),
    [error, setError] = useState("");
  const latest = useRef(id);
  latest.current = id;
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const m = await api<Meeting>(`/meetings/${id}`);
      if (latest.current === id) {
        setMeeting(m);
        setError("");
      }
    } catch (e) {
      if (latest.current === id) setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    setMeeting(null);
    setError("");
    if (!id) return;
    void refresh();
    let ws: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout>;
    let alive = true;
    const connect = () => {
      if (!alive) return;
      ws = new WebSocket(API.replace(/^http/, "ws") + `/ws/meetings/${id}`);
      ws.onopen = () => ws?.send(JSON.stringify({ token: session()?.token }));
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "updated" || data.type === "deleted") void refresh();
      };
      ws.onclose = () => {
        if (alive) reconnect = setTimeout(connect, 4000);
      };
    };
    connect();
    const poll = setInterval(refresh, 7000);
    const ping = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);
    return () => {
      alive = false;
      clearTimeout(reconnect);
      clearInterval(poll);
      clearInterval(ping);
      ws?.close();
    };
  }, [id, refresh]);
  return { meeting, error, refresh };
}
