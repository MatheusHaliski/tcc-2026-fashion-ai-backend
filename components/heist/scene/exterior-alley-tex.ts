/*
 * MET Gala Heist v2 — beco (Z15): texturas procedurais próprias da área, desenhadas no navegador (nenhuma imagem baixada)
 * e guardadas com a chave "beco-…" (não se misturam com as da rua, que são de outro módulo):
 *
 *  - asfalto velho do beco: oxidado (cinza claro), agregado aparente, rede de trincas finas, couro de jacaré num trecho,
 *    trincas seladas com piche (riscos pretos e brilhantes) e manchas de óleo — ladrilho de 4 m;
 *  - remendo de asfalto novo (mais escuro e liso, borda serrada) e o concreto gasto da canaleta central;
 *  - tijolo aparente velho do prédio vizinho: tijolos queimados de tons diferentes, juntas gastas e fundas, tijolos
 *    trocados, fuligem — ladrilho de 2,4 m;
 *  - folha de decalques das paredes: pichações e grafites de nomes inventados, reboco descascado, lambe-lambes de eventos
 *    fictícios, escorridos de ferrugem e de água, fuligem do exaustor, a pintura "PROIBIDO JOGAR LIXO" e o número da casa;
 *  - folha de decalques do chão: panfletos, folhas, papelão, jornal, manchas de óleo, marca de pneu, chiclete, e a faixa
 *    de sujeira do pé da parede (areia, lodo, folhas);
 *  - poças (forma recortada com borda molhada e película de óleo furta-cor), grade de ferro, mato das frestas, bituca,
 *    tampa de bueiro, interiores das janelas acesas e as placas.
 *
 * Mapas em escala de mundo: `meters` é o tamanho que a textura cobre (a geometria usa UV em metros, repeat = 1/meters).
 * Cor em sRGB; normal e ORM (R oclusão, G rugosidade, B metal) lineares. Tudo gerado uma vez por qualidade.
 *
 * Este módulo é a fachada das texturas do beco: reexporta o que as outras peças usam. O desenho fica em
 * exterior-alley-tex-noise (ruído e cache), -canvas (canvas → textura, PBR), -pbr (chão e paredes), -atlas (folhas e
 * traços), -decals (paredes, chão, poças), -signs (janelas e placas) e -props (texturas pequenas dos objetos).
 */
export { rng, type Quality } from "./exterior-alley-tex-noise";
export type { PbrSet } from "./exterior-alley-tex-canvas";
export { alleyAsphalt, alleyBrick, alleyConcrete, alleyPaintedConcrete, alleyPatch } from "./exterior-alley-tex-pbr";
export type { Atlas, Rect01 } from "./exterior-alley-tex-atlas";
export { groundDecals, puddleAtlas, wallDecals } from "./exterior-alley-tex-decals";
export { alleySigns, windowInteriors } from "./exterior-alley-tex-signs";
export { alleyGlow, buttTex, cardboardTex, fabricTex, manholeTex, meshAlpha, weedTex, woodTex } from "./exterior-alley-tex-props";
