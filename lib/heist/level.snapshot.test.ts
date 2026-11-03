/*
 * Retrato das tabelas da planta (level.ts): cada tabela é serializada em JSON e comparada por SHA-256 com o valor
 * capturado antes da divisão do arquivo em level-*.ts. Se um número, string ou ordem mudar, o digest muda.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as level from "./level";
import {
  CHECKPOINTS, CIVILIANS, CLIMB_TO, CODES, CURB_Z, DIAMOND_POS, DOCK_RAMP, DOORS, ENTRY_PATH, EXITS, FAR_CURB_Z, GUARDS, INNER_WALLS,
  INTERACTS, LASERS, MAZE, PLAYER_SPAWN, PLAYER_SPAWN_YAW, QUEUE_SLOTS, RACKS, RING_SYMBOLS, ROAD_Y, ROOMS, ROOM_LIGHT, ROOM_TIER,
  SIDEWALK_Y, STAIRS, STASH_REWARD, VAULT_ENTRY, VENDOR_OFFERS, baseProps, floorY, mazeCell, mazeWalls,
} from "./level";

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** floorY numa grade de 1 m (x −32…32, z −26…51) e nos degraus da escadaria com passo de 0,1 m. */
function floorGrid(): number[] {
  const out: number[] = [];
  for (let z = -26; z <= 51; z++) for (let x = -32; x <= 32; x++) out.push(Math.round(floorY({ x, z }) * 1000) / 1000);
  for (let z = 24; z <= 32; z += 0.1) for (const x of [-21, -19, -17, -6, 0, 6, 10, 22.4, 22.6]) out.push(Math.round(floorY({ x, z: Math.round(z * 10) / 10 }) * 1000) / 1000);
  return out;
}

const mazeCells = () => { const out: level.LaserDef["a"][] = []; for (let c = 0; c < MAZE.cols; c++) for (let r = 0; r < MAZE.rows; r++) out.push(mazeCell(c, r)); return out; };

const TABLES: Record<string, () => unknown> = {
  exports: () => Object.keys(level).sort(),
  ROOMS: () => ROOMS, ROOM_LIGHT: () => ROOM_LIGHT, ROOM_TIER: () => ROOM_TIER, DOORS: () => DOORS,
  MAZE: () => MAZE, mazeWalls: () => mazeWalls(), INNER_WALLS: () => INNER_WALLS, mazeCell: () => mazeCells(),
  heights: () => ({ SIDEWALK_Y, ROAD_Y, CURB_Z, FAR_CURB_Z, STAIRS, DOCK_RAMP }), floorY: () => floorGrid(),
  baseProps: () => baseProps(), RACKS: () => RACKS,
  spawns: () => ({ PLAYER_SPAWN, PLAYER_SPAWN_YAW, DIAMOND_POS, VAULT_ENTRY, CHECKPOINTS, QUEUE_SLOTS, ENTRY_PATH, EXITS }),
  LASERS: () => LASERS, GUARDS: () => GUARDS, CIVILIANS: () => CIVILIANS, INTERACTS: () => INTERACTS, CLIMB_TO: () => CLIMB_TO,
  STASH_REWARD: () => STASH_REWARD, CODES: () => CODES, RING_SYMBOLS: () => RING_SYMBOLS, VENDOR_OFFERS: () => VENDOR_OFFERS,
};

