import { describe, expect, it } from "vitest";
import { approach, orbitGoal, ORBIT_STEP_DEG, ZOOM_STEP, type OrbitPose } from "./orbit-steps";

const deg = (d: number) => d * Math.PI / 180;
const limits = { minRadius: 1.4, maxRadius: 4.5 };
const home: OrbitPose = { theta: 0, phi: deg(88), radius: 3.6 };

describe("passos de câmera dos botões do provador 3D", () => {
  it("gira 30° por clique em torno do avatar, sem mexer na altura nem na distância", () => {
    const left = orbitGoal(home, "left", limits, home), right = orbitGoal(home, "right", limits, home);
    expect(ORBIT_STEP_DEG).toBe(30);
    expect(left.theta).toBeCloseTo(deg(30)); expect(right.theta).toBeCloseTo(deg(-30));
    expect(left.phi).toBe(home.phi); expect(left.radius).toBe(home.radius);
    // cliques seguidos se somam (a meta parte da meta anterior)
    expect(orbitGoal(left, "left", limits, home).theta).toBeCloseTo(deg(60));
  });
  it("aproxima e afasta dentro dos limites de distância", () => {
    expect(orbitGoal(home, "in", limits, home).radius).toBeCloseTo(3.6 / ZOOM_STEP);
    expect(orbitGoal(home, "out", limits, home).radius).toBeCloseTo(3.6 * ZOOM_STEP);
    expect(orbitGoal({ ...home, radius: 1.5 }, "in", limits, home).radius).toBe(1.4);
    expect(orbitGoal({ ...home, radius: 4.2 }, "out", limits, home).radius).toBe(4.5);
  });
  it("volta à frente pelo caminho mais curto e restaura altura e distância", () => {
    const back = { theta: deg(170), phi: deg(60), radius: 2 };
    const goal = orbitGoal(back, "front", limits, home);
    expect(goal.theta).toBeCloseTo(0); expect(goal.phi).toBe(home.phi); expect(goal.radius).toBe(home.radius);
    // de 350° (= -10°) a frente fica a +10°, não a -350°
    expect(orbitGoal({ ...back, theta: deg(350) }, "front", limits, home).theta).toBeCloseTo(deg(360));
  });
  it("suaviza até a meta e chega de uma vez com movimento reduzido", () => {
    const goal = orbitGoal(home, "left", limits, home);
    let pose = home; for (let i = 0; i < 200 && pose !== goal; i++) pose = approach(pose, goal, .12);
    expect(pose).toBe(goal);
    expect(approach(home, goal, .12).theta).toBeGreaterThan(0);
    expect(approach(home, goal, .12).theta).toBeLessThan(goal.theta);
    expect(approach(home, goal, 1)).toBe(goal);
  });
});
