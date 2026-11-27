import { expect, it } from "vitest";
import { positionalGroups } from "./position-weld";

it("welds tiny signed seam noise and positions on opposite spatial-cell boundaries", () => {
  const original = new Float32Array([0, 0.35, 0.17, -7.59e-17, 0.35, 0.17,
    0.99e-6, 0, 0, 1.01e-6, 0, 0]);
  const before = original.slice();
  const { groupOf } = positionalGroups(original);
  expect(groupOf[0]).toBe(groupOf[1]);
  expect(groupOf[2]).toBe(groupOf[3]);
  expect(groupOf[0]).not.toBe(groupOf[2]);
  expect(original).toEqual(before);
});

it("keeps distinct nearby points outside the Euclidean tolerance in separate groups", () => {
  const { groups } = positionalGroups(new Float32Array([0, 0, 0, 0.8e-6, 0.8e-6, 0.8e-6, 3e-6, 0, 0]));
  expect(groups).toEqual([[0], [1], [2]]);
});
