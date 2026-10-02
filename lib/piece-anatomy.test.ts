import { describe, expect, test } from "vitest";
import { PIECE_ANATOMY_IDS, costPerUse, effectivePieceAnatomy, pieceAnatomyOf } from "./piece-anatomy";

const owner = { canEdit: true, liked: false, reactions: [], saved: false, following: false };
const visitor = { ...owner, canEdit: false };

describe("layout das peças (seção C) gravado no look", () => {
  test("anatomia conhecida em background.pieces.anatomy é devolvida (formato salvo pelo backend e o da prévia)", () => {
    expect(pieceAnatomyOf({ background: { scheme: { layoutAnatomy: "LISTA_VERTICAL" }, pieces: { anatomy: "ETIQUETA", sealPlacement: "HEADER" } } })).toBe("ETIQUETA");
    expect(pieceAnatomyOf({ background: { color: "#fff", photo: { url: null }, pieces: { anatomy: "LEGO" } } })).toBe("LEGO");
    for (const id of PIECE_ANATOMY_IDS) expect(pieceAnatomyOf({ background: { pieces: { anatomy: id } } })).toBe(id);
  });
  test("desconhecida ou com tipo errado cai na Peça ampliada", () => {
    expect(pieceAnatomyOf({ background: { pieces: { anatomy: "SILHUETA_PROPORCAO" } } })).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf({ background: { pieces: { anatomy: "etiqueta" } } })).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf({ background: { pieces: { anatomy: 3 } } })).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf({ background: { pieces: "ETIQUETA" } })).toBe("PECA_AMPLIADO");
  });
  test("sem background (ou sem a chave pieces) usa o padrão", () => {
    expect(pieceAnatomyOf({})).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf({ background: undefined })).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf({ background: { scheme: { color: "#000" } } })).toBe("PECA_AMPLIADO");
    expect(pieceAnatomyOf(null)).toBe("PECA_AMPLIADO");
  });
});

describe("anatomia de peça que o card mostra", () => {
  test("Custo por uso (dado pessoal) só para quem é dono do look", () => {
    const bg = { pieces: { anatomy: "CUSTO_POR_USO" } };
    expect(effectivePieceAnatomy({ background: bg, viewer: owner })).toBe("CUSTO_POR_USO");
    expect(effectivePieceAnatomy({ background: bg, viewer: visitor })).toBe("PECA_AMPLIADO");
  });
  test("as demais anatomias valem para qualquer pessoa", () => {
    expect(effectivePieceAnatomy({ background: { pieces: { anatomy: "RAIO_X" } }, viewer: visitor })).toBe("RAIO_X");
  });
  test("custo por uso = preço ÷ usos, contando ao menos 1 uso; sem preço não há valor", () => {
    expect(costPerUse(200, 8)).toBe(25);
    expect(costPerUse(199.9, 0)).toBe(199.9);
    expect(costPerUse(50, undefined)).toBe(50);
    expect(costPerUse(null, 4)).toBeNull();
  });
});
