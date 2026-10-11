// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useVisibleRefresh } from "./use-visible-refresh";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
it("polls visible tabs, refreshes on return and cancels on unmount", async () => {
  vi.useFakeTimers();
  let visible = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
  const refresh = vi.fn(async (_signal: AbortSignal) => {});
  const view = renderHook(() => useVisibleRefresh(refresh));
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  visible = "hidden";
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  visible = "visible";
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(2);
});
it("does not overlap requests and aborts the pending request on unmount", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const refresh = vi.fn((_signal: AbortSignal) => new Promise<void>(() => {}));
  const view = renderHook(() => useVisibleRefresh(refresh));
  await act(() => vi.advanceTimersByTimeAsync(90_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  const signal = refresh.mock.calls[0][0];
  view.unmount();
  expect(signal.aborted).toBe(true);
});
