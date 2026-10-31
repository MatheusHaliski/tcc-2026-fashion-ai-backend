/*
 * MET Gala Heist v2 — textos DIEGÉTICOS do beco (placas, pichações, panfletos, etiquetas, o totem de embarque),
 * desenhados nas folhas de exterior-alley-tex.ts no idioma da cena. Assinaturas de pichação (NOX, VULTO, TRAMA, LUME,
 * ZUMBA) e nomes próprios não mudam. O varredor de i18n ignora *-copy.ts.
 */
import type { SceneLocale } from "./interior-copy";

export interface AlleyCopy {
  olhoVivo: string;
  cartazNaoRetirar: string;
  proibido: string;
  jogarLixo: string;
  gas: string;
  glp: string;
  perigoInflamavel: string;
  naoFume: string;
  amanha: string;
  baile: string;
  sabado23h: string;
  entradaFranca: string;
  doBeco: string;
  entrega24h: string;
  n2Por1: string;
  alugaSe: string;
  salao: string;
  conviteNaoTransferivel: string;
  cidade: string;
  fragil: string;
  aguasPluviais: string;
  embarque: string;
  motoristas: string;
  credenciados: string;
  saidaDe: string;
  funcionarios: string;
  apos01h00: string;
  museuVesper: string;
  entradaDeServico: string;
  pelaDocaAvVesper: string;
  obrigado: string;
  saida: string;
  deEmergencia: string;
  garagem: string;
  naoEstacione24Horas: string;
  propriedade: string;
  particular: string;
  naoEntreCaesSoltos: string;
  sorria: string;
  voceEsta: string;
  sendo: string;
  filmado: string;
  inflamavel: string;
  becoAcessoRestrito: string;
  proibidoEstacionar: string;
  coleta: string;
  proibidoDepositarEntulho: string;
  conteinerNo0417: string;
  cozinhaToqueACampainha: string;
  peso18Kg: string;
  lote0412: string;
}

