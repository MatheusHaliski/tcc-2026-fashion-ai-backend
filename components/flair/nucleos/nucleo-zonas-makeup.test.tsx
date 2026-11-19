// @vitest-environment jsdom
/**
 * Auditoria dos jogos de zonas e do MAKE UP (19/11): o resultado explica a nota (zonas sem pintar, a peça que derrubou a
 * regra de "todas as peças", a soma que passou de 100), o final é o da rodada jogada e o Road to Glory tem a sessão de
 * fotos como jogada de carta.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NucleoResult } from "@/components/flair/nucleos/nucleo-result";
import { acionamentoDe } from "@/lib/flair/nucleos/moments";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";
import { NucleoGame } from "@/components/flair/nucleos/nucleo-game";
import { CARTAS, definicao } from "@/test-utils/flair-nucleos";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

afterEach(cleanup);

const resultado = (r: Partial<NucleoResultado>): NucleoResultado => ({ pontos: 0, estrelas: 0, resultado: "REPROVADO", regras: [], eventos: [], status: "ENTREGUE", ...r } as NucleoResultado);

describe("resultado dos jogos de zonas", () => {
  it("peça pela metade: o resultado diz quantas zonas faltaram e por que as regras do conjunto não valeram", () => {
    const r = resultado({ pontos: 50, regras: [{ codigo: "CAPA_ESCURA", ok: true, pontos: 25 }, { codigo: "ATE_2_CORES", ok: false, pontos: 0 }], eventos: [{ codigo: "ZONAS_SEM_PINTAR", valor: { faltam: 2, total: 4 } }] });
    renderApp(<NucleoResult codigo="SUPER_HEROI" rodada="VIGILANTE_DA_NOITE" resultado={r} onAgain={vi.fn()} />);
    const texto = screen.getByTestId("nucleo-result").textContent ?? "";
    expect(texto).toContain("Faltou pintar 2 de 4 zonas: as regras da peça inteira");
    expect(texto).toContain("Vigilante da noite");
    expect(texto).not.toContain("{");
  });

  it("o final é o da rodada: o Tênis dos Sonhos não fala de capacete, nem a Jaqueta da Banda de era", () => {
    const bom = resultado({ pontos: 100, estrelas: 3, resultado: "APROVADO" });
    const tenis = renderApp(<NucleoResult codigo="PILOTO_FAVORITO" rodada="TENIS_DOS_SONHOS" resultado={bom} onAgain={vi.fn()} />);
    expect(screen.getByTestId("nucleo-desfecho").textContent).toBe("O tênis brilha na corrida da noite: dá para ver o piloto de longe.");
    tenis.unmount();
    const capacete = renderApp(<NucleoResult codigo="PILOTO_FAVORITO" rodada="EQUIPE_AURORA" resultado={bom} onAgain={vi.fn()} />);
    expect(screen.getByTestId("nucleo-desfecho").textContent).toContain("capacete");
    capacete.unmount();
    const jaqueta = renderApp(<NucleoResult codigo="FAVORITE_SINGER" rodada="JAQUETA_DA_BANDA" resultado={resultado({})} onAgain={vi.fn()} />);
    expect(screen.getByTestId("nucleo-desfecho").textContent).toContain("A banda pede outra jaqueta");
    jaqueta.unmount();
    renderApp(<NucleoResult codigo="CLUBE_CORACAO" rodada="UNIFORME_ESPORTS" resultado={bom} onAgain={vi.fn()} />);
    expect(screen.getByTestId("nucleo-desfecho").textContent).toContain("Vórtex");
  });
});

describe("resultado do Road to Glory", () => {
  it("diz qual peça derrubou a regra da ocasião, dá a dica e explica a soma acima de 100", () => {
    const r = resultado({
      pontos: 50,
      regras: [{ codigo: "OCASIAO", ok: false, pontos: 0 }, { codigo: "BATOM_CORAL", ok: true, pontos: 25 }],
      eventos: [{ codigo: "PECA_FORA_DA_OCASIAO", valor: { vaga: "CAL" } }, { codigo: "PECA_NAO_LEVE", valor: { vaga: "CAL" } }],
    });
    const fora = renderApp(<NucleoResult codigo="ROAD_TO_GLORY" rodada="ENSAIO_VERAO" resultado={r} onAgain={vi.fn()} />);
    const texto = screen.getByTestId("nucleo-result").textContent ?? "";
    expect(texto).toContain("A peça em “Calçado” não é da ocasião do brief");
    expect(texto).toContain("A peça em “Calçado” não é de material leve");
    expect(screen.getByTestId("nucleo-result-hints").textContent).toContain("Vista só peças da ocasião do brief");
    fora.unmount();
    const cheio = resultado({ pontos: 100, estrelas: 3, resultado: "APROVADO", regras: [{ codigo: "OCASIAO", ok: true, pontos: 25 }, { codigo: "JOGADA_DE_CENA", ok: true, pontos: 10 }], eventos: [{ codigo: "TETO", valor: { soma: 110 } }] });
    renderApp(<NucleoResult codigo="ROAD_TO_GLORY" rodada="ENSAIO_VERAO" resultado={cheio} onAgain={vi.fn()} />);
    expect(screen.getByTestId("nucleo-result").textContent).toContain("As regras somam 110 pontos; a nota máxima é 100.");
    expect(screen.getByTestId("nucleo-desfecho").textContent).toBe("A sessão vira capa: o look e a luz bateram com o brief.");
  });

  it("sessão de fotos na tela: a fotógrafa pede a luz e a carta fora do look acende a cor dela", async () => {
    const onAcionar = vi.fn();
    loggedAs(ME, { "POST /api/flair/3d/nucleos/ROAD_TO_GLORY/efeitos": { efeitos: [{ cardId: "c2", itens: [{ codigo: "SEM_BONUS", valor: 0, motivo: true }, { codigo: "COR_LUZ_FRIA", valor: 4 }] }] } });
    const pede: NucleoResultado = resultado({ resultado: "EM_ACAO", status: "EM_ACAO", eventos: [{ codigo: "PEDIDO_DE_CENA", valor: { familia: "Azul", acao: "LUZ_FRIA" } }] });
    renderApp(<NucleoGame definicao={definicao("ROAD_TO_GLORY")} cartas={CARTAS} entregando={false} erro={null} momento="ACAO" resultado={pede} onEntregar={vi.fn()} onAcionar={onAcionar} />);
    const jogada = screen.getByTestId("nucleo-trigger");
    await waitFor(() => expect(within(jogada).getByRole("status").textContent).toMatch(/^A cena pede .+: uma carta azul soma 10\. Outra cor só faz a cena\.$/), { timeout: 6000 });
    fireEvent.click(await within(jogada).findByRole("button", { name: /^Jogar Calça linho: / }));
    expect(onAcionar).toHaveBeenCalledWith({ tipo: "JOGADA", cardId: "c2" });
  }, 10000);

  it("a sessão de fotos é uma jogada de carta durante a ação", () => {
    expect(acionamentoDe("ROAD_TO_GLORY")).toEqual({ tipo: "JOGADA", momento: "ACAO" });
    for (const zonas of ["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"] as const) expect(acionamentoDe(zonas)).toBeNull();
  });
});