/** Capturado no código original (lib/heist/level.ts com 620 linhas), antes da extração. */
const EXPECTED: Record<string, string> = {
  exports: "512913d99068902c6373955d3c83136ca480d34d258916f207d674c66a38c611",
  ROOMS: "a983597b7320d2dd0cd742ffdd46172a2ee1b7466dd5c5b17e46666202eba6f4",
  ROOM_LIGHT: "adc2682b572f88d76565400b7a7d6451961d9fa0a0fdb1e55eb27cabae44890a",
  ROOM_TIER: "a502c0fddf5c5f7df247e15564200d234ba9f3e6bcf29ac33958d97e60d2fcae",
  DOORS: "94b9fc41c41b5d9a828ad2c29e2bb65aeb61f7fd22410c3bc6324f583cf4724f",
  MAZE: "2d5ffea83d757e288a4bc7de68f2fb13e1ac7543220f75058d02519fb3136799",
  mazeWalls: "f387c3b866bbdbd8405891ff58fdb82e019612bfd759beb7f0d117fd95d43256",
  INNER_WALLS: "f387c3b866bbdbd8405891ff58fdb82e019612bfd759beb7f0d117fd95d43256",
  mazeCell: "680cfafcd222551932846dc2ac8c9f793b351b4f64b1043301cff2cf2878f546",
  heights: "c5aec5bfb3ad75279bb0950eed7659003cf6f9c5c687daedc5e482ab2b0142e0",
  floorY: "75f49bf97f809a49a3d7c61fcd63a7817f8501dafff83624504223ebe1e297d2",
  baseProps: "4392de6c4141c87af462adc5f07c1b6cd210693778a35bb46a4cd52699cbe66a",
  RACKS: "0b1beccef8915c727a9bc8e58b0651d74488871440e0508abd7ac48ce5eedaaa",
  spawns: "c66e19bd5990e522babb475f8d0245ded2006bf1cc8fed2b5c7bea2c8c19a2de",
  LASERS: "8aa7287a1b13f37652b32a7f5d82421668f58f105813e701d27677262facbe6c",
  GUARDS: "2757687f2de2f5cb6ba811e3828c725a6a4cfae719a61f0087c1a70e3fe76cdd",
  CIVILIANS: "61df0eff368a23cf3abb00f43958cb0636ac88f77e5dccab8132af525e79c09a",
  INTERACTS: "b18e630abb2b2307c75b7c6993821620fd52416fe7144fae905327afca42019c",
  CLIMB_TO: "df07d4576ed30f67573ccf954edb320ad1b10639d4c16a3adef6c865e7c00096",
  STASH_REWARD: "e02a5fa9865ae79b9beb8ae2001a0a5951ed75b9d0b91a9d43d79ab896e405dc",
  CODES: "c48045e8e9f7826accaf86a93849b6a81287f568a10dd7cf3df457fe538e87ab",
  RING_SYMBOLS: "91a87492e138521278c603890718d0cb33adc5f949523e0f02ce2b855b3725c4",
  VENDOR_OFFERS: "2cd5a45ed577b3c207fb876768f6be12debdc3eac436373527a4d9a54d5c6855",
};

const COUNTS = { rooms: 13, doors: 19, innerWalls: 73, props: 220, racks: 5, lasers: 5, guards: 31, civilians: 133, interacts: 34 };

describe("retrato da planta (level.ts)", () => {
  it("as tabelas continuam idênticas (SHA-256 do JSON)", () => {
    const got = Object.fromEntries(Object.entries(TABLES).map(([k, f]) => [k, sha(f())]));
    const diff = Object.keys(got).filter((k) => got[k] !== EXPECTED[k]);
    if (diff.length) console.log(JSON.stringify(got, null, 2));
    expect(diff).toEqual([]);
  });

  it("contagens e amostras legíveis", () => {
    expect(ROOMS.length).toBe(COUNTS.rooms); expect(DOORS.length).toBe(COUNTS.doors); expect(INNER_WALLS.length).toBe(COUNTS.innerWalls);
    expect(baseProps().length).toBe(COUNTS.props); expect(RACKS.length).toBe(COUNTS.racks); expect(LASERS.length).toBe(COUNTS.lasers);
    expect(GUARDS.length).toBe(COUNTS.guards); expect(CIVILIANS.length).toBe(COUNTS.civilians); expect(INTERACTS.length).toBe(COUNTS.interacts);
    expect(baseProps().map((p) => p.id)).toEqual(baseProps().map((p) => p.id));          // ids estáveis entre chamadas
    expect(mazeWalls()).toEqual(INNER_WALLS);
    expect(floorY({ x: 0, z: 0 })).toBe(0); expect(floorY({ x: 0, z: 40 })).toBe(ROAD_Y); expect(floorY({ x: 25, z: 0 })).toBe(SIDEWALK_Y);
    expect(CODES).toEqual({ service: "1957", safe: "0412", rings: [2, 0, 3] });
  });
});
