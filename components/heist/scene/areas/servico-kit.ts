/*
 * MET Gala Heist v2 — ferramentas da área de serviço (bastidores Z11, labirinto de serviço e copa Z10, sala de segurança
 * Z09), usadas pelos módulos dela. Este arquivo é a fachada do kit: reexporta, com os mesmos nomes, o que cada parte
 * faz no próprio arquivo:
 *  - servico-kit-pbr.ts: ruído e superfícies PBR próprias (azulejo, cerâmica, granilite, forros, drywall, vinílico,
 *    pintura da segurança, piso de palco e parede preta dos bastidores);
 *  - servico-kit-mats.ts: cache de materiais da área, material PBR e a paleta `SM`;
 *  - servico-kit-frame.ts: o referencial local (Fr) para montar móveis em lotes e instâncias, e as geometrias dele;
 *  - servico-maze.ts: faces de parede, quinas e vãos de piso do labirinto lidos da grade do mundo;
 *  - servico-text.ts: os textos da área nos três idiomas do cenário;
 *  - servico-signs.ts: o atlas das placas (um material só para toda a sinalização) e as placas parafusadas.
 * Chaves de cache sempre com o prefixo da área ("srv-", "bk-", "seg-").
 */
export * from "./servico-kit-pbr";
export * from "./servico-kit-mats";
export * from "./servico-kit-frame";
export * from "./servico-maze";
export * from "./servico-text";
export * from "./servico-signs";