export const ALLEY_COPY: Record<SceneLocale, AlleyCopy> = {
  "pt-BR": {
    olhoVivo: "OLHO VIVO",
    cartazNaoRetirar: "CARTAZ · NÃO RETIRAR",
    proibido: "PROIBIDO",
    jogarLixo: "JOGAR LIXO",
    gas: "GÁS",
    glp: "GLP",
    perigoInflamavel: "PERIGO · INFLAMÁVEL",
    naoFume: "NÃO FUME",
    amanha: "AMANHÃ",
    baile: "BAILE",
    sabado23h: "SÁBADO · 23H",
    entradaFranca: "ENTRADA FRANCA",
    doBeco: "DO BECO",
    entrega24h: "ENTREGA 24H",
    n2Por1: "2 POR 1",
    alugaSe: "ALUGA-SE",
    salao: "SALÃO",
    conviteNaoTransferivel: "CONVITE · NÃO TRANSFERÍVEL",
    cidade: "CIDADE",
    fragil: "FRÁGIL",
    aguasPluviais: "ÁGUAS PLUVIAIS",
    embarque: "EMBARQUE",
    motoristas: "MOTORISTAS",
    credenciados: "CREDENCIADOS",
    saidaDe: "SAÍDA DE",
    funcionarios: "FUNCIONÁRIOS",
    apos01h00: "APÓS 01H00",
    museuVesper: "MUSEU VESPER",
    entradaDeServico: "ENTRADA DE SERVIÇO",
    pelaDocaAvVesper: "PELA DOCA · AV. VESPER",
    obrigado: "OBRIGADO",
    saida: "SAÍDA",
    deEmergencia: "DE EMERGÊNCIA",
    garagem: "GARAGEM",
    naoEstacione24Horas: "NÃO ESTACIONE · 24 HORAS",
    propriedade: "PROPRIEDADE",
    particular: "PARTICULAR",
    naoEntreCaesSoltos: "NÃO ENTRE · CÃES SOLTOS",
    sorria: "SORRIA,",
    voceEsta: "VOCÊ ESTÁ",
    sendo: "SENDO",
    filmado: "FILMADO",
    inflamavel: "INFLAMÁVEL",
    becoAcessoRestrito: "BECO · ACESSO RESTRITO",
    proibidoEstacionar: "PROIBIDO ESTACIONAR",
    coleta: "COLETA",
    proibidoDepositarEntulho: "PROIBIDO DEPOSITAR ENTULHO",
    conteinerNo0417: "CONTÊINER Nº 0417",
    cozinhaToqueACampainha: "COZINHA · TOQUE A CAMPAINHA",
    peso18Kg: "PESO 18 kg",
    lote0412: "LOTE 0412",
  },
  "en": {
    olhoVivo: "EYES OPEN",
    cartazNaoRetirar: "POSTER · DO NOT REMOVE",
    proibido: "NO",
    jogarLixo: "DUMPING",
    gas: "GAS",
    glp: "LPG",
    perigoInflamavel: "DANGER · FLAMMABLE",
    naoFume: "NO SMOKING",
    amanha: "TOMORROW",
    baile: "DANCE",
    sabado23h: "SATURDAY · 11 PM",
    entradaFranca: "FREE ENTRY",
    doBeco: "ALLEY",
    entrega24h: "24H DELIVERY",
    n2Por1: "2 FOR 1",
    alugaSe: "FOR RENT",
    salao: "HALL",
    conviteNaoTransferivel: "INVITATION · NON-TRANSFERABLE",
    cidade: "CITY",
    fragil: "FRAGILE",
    aguasPluviais: "STORM WATER",
    embarque: "PICK-UP",
    motoristas: "DRIVERS",
    credenciados: "ACCREDITED",
    saidaDe: "STAFF",
    funcionarios: "EXIT",
    apos01h00: "AFTER 1:00 AM",
    museuVesper: "VESPER MUSEUM",
    entradaDeServico: "SERVICE ENTRANCE",
    pelaDocaAvVesper: "VIA THE DOCK · VESPER AVE.",
    obrigado: "THANK YOU",
    saida: "EMERGENCY",
    deEmergencia: "EXIT",
    garagem: "GARAGE",
    naoEstacione24Horas: "DO NOT PARK · 24 HOURS",
    propriedade: "PRIVATE",
    particular: "PROPERTY",
    naoEntreCaesSoltos: "KEEP OUT · LOOSE DOGS",
    sorria: "SMILE,",
    voceEsta: "YOU ARE",
    sendo: "BEING",
    filmado: "FILMED",
    inflamavel: "FLAMMABLE",
    becoAcessoRestrito: "ALLEY · RESTRICTED ACCESS",
    proibidoEstacionar: "NO PARKING",
    coleta: "WASTE",
    proibidoDepositarEntulho: "NO RUBBLE DUMPING",
    conteinerNo0417: "CONTAINER No. 0417",
    cozinhaToqueACampainha: "KITCHEN · RING THE BELL",
    peso18Kg: "WEIGHT 18 kg",
    lote0412: "BATCH 0412",
  },
  "es": {
    olhoVivo: "OJO VIVO",
    cartazNaoRetirar: "CARTEL · NO RETIRAR",
    proibido: "PROHIBIDO",
    jogarLixo: "TIRAR BASURA",
    gas: "GAS",
    glp: "GLP",
    perigoInflamavel: "PELIGRO · INFLAMABLE",
    naoFume: "NO FUME",
    amanha: "MAÑANA",
    baile: "BAILE",
    sabado23h: "SÁBADO · 23H",
    entradaFranca: "ENTRADA LIBRE",
    doBeco: "DEL CALLEJÓN",
    entrega24h: "ENTREGA 24H",
    n2Por1: "2 POR 1",
    alugaSe: "SE ALQUILA",
    salao: "SALÓN",
    conviteNaoTransferivel: "INVITACIÓN · INTRANSFERIBLE",
    cidade: "CIUDAD",
    fragil: "FRÁGIL",
    aguasPluviais: "AGUAS PLUVIALES",
    embarque: "EMBARQUE",
    motoristas: "CONDUCTORES",
    credenciados: "ACREDITADOS",
    saidaDe: "SALIDA DE",
    funcionarios: "PERSONAL",
    apos01h00: "DESPUÉS DE LA 01H00",
    museuVesper: "MUSEO VESPER",
    entradaDeServico: "ENTRADA DE SERVICIO",
    pelaDocaAvVesper: "POR EL MUELLE · AV. VESPER",
    obrigado: "GRACIAS",
    saida: "SALIDA",
    deEmergencia: "DE EMERGENCIA",
    garagem: "GARAJE",
    naoEstacione24Horas: "NO ESTACIONE · 24 HORAS",
    propriedade: "PROPIEDAD",
    particular: "PRIVADA",
    naoEntreCaesSoltos: "NO ENTRE · PERROS SUELTOS",
    sorria: "SONRÍA,",
    voceEsta: "USTED ESTÁ",
    sendo: "SIENDO",
    filmado: "FILMADO",
    inflamavel: "INFLAMABLE",
    becoAcessoRestrito: "CALLEJÓN · ACCESO RESTRINGIDO",
    proibidoEstacionar: "PROHIBIDO ESTACIONAR",
    coleta: "RECOLECCIÓN",
    proibidoDepositarEntulho: "PROHIBIDO DEPOSITAR ESCOMBROS",
    conteinerNo0417: "CONTENEDOR Nº 0417",
    cozinhaToqueACampainha: "COCINA · TOQUE EL TIMBRE",
    peso18Kg: "PESO 18 kg",
    lote0412: "LOTE 0412",
  },
};
