import { describe, expect, it } from "vitest";
import { groupOf, groupRack, latestWins, mirrorLook3d, rackState, type MirrorRackPiece } from "./mirror-list";

const P = (id: string, slot: string, category: string, subcategory: string, extra: Partial<MirrorRackPiece> = {}): MirrorRackPiece =>
  ({ id, name: id, slot, category, subcategory, imageUrl: `/media/${id}.png`, ...extra });

describe("lista do espelho (QUARTO-ESPELHO)", () => {
  it("quatro lugares: cima, baixo, calçado, acessório (vestido e casaco em cima)", () => {
    expect(groupOf({ slot: "upper" })).toBe("cima");
    expect(groupOf({ slot: "outer_layer" })).toBe("cima");
    expect(groupOf({ slot: "dress" })).toBe("cima");
    expect(groupOf({ slot: "lower" })).toBe("baixo");
    expect(groupOf({ slot: "shoes" })).toBe("calcado");
    expect(groupOf({ slot: "accessory" })).toBe("acessorio");
    expect(groupOf({ category: "lower_piece" })).toBe("baixo");
    const g = groupRack([P("t", "upper", "upper_piece", "t_shirt"), P("j", "lower", "lower_piece", "jeans"), P("s", "shoes", "shoes_piece", "sneakers"), P("b", "accessory", "accessory_piece", "crossbody_bag")]);
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((p) => p.id)]))).toEqual({ cima: ["t"], baixo: ["j"], calcado: ["s"], acessorio: ["b"] });
  });

  it("vai para o 3D no formato do provador: foto recortada, processada, modelagem e dimensões", () => {
    const l = mirrorLook3d(P("j", "lower", "lower_piece", "jeans", { studioImageUrl: "/media/j-studio.jpg", variation: "STRAIGHT", attributes: { LENGTH: ["FULL_LENGTH"] } }));
    expect(l).toMatchObject({ id: "j", slot: "lower", imageUrl: "/media/j.png", studioUrl: "/media/j-studio.jpg", variation: "STRAIGHT", attributes: { LENGTH: ["FULL_LENGTH"] } });
  });

  it("estado na lista: 3D estimado, só 2D (acessório) ou sem foto", () => {
    expect(rackState(P("t", "upper", "upper_piece", "t_shirt"))).toBe("ESTIMADA");
    expect(rackState(P("b", "accessory", "accessory_piece", "crossbody_bag"))).toBe("SEM_3D");
    expect(rackState(P("t", "upper", "upper_piece", "t_shirt", { imageUrl: null }))).toBe("ESTIMADA");
  });

  it("trocas rápidas: só a última escolha conclui, as do meio são descartadas", async () => {
    const done: string[] = []; let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const q = latestWins<string>(async (id) => { if (id === "a") await gate; done.push(id); });
    const first = q.request("a");
    q.request("b"); q.request("c"); q.request("d");    // chegam enquanto "a" está em andamento
    expect(q.pending).toBe("d");
    release(); await first;
    expect(done).toEqual(["a", "d"]);
  });

  it("troca que falha não trava as próximas", async () => {
    const done: string[] = [];
    const q = latestWins<string>(async (id) => { if (id === "x") throw new Error("rede"); done.push(id); });
    await expect(q.request("x")).rejects.toThrow("rede");
    await q.request("y");
    expect(done).toEqual(["y"]);
  });
});
