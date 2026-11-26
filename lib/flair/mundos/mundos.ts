/**
 * Os dois mundos exploráveis de MUNDOS.md, desenhados para estes jogos (nenhum mapa copiado de outro jogo). Coordenadas
 * em metros; a escala é a das salas do Fashion Detective (o avatar anda até 3,6 m por passo).
 *
 * Around the World — "Orla do Mirante": uma orla com o calçadão em curva, a praça das bancas e uma subida até o mirante.
 * O farol do mirante é o marco que se vê de toda a orla; a luz âmbar das bancas guia até a praça, a turquesa da escada
 * leva ao mirante, onde fica a vitrine da região (o objetivo). O calçadão e a rua de trás fecham um laço; o ateliê do
 * beco, fora do caminho, guarda uma peça de presente.
 *
 * O Labirinto — "Jardim dos Espelhos": corredores de sebe com espelhos nas esquinas e uma galeria alta em volta do
 * pátio. A fonte do pátio é o marco; a luz violeta marca as esquinas do caminho que chega ao espelho-mestre. Dois
 * corredores se encontram atrás da fonte (o laço) e a galeria alta, pela escada de pedra, mostra o desenho inteiro do
 * jardim e o banco esquecido com a peça escondida.
 */
import type { Mundo } from "@/lib/flair/mundos/mundo";

export const ORLA_DO_MIRANTE: Mundo = {
  id: "ORLA_DO_MIRANTE",
  pontos: [
    { id: "ponto_do_onibus", x: -9, z: 6, camada: 0, guia: "#E8A33A" },
    { id: "calcadao_oeste", x: -6, z: 4, camada: 0, guia: "#E8A33A" },
    { id: "bancas", x: -3, z: 3, camada: 0, guia: "#E8A33A", tipo: "marco" },
    { id: "praca", x: 0, z: 1, camada: 0, guia: "#2BC7B4" },
    { id: "calcadao_leste", x: 3.5, z: 3, camada: 0 },
    { id: "rua_de_tras", x: 1, z: -2.5, camada: 0 },
    { id: "beco", x: -2.5, z: -2, camada: 0 },
    { id: "atelie_do_beco", x: -5, z: -3.5, camada: 0, tipo: "recompensa" },
    { id: "escada_do_morro", x: 3, z: -1, camada: 0, tipo: "escada", guia: "#2BC7B4" },
    { id: "patamar", x: 5, z: -3, camada: 1, guia: "#2BC7B4" },
    { id: "mirante", x: 6.5, z: -5.5, camada: 1, tipo: "objetivo" },
    { id: "farol", x: 8.5, z: -6.5, camada: 1, tipo: "marco" },
  ],
  ligacoes: [
    ["ponto_do_onibus", "calcadao_oeste"], ["calcadao_oeste", "bancas"], ["bancas", "praca"], ["praca", "calcadao_leste"],
    ["praca", "rua_de_tras"], ["rua_de_tras", "calcadao_leste"], ["praca", "beco"], ["beco", "atelie_do_beco"],
    ["praca", "escada_do_morro"], ["calcadao_leste", "escada_do_morro"], ["escada_do_morro", "patamar"], ["patamar", "mirante"],
    ["mirante", "farol"],
  ],
  principal: ["ponto_do_onibus", "calcadao_oeste", "bancas", "praca", "escada_do_morro", "patamar", "mirante"],
};

export const JARDIM_DOS_ESPELHOS: Mundo = {
  id: "JARDIM_DOS_ESPELHOS",
  pontos: [
    { id: "portao", x: 0, z: 7, camada: 0, guia: "#9B6BFF" },
    { id: "esquina_1", x: -3, z: 5, camada: 0, guia: "#9B6BFF" },
    { id: "corredor_oeste", x: -4, z: 1.5, camada: 0, guia: "#9B6BFF" },
    { id: "patio", x: 0, z: 0, camada: 0, tipo: "marco", guia: "#9B6BFF" },
    { id: "corredor_leste", x: 4, z: 1.5, camada: 0 },
    { id: "esquina_2", x: 3, z: 5, camada: 0 },
    { id: "atras_da_fonte", x: 0, z: -3, camada: 0, guia: "#9B6BFF" },
    { id: "espelho_mestre", x: 0, z: -6.5, camada: 0, tipo: "objetivo" },
    { id: "escada_de_pedra", x: -5, z: -2, camada: 0, tipo: "escada" },
    { id: "galeria_oeste", x: -5.5, z: -4.5, camada: 1 },
    { id: "galeria_norte", x: -2, z: -7.5, camada: 1 },
    { id: "banco_esquecido", x: 2, z: -8, camada: 1, tipo: "recompensa" },
  ],
  ligacoes: [
    ["portao", "esquina_1"], ["esquina_1", "corredor_oeste"], ["corredor_oeste", "patio"], ["portao", "esquina_2"],
    ["esquina_2", "corredor_leste"], ["corredor_leste", "patio"], ["patio", "atras_da_fonte"], ["atras_da_fonte", "espelho_mestre"],
    ["corredor_oeste", "escada_de_pedra"], ["escada_de_pedra", "galeria_oeste"], ["galeria_oeste", "galeria_norte"],
    ["galeria_norte", "banco_esquecido"],
  ],
  principal: ["portao", "esquina_1", "corredor_oeste", "patio", "atras_da_fonte", "espelho_mestre"],
};

export const MUNDOS: Record<string, Mundo> = { AROUND_THE_WORLD: ORLA_DO_MIRANTE, LABIRINTO: JARDIM_DOS_ESPELHOS };
