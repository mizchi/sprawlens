import { useEffect, useRef } from "preact/hooks";

/**
 * Subscribe to a server-sent-events endpoint for the lifetime of `url`. Null url
 * means "don't connect" (sources without a live backend). `onOpen` fires when a
 * subscription (re)starts — reset per-connection state there; `onMessage` gets
 * each event's raw data. The stream gives up after three consecutive errors so a
 * missing endpoint (static build) fails quietly. Pure host/network glue, kept
 * out of the data pipeline so the application logic stays declarative.
 */
export function useEventSource(
  url: string | null,
  handlers: { onMessage: (data: string) => void; onOpen?: () => void },
) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!url) return;
    ref.current.onOpen?.();
    let failures = 0;
    const stream = new EventSource(url);
    stream.onmessage = (event) => {
      failures = 0;
      ref.current.onMessage(event.data);
    };
    stream.onerror = () => {
      if (++failures >= 3) stream.close();
    };
    return () => stream.close();
  }, [url]);
}
