import { describe, expect, it, vi } from "vitest";
import { devolverFoto, facesComFoto, fotosGuardadas, MAX_FOTOS, pedirFoto, type CarregadorDeFoto } from "./fotos";

const canvas = () => ({ width: 128, height: 128 }) as HTMLCanvasElement;

describe("fotos das peças na cena 3D", () => {
  it("a foto vai nas faces grandes de cada forma", () => {
    expect(facesComFoto("pendurada")).toEqual([true, true, false, false, false, false]);
    expect(facesComFoto("dobrada")).toEqual([false, false, true, false, false, false]);
    expect(facesComFoto("calcado")).toEqual([true, true, true, false, false, false]);
  });

  it("a mesma foto é carregada uma vez, compartilhada e descartada quando ninguém mais usa", async () => {
    const carregar = vi.fn<CarregadorDeFoto>(async () => canvas());
    const a = pedirFoto("/f/1.webp", carregar)!;
    const b = pedirFoto("/f/1.webp", carregar)!;
    expect(carregar).toHaveBeenCalledTimes(1);
    const textura = await a;
    expect(await b).toBe(textura);
    expect(textura?.generateMipmaps).toBe(false);
    const descarte = vi.spyOn(textura!, "dispose");
    devolverFoto("/f/1.webp");
    await Promise.resolve();
    expect(descarte).not.toHaveBeenCalled();
    devolverFoto("/f/1.webp");
    await new Promise((fim) => setTimeout(fim, 0));
    expect(descarte).toHaveBeenCalledTimes(1);
    expect(fotosGuardadas()).toBe(0);
  });

  it("foto que não carrega fica null (a peça segue com a cor) e o limite de fotos guardadas é respeitado", async () => {
    expect(await pedirFoto("/f/quebrada.webp", async () => null)).toBeNull();
    devolverFoto("/f/quebrada.webp");
    const urls = Array.from({ length: MAX_FOTOS }, (_, i) => `/f/${i}.webp`);
    for (const url of urls) expect(pedirFoto(url, async () => canvas())).not.toBeNull();
    expect(pedirFoto("/f/mais-uma.webp", async () => canvas())).toBeNull();
    expect(pedirFoto(urls[0], async () => canvas())).not.toBeNull();
    devolverFoto(urls[0]);
    for (const url of urls) devolverFoto(url);
    expect(fotosGuardadas()).toBe(0);
  });
});
