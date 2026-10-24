// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { garmentStatusSnapshot, publishPhotoStates, requestPhotoRetry, resetGarmentStatus, useGarmentPhotoRetries } from "./garment-status";

afterEach(() => { cleanup(); resetGarmentStatus(); });

function RetryProbe() {
  return <output>{JSON.stringify(useGarmentPhotoRetries())}</output>;
}

it("a retry affects only its selected photograph and is deduplicated while loading", () => {
  resetGarmentStatus();
  publishPhotoStates({ jeans: "falhou", shirt: "ok" });
  render(<RetryProbe />);
  act(() => { requestPhotoRetry("jeans"); requestPhotoRetry("jeans"); });
  expect(screen.getByRole("status").textContent).toBe('{"jeans":1}');
  expect(garmentStatusSnapshot().photos).toEqual({ jeans: "carregando", shirt: "ok" });
  act(() => publishPhotoStates({ jeans: "falhou", shirt: "ok" }));
  act(() => requestPhotoRetry("jeans"));
  expect(screen.getByRole("status").textContent).toBe('{"jeans":2}');
});

it("stale selections and resets do not retain retry revisions", () => {
  resetGarmentStatus();
  publishPhotoStates({ old: "falhou" });
  requestPhotoRetry("old");
  publishPhotoStates({ current: "falhou" });
  render(<RetryProbe />);
  act(() => requestPhotoRetry("current"));
  expect(screen.getByRole("status").textContent).toBe('{"current":1}');
  act(() => resetGarmentStatus());
  expect(screen.getByRole("status").textContent).toBe("{}");
});
