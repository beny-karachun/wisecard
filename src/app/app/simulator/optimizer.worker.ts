import { optimize, type OptimizeInput } from "@/lib/mortgage/engine";
self.onmessage = (
  event: MessageEvent<{ key: string; input: OptimizeInput }>,
) => {
  try {
    self.postMessage({
      key: event.data.key,
      result: optimize(event.data.input),
    });
  } catch (error) {
    self.postMessage({
      key: event.data.key,
      error: error instanceof Error ? error.message : "החיפוש לא הושלם",
    });
  }
};
