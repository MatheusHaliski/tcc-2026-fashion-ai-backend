// @vitest-environment jsdom
/*
 * Retrato (caracterização) dos objetos do quarto (room-props.tsx) e da roupa pendurada (hung-garment.tsx): cada
 * componente exportado montado sozinho no renderizador de teste, em mais de uma variação, reduzido pelo retrato de
 * test-utils/room3d-retrato.ts (árvore, matrizes, geometrias, materiais e o registro de desenho dos canvas), antes e
 * depois de alguns quadros. Também os nomes exportados por cada módulo do lote. Gravado no código original.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { frames, mount3d } from "@/test-utils/three";
import { canvasLog, deterministicRoom, portrait } from "@/test-utils/room3d-retrato";
import * as props from "./room-props";
import * as hung from "./hung-garment";
import * as scene from "./room-scene";
import * as controller from "./room-avatar-controller";
import * as creator from "./wardrobe-creator";
import * as interaction from "@/lib/room3d/interaction";
import * as session from "@/lib/room3d/mirror-session";

beforeAll(() => deterministicRoom());
afterAll(() => { vi.restoreAllMocks(); });

const {
  Label3D, Cobweb, DustPuff, HangTag, GoldDot, EmptyDrawerCharm, DressForm, LightSwitch, RoomWindow, WindowLight, RoomDoor, Lamp, ClosetLights,
  FaiBox, KeyHook, CorkBoard, WallCalendar, TailorTape, Sparkles, FaiMedallion, FaiNeonSign, FaiRug,
} = props;
const at = [0.1, 0.2, 0.3] as [number, number, number];
const milestones = [{ at: 25, label: "25", lit: true }, { at: 50, label: "50", lit: false }, { at: 75, label: "75", lit: true }];
const CASES: Record<string, ReactNode> = {
  label: <><Label3D text="FAI" w={0.2} h={0.1} position={at} /><Label3D text={"duas\nlinhas"} w={0.3} h={0.1} px={512} bg="#111" fg="#eee" font="700 30px Georgia" rotation={[0, 1, 0]} /></>,
  cobweb: <Cobweb w={0.4} h={0.5} />,
  dust: <><DustPuff trigger={0} reduced={false} /><DustPuff trigger={1} reduced={false} /><DustPuff trigger={2} reduced /></>,
  tags: <><HangTag text="R$ 50" /><HangTag text="2ª chance" color="#fde2e4" fg="#9d174d" position={at} w={0.2} /><GoldDot position={at} /></>,
  charm: <EmptyDrawerCharm width={0.3} onAdd={vi.fn()} />,
  bust: <><DressForm position={at} pointAt={null} talking={false} onClick={vi.fn()} reduced={false} /><DressForm position={[1, 0, 1]} pointAt={[0, 1, 0]} talking onClick={vi.fn()} reduced /></>,
  switches: <><LightSwitch position={at} on onToggle={vi.fn()} /><LightSwitch position={at} rotation={[0, 1, 0]} on={false} onToggle={vi.fn()} /></>,
  windows: <>{["morning", "afternoon", "golden", "night", "fixed"].map((p, i) => <RoomWindow key={p} position={[i, 2, 0]} period={p} seasonal={i % 2 ? "christmas" : null} light={i !== 3} />)}</>,
  windowLight: <>{["morning", "night"].map((p) => <WindowLight key={p} position={at} period={p} />)}</>,
  doors: <><RoomDoor position={at} /><RoomDoor position={at} rotation={[0, 1, 0]} onClick={vi.fn()} night /></>,
  lamps: <><Lamp position={at} on /><Lamp position={at} on={false} intensity={0.3} /></>,
  closetLights: <><ClosetLights y={2.6} width={2.4} milestones={milestones} celebrate={false} reduced={false} /><ClosetLights y={2.6} width={1.8} milestones={milestones} celebrate reduced /></>,
  box: <><FaiBox position={at} count={2} opening={false} onOpen={vi.fn()} /><FaiBox position={at} count={0} opening onOpen={vi.fn()} /></>,
  keys: <><KeyHook position={at} keys={[]} onClick={vi.fn()} /><KeyHook position={at} rotation={[0, 1, 0]} keys={[{ username: "bia" }, { username: "leo" }]} onClick={vi.fn()} /></>,
  challenges: <><CorkBoard position={at} polaroids={[{ schemeId: "s1", coverImageUrl: "/media/s1.png" }, { schemeId: "s2" }]} /><CorkBoard position={at} days={4} polaroids={[]} />
    <WallCalendar position={at} days={0} /><WallCalendar position={at} days={12} /><TailorTape width={0.3} position={at} /><TailorTape width={0.2} position={at} rotation={[0, 0, 0.5]} /></>,
  sparkles: <><Sparkles reduced={false} /><Sparkles count={6} radius={0.2} reduced /></>,
  brand: <><FaiMedallion position={at} /><FaiMedallion position={at} radius={0.3} /><FaiNeonSign position={at} /><FaiNeonSign position={at} w={1.2} /><FaiRug position={at} /><FaiRug position={at} radius={0.8} night /></>,
};

const ctx = { highlight: "a", onPick: vi.fn(), reduced: false, tagged: new Set(["b"]), hanger: { color: "#333", metalness: 0.7, roughness: 0.2 } };
const piece = (id: string, category: string, subcategory: string, extra: Partial<hung.HungPiece> = {}): hung.HungPiece =>
  ({ id, name: id, category, subcategory, colorHex: "#336699", imageUrl: `/media/${id}.png`, states: [], ...extra });
const GARMENTS: hung.HungPiece[] = [
  piece("a", "upper_piece", "t_shirt", { states: ["FAVORITA", "30_USOS"] }), piece("b", "upper_piece", "camisa_manga_longa", { salePrice: 40 }),
  piece("c", "upper_piece", "casaco", { states: ["ESQUECIDA", "GARIMPO"] }), piece("d", "full_body_piece", "vestido", { imageUrl: null }),
  piece("e", "lower_piece", "calca_jeans", { colorHex: null }), piece("f", "lower_piece", "saia"), piece("g", "lower_piece", "short"),
];

describe("retrato dos objetos do quarto e da roupa pendurada", () => {
  for (const [name, ui] of Object.entries(CASES)) {
    it(`room-props: ${name}`, async () => {
      const r = await mount3d(<>{ui}</>);
      const before = portrait(r.scene.instance);
      expect(before.lines).toMatchSnapshot("objetos");
      await frames(r, 4);
      expect({ objects: portrait(r.scene.instance).objects, sha: portrait(r.scene.instance).sha }).toMatchSnapshot("depois de 4 quadros");
      await r.unmount();
    }, 60_000);
  }

  it("funções puras de room-props: deg, pointer, croqui por categoria e texto em canvas", () => {
    const draw = (f: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 32; f(c.getContext("2d")!, 64, 32); return canvasLog(c);
    };
    expect({
      deg: props.deg(90), pointer: Object.keys(props.pointer),
      sketch: ["upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"].map((c) => draw(props.sketchDraw(c))),
      text: [draw(props.textTex("FAI")), draw(props.textTex("uma linha bem comprida que passa de trinta letras\nduas", { bg: "#000", fg: "#fff", font: "10px x", align: "left" }))],
    }).toMatchSnapshot();
  });

  it("hung-garment: cada tipo pendurado no varão (x e z), encurtado e balançando; sapato e acessório na prateleira", async () => {
    const r = await mount3d(<>
      {GARMENTS.map((p, i) => <group key={p.id} position={[i * 0.3, 1.2, 0]}><hung.HungGarment p={p} ctx={ctx} along={i % 2 ? "z" : "x"} jitter={hung.hangJitter(p.id)} maxLength={i === 3 ? 0.5 : Infinity} swingKey={i === 0 ? 1 : 0} /></group>)}
      <hung.ShelfPiece p={piece("s", "shoes_piece", "tenis")} ctx={ctx} position={[0, 0.17, 0]} />
      <hung.ShelfPiece p={piece("t", "accessory_piece", "bolsa", { imageUrl: null })} ctx={{ ...ctx, engine: { hidden: new Set(["t"]) } }} position={[0.3, 0.17, 0]} />
      <hung.HungGarment p={piece("h", "upper_piece", "t_shirt")} ctx={{ ...ctx, hangerModel: "/models/hanger.glb", engine: { hidden: new Set(["h"]) } }} />
    </>);
    expect(portrait(r.scene.instance).lines).toMatchSnapshot("objetos");
    await frames(r, 4);
    expect(portrait(r.scene.instance).sha).toMatchSnapshot("depois de 4 quadros");
    await r.unmount();
  }, 60_000);

  it("nomes exportados pelos módulos do lote", () => {
    const names = (m: Record<string, unknown>) => Object.keys(m).sort().map((k) => `${k}:${typeof m[k]}`);
    expect({ props: names(props), hung: names(hung), scene: names(scene), controller: names(controller), creator: names(creator), interaction: names(interaction), session: names(session) }).toMatchSnapshot();
  });
});
