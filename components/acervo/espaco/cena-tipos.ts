/** ACERVO — o que a cena de "Meu espaço" recebe, igual para o 3D e para a reserva 2D. */
import type { VistaDaCena } from "@/lib/acervo/cena/camera";
import type { ItemDoCompartimento } from "@/lib/acervo/cena/roupas";
import type { AcervoIluminacao, AcervoMovel } from "@/lib/acervo/types";

export interface CenaProps {
  moveis: AcervoMovel[];
  /** peças do compartimento (e desejos em simulação, como fantasmas), já com a cor */
  itensDe: (compartimentoId: string) => ItemDoCompartimento[];
  selecionado: string | null;
  /** compartimentos acesos pela busca espacial */
  acesos: Set<string>;
  /** compartimentos com peças paradas (mapa de uso) */
  parados: Set<string>;
  /** números dos marcadores em cada compartimento */
  marcadores: Map<string, number[]>;
  raioX: boolean;
  gavetasAbertas: boolean;
  vista: VistaDaCena;
  /** clique na barra da cena: {@code vez} muda a cada clique; {@code giro} em graus (0 = voltar ao enquadramento da vista) */
  comandoDeCamera?: { vez: number; giro: number };
  reduzido: boolean;
  rotulo: string;
  /** luz do ambiente confirmada pelo GET (exercício 07); ausente = luz padrão */
  iluminacao?: AcervoIluminacao | null;
  onEscolher: (compartimentoId: string) => void;
  onSoltar: (pieceIds: string[], compartimentoId: string) => void;
  onPeca: (pieceId: string) => void;
}
