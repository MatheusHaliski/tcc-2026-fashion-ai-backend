/**
 * Avatares de uma partida solo (seção "Os avatares de cada partida"): a protagonista (PROPRIO ou MODELO_CASA) e os
 * figurantes do arquivo do núcleo, agrupados por papel, no formato da API `avatares.solo`.
 */
import type { AvatarSolo, AvatarTipo, NucleoAvatares, NucleoConfig } from "@/lib/flair/nucleos/types";

export function avataresDoNucleo(config: NucleoConfig): NucleoAvatares {
  // entradas com o mesmo papel são alternativas (PROPRIO ou MODELO_CASA como protagonista), como na API
  const protagonistas = config.avatares.protagonista.map((tipo): AvatarSolo => ({ tipo, papel: "PROTAGONISTA", quantidade: 1 }));
  const porPapel = new Map<string, number>();
  for (const p of config.personagens) porPapel.set(p.papel, (porPapel.get(p.papel) ?? 0) + 1);
  const figurantes = Array.from(porPapel, ([papel, quantidade]): AvatarSolo => ({ tipo: "FIGURANTE", papel, quantidade }));
  return { solo: [...protagonistas, ...figurantes], online: config.avatares.online };
}

/**
 * Quem a pessoa vê como protagonista: o avatar do perfil quando o núcleo aceita PROPRIO, ela escolheu e ele existe;
 * senão, a modelo da casa.
 */
export function protagonistaEfetiva(aceitos: AvatarTipo[], escolha: AvatarTipo | null, temAvatar: boolean): AvatarTipo {
  const quer = escolha && aceitos.includes(escolha) ? escolha : aceitos[0];
  return quer === "PROPRIO" && temAvatar ? "PROPRIO" : "MODELO_CASA";
}

/**
 * Avatares mostrados para a sala da vez: quando a sala tem elenco próprio (3 contra 3 no basquete, dupla no vôlei, um
 * adversário no tênis), a contagem de figurantes sai dele, não da lista fixa do jogo ("4 colegas · 5 adversários").
 */
export function avataresDaSala(avatares: NucleoAvatares, elenco?: { papel: string }[] | null): NucleoAvatares {
  if (!elenco) return avatares;
  const porPapel = new Map<string, number>();
  for (const p of elenco) porPapel.set(p.papel, (porPapel.get(p.papel) ?? 0) + 1);
  const figurantes = Array.from(porPapel, ([papel, quantidade]): AvatarSolo => ({ tipo: "FIGURANTE", papel, quantidade }));
  return { ...avatares, solo: [...avatares.solo.filter((a) => a.tipo !== "FIGURANTE"), ...figurantes] };
}
