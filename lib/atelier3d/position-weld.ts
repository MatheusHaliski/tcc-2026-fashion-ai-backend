/** Analysis-only welding in file units. UVs, indices and the original positions remain untouched. */
export function positionalGroups(positions: Float32Array, tolerance = 1e-6) {
  if (!Number.isFinite(tolerance) || tolerance <= 0 || positions.length % 3 !== 0) {
    throw Error("ATELIER_COMMAND_VALUE");
  }
  const groups: number[][] = [];
  const groupOf: number[] = [];
  const cells = new Map<string, number[]>();
  const squaredTolerance = tolerance * tolerance;
  for (let i = 0; i < positions.length / 3; i++) {
    const point = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const cell = point.map(value => Math.floor(value / tolerance));
    let group: number | undefined;
    // Coincident points can straddle a cell boundary, including the signed-zero UV seam.
    search: for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const key = `${cell[0] + x},${cell[1] + y},${cell[2] + z}`;
          for (const candidate of cells.get(key) ?? []) {
            const representative = groups[candidate][0] * 3;
            const distanceSquared = point.reduce((sum, value, axis) =>
              sum + (value - positions[representative + axis]) ** 2, 0);
            if (distanceSquared <= squaredTolerance) {
              group = candidate;
              break search;
            }
          }
        }
      }
    }
    if (group === undefined) {
      group = groups.length;
      groups.push([]);
      const key = cell.join(",");
      const bucket = cells.get(key) ?? [];
      bucket.push(group);
      cells.set(key, bucket);
    }
    groups[group].push(i);
    groupOf.push(group);
  }
  return { groups, groupOf };
}
