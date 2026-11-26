/** ACERVO — tipos espelhando /api/me/acervo (AcervoViews.java). */
export type AcervoModo = "MEU_ESPACO" | "DREAM_SPACE";
export type AcervoTipo = "CABIDEIRO" | "PRATELEIRA" | "GAVETA";
export type AcervoMaterial = "MADEIRA" | "LACA" | "VIDRO" | "METAL";
export type AcervoCor = "NOGUEIRA" | "CARVALHO" | "FREIJO" | "EBANO" | "MARFIM" | "AREIA" | "GRAFITE" | "BRANCO";
export type AcervoPorta = "SEM_PORTA" | "ABRIR" | "CORRER" | "VIDRO";
export type AcervoPuxador = "BARRA" | "BOTAO" | "CAVA" | "SEM_PUXADOR";
export type AcervoAcabamento = "LATAO" | "GRAFITE" | "CROMADO" | "PRETO";

export interface AcervoCompartimento {
  id: string;
  movelId: string;
  tipo: AcervoTipo;
  nome: string;
  ordem: number;
  pecas: number;
}

/** Lugar de uma peça para outras telas: `compartimentoId` é o endereço estável; os nomes são os atuais. */
export interface AcervoLugarDaPeca {
  pieceId: string;
  guardada: boolean;
  compartimentoId: string | null;
  movelId: string | null;
  ambienteId: string | null;
  tipo: AcervoTipo | null;
  compartimento: string | null;
  movel: string | null;
  ambiente: string | null;
  caminho: string | null;
}

export interface AcervoMovelConfig {
  modo: AcervoModo;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
  material: AcervoMaterial;
  cor: AcervoCor;
  porta: AcervoPorta;
  puxador: AcervoPuxador;
  puxadorAcabamento: AcervoAcabamento;
}

export interface AcervoMovel extends AcervoMovelConfig {
  id: string;
  ambienteId: string;
  nome: string;
  ordem: number;
  compartimentos: AcervoCompartimento[];
  pecas: number;
}

/** Exercício 07: luz do ambiente; tipo e kelvin nulos = ambiente legado, sem classificação (a cena usa a luz padrão). */
export interface AcervoIluminacao {
  tipo: { id: string; codigo: string; nome: string } | null;
  temperaturaKelvin: number | null;
}

/** PUT da luz: ID/kelvin nulos mantêm o atual; limpar* apaga (os dois juntos com valor são recusados com 400). */
export interface AcervoLuzForm {
  tipoIluminacaoId: string | null;
  temperaturaKelvin: number | null;
  limparTipo: boolean;
  limparTemperatura: boolean;
}

export interface AcervoAmbiente {
  id: string;
  nome: string;
  ordem: number;
  moveis: AcervoMovel[];
  pecas: number;
  /** ausente em respostas antigas: tratar como sem luz definida */
  iluminacao?: AcervoIluminacao | null;
}

export interface AcervoMedidas {
  larguraCm: number | null;
  comprimentoCm: number | null;
  nota: string | null;
}

export interface AcervoPeca {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  color: string | null;
  size: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  conservacao: string | null;
  thumbnailUrl: string | null;
  favorite: boolean;
  wearCount: number;
  lastWornDate: string | null;
  emUso: boolean;
  compartimentoId: string | null;
  caminho: string | null;
  medidas: AcervoMedidas;
}

export interface AcervoArvore {
  ambientes: AcervoAmbiente[];
  pecas: AcervoPeca[];
  total: number;
  semLugar: number;
}

export interface AcervoDesejo {
  id: string;
  nome: string;
  categoria: string;
  cor: string | null;
  tamanho: string | null;
  marca: string | null;
  precoEstimado: number | null;
  moeda: string;
  estimado: true;
  compartimentoId: string | null;
  caminho: string | null;
}

export interface AcervoDesejoForm {
  nome: string;
  categoria: string;
  cor?: string | null;
  tamanho?: string | null;
  marca?: string | null;
  precoEstimado?: number | null;
  compartimentoId?: string | null;
}

export interface AcervoSoma {
  valor: number;
  pecasComPreco: number;
  pecasSemPreco: number;
  pecasOutraMoeda: number;
  totalPecas: number;
}

export interface AcervoFinanceiro extends AcervoSoma {
  moeda: string;
  grupos: { grupo: "ROUPAS" | "CALCADOS" | "ACESSORIOS" | "OUTROS"; pecas: number; valor: number }[];
  selecao: AcervoSoma;
  desejos: { valor: number; itens: number; semPreco: number; outraMoeda: number; estimado: true };
  custoPorUso: { valor: number; pecas: number; usos: number } | null;
}

export interface AcervoBusca {
  termos: string[];
  pecas: AcervoPeca[];
  compartimentos: { id: string; caminho: string | null; pecas: number }[];
  semLugar: number;
}

export interface AcervoUso {
  dias: number;
  pecas: { id: string; diasSemUso: number | null; nuncaUsada: boolean; esquecida: boolean; semLook: boolean }[];
  compartimentos: { id: string; pecas: number; esquecidas: number; nuncaUsadas: number }[];
}

export interface AcervoLugar {
  compartimentoId: string | null;
  caminho: string | null;
}

export interface AcervoMovimento {
  pieceId: string;
  name: string;
  thumbnailUrl: string | null;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  de: AcervoLugar;
  para: AcervoLugar;
  motivo: string;
}

export interface AcervoPrevia {
  movimentos: AcervoMovimento[];
  semDestino: string[];
  analisadas: number;
}

export interface AcervoLook {
  id: string;
  title: string;
  itens: { pieceId: string; name: string; thumbnailUrl: string | null; category?: string | null; subcategory?: string | null; color?: string | null; minha: boolean; compartimentoId: string | null; caminho: string | null }[];
}

export type AcervoMovelForm = Partial<AcervoMovelConfig> & { nome?: string; cabideiros?: number; prateleiras?: number; gavetas?: number };
