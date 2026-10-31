/*
 * MET Gala Heist v2 — textos DIEGÉTICOS da doca (placas, quadro de escalas, mural, mapa de fuga, etiquetas, estênceis,
 * marcas de piso, tela do notebook), desenhados na folha doca-tex.ts no idioma da cena. Nomes próprios (Gala Lumière,
 * Museu Vesper, Bufê Lumière, Gil, Sônia, Dorival, Márcia, Tião) não mudam. O varredor de i18n ignora *-copy.ts.
 */
import type { SceneLocale } from "../interior-copy";

export interface DocaCopy {
  rotaDeFuga: string;
  voceEstaAqui: string;
  saida: string;
  museuVesperTerreoEmCasoDeIncendioNaoUseOElevador: string;
  doca1CargaEDescarga: string;
  entregasDaGalaSomenteComCredencial: string;
  alturaLivre: string;
  n420M: string;
  portariaControleDeAcesso: string;
  motoristasApresentemSeNaPortaria: string;
  usoObrigatorio: string;
  deEpi: string;
  capaceteColeteBotina: string;
  proibido: string;
  fumar: string;
  leiEstadual: string;
  cuidado: string;
  empilhadeiraE: string;
  paleteiraEmManobra: string;
  extintor: string;
  cargaMaxima: string;
  n300KgPorPrateleira: string;
  pontoEletronico: string;
  sab0412AproximeOCracha: string;
  escalaDocaGalaLumiereSab0412: string;
  n2310TrocaDeTurnoDaSeguranca: string;
  portaoSoComOGil: string;
  cafe: string;
  naCopa: string;
  semanaDe: string;
  prevencao: string;
  ramais: string;
  aniversariante: string;
  aviso: string;
  proibidoEstacionar: string;
  naRampaDaDoca: string;
  administracao: string;
  marmita: string;
  sextaFeijoada: string;
  conferenciaDeCarga: string;
  bufeLumiereNf0412: string;
  manterRefrigerado: string;
  fragil: string;
  iluminacaoCase07: string;
  galaLumiereProducao: string;
  somCase12: string;
  paLadoL: string;
  figurinoCase21: string;
  desfileFinalAurora: string;
  cabosCase03: string;
  naoEmpilharSobreEste: string;
  museuVesper: string;
  institutoDoTrajeObra195704: string;
  fragilEsteLadoParaCimaManterSeco: string;
  luzPalco: string;
  naoAbrir: string;
  somLR: string;
  docaSalao: string;
  pedestres: string;
  naoObstruir: string;
  seguranca: string;
  perigo220380V: string;
  portaoAutomatico: string;
  naoPermanecaSobAPorta: string;
  bufe: string;
  conferenciaDeCargaDoca: string;
  n23473436Volumes: string;
  empilhadeiraEletricaNo03: string;
  capacidade1200Kg: string;
  centroDeCarga600MmElevacao16M: string;
  soOperadorTreinadoNaoTransportePessoas: string;
  scheduleRows: string[][];
  deliveries: string[];
  extensions: string[];
  checklist: string[];
  buttons: string[];
  laptopCols: string[];
  laptopRows: string[][];
}

export const DOCA_COPY: Record<SceneLocale, DocaCopy> = {
  "pt-BR": {
    rotaDeFuga: "ROTA DE FUGA",
    voceEstaAqui: "VOCÊ ESTÁ AQUI",
    saida: "SAÍDA",
    museuVesperTerreoEmCasoDeIncendioNaoUseOElevador: "Museu Vesper · térreo · em caso de incêndio não use o elevador",
    doca1CargaEDescarga: "DOCA 1 · CARGA E DESCARGA",
    entregasDaGalaSomenteComCredencial: "ENTREGAS DA GALA · SOMENTE COM CREDENCIAL",
    alturaLivre: "ALTURA LIVRE",
    n420M: "4,20 m",
    portariaControleDeAcesso: "PORTARIA · CONTROLE DE ACESSO",
    motoristasApresentemSeNaPortaria: "MOTORISTAS: APRESENTEM-SE NA PORTARIA",
    usoObrigatorio: "USO OBRIGATÓRIO",
    deEpi: "DE EPI",
    capaceteColeteBotina: "capacete · colete · botina",
    proibido: "PROIBIDO",
    fumar: "FUMAR",
    leiEstadual: "Lei estadual",
    cuidado: "CUIDADO",
    empilhadeiraE: "EMPILHADEIRA E",
    paleteiraEmManobra: "PALETEIRA EM MANOBRA",
    extintor: "EXTINTOR",
    cargaMaxima: "CARGA MÁXIMA",
    n300KgPorPrateleira: "300 kg POR PRATELEIRA",
    pontoEletronico: "PONTO ELETRÔNICO",
    sab0412AproximeOCracha: "SÁB 04/12  ·  APROXIME O CRACHÁ",
    escalaDocaGalaLumiereSab0412: "ESCALA · DOCA · GALA LUMIÈRE · SÁB 04/12",
    n2310TrocaDeTurnoDaSeguranca: "23:10  TROCA DE TURNO DA SEGURANÇA",
    portaoSoComOGil: "portão SÓ com o Gil!",
    cafe: "CAFÉ",
    naCopa: "na copa ↑",
    semanaDe: "SEMANA DE",
    prevencao: "PREVENÇÃO",
    ramais: "RAMAIS",
    aniversariante: "aniversariante",
    aviso: "AVISO",
    proibidoEstacionar: "PROIBIDO ESTACIONAR",
    naRampaDaDoca: "NA RAMPA DA DOCA",
    administracao: "— Administração",
    marmita: "MARMITA ✓",
    sextaFeijoada: "sexta: feijoada",
    conferenciaDeCarga: "CONFERÊNCIA DE CARGA",
    bufeLumiereNf0412: "Bufê Lumière · NF 0412",
    manterRefrigerado: "MANTER REFRIGERADO",
    fragil: "FRÁGIL",
    iluminacaoCase07: "ILUMINAÇÃO · CASE 07",
    galaLumiereProducao: "GALA LUMIÈRE · PRODUÇÃO",
    somCase12: "SOM · CASE 12",
    paLadoL: "PA · LADO L",
    figurinoCase21: "FIGURINO · CASE 21",
    desfileFinalAurora: "DESFILE FINAL · AURORA",
    cabosCase03: "CABOS · CASE 03",
    naoEmpilharSobreEste: "NÃO EMPILHAR SOBRE ESTE",
    museuVesper: "MUSEU VESPER",
    institutoDoTrajeObra195704: "INSTITUTO DO TRAJE · OBRA 1957-04",
    fragilEsteLadoParaCimaManterSeco: "FRÁGIL · ESTE LADO PARA CIMA · MANTER SECO",
    luzPalco: "LUZ PALCO",
    naoAbrir: "NÃO ABRIR!",
    somLR: "SOM L/R",
    docaSalao: "DOCA → SALÃO",
    pedestres: "PEDESTRES",
    naoObstruir: "NÃO OBSTRUIR",
    seguranca: "SEGURANÇA",
    perigo220380V: "PERIGO 220/380 V",
    portaoAutomatico: "PORTÃO AUTOMÁTICO",
    naoPermanecaSobAPorta: "NÃO PERMANEÇA SOB A PORTA",
    bufe: "BUFÊ",
    conferenciaDeCargaDoca: "CONFERÊNCIA DE CARGA · DOCA",
    n23473436Volumes: "23:47 · 34/36 volumes",
    empilhadeiraEletricaNo03: "EMPILHADEIRA ELÉTRICA  Nº 03",
    capacidade1200Kg: "CAPACIDADE 1.200 kg",
    centroDeCarga600MmElevacao16M: "CENTRO DE CARGA 600 mm  ·  ELEVAÇÃO 1,6 m",
    soOperadorTreinadoNaoTransportePessoas: "SÓ OPERADOR TREINADO · NÃO TRANSPORTE PESSOAS",
    scheduleRows: [["TURNO", "NOME", "FUNÇÃO", "ENTRA", "SAI"], ["NOITE", "Gil", "Portão / chave", "18:00", "02:00"], ["NOITE", "Sônia", "Ronda da doca", "18:00", "02:00"], ["NOITE", "Dorival", "Portaria", "18:00", "06:00"], ["BUFÊ", "Márcia", "Conferência", "17:00", "01:00"], ["BUFÊ", "Tião", "Carga e descarga", "17:00", "01:00"]],
    deliveries: ["ENTREGAS:", "21:00  Bufê Lumière — câmara fria  ✓", "21:40  Gelo, 40 sacos  ✓", "22:30  Flores (arranjo extra)", "00:30  Recolhimento dos cases"],
    extensions: ["Portaria 201", "Segurança 202", "Bufê 230", "Produção 245"],
    checklist: ["Câmara fria (3)", "Cubas inox (24)", "Taças (12 cx)", "Toalhas (6 fardos)", "Gelo (40 sacos)", "Flores (extra)", "Cases de luz (8)"],
    buttons: ["ABRE", "PARA", "FECHA"],
    laptopCols: ["NF", "FORNECEDOR", "VOL.", "OK"],
    laptopRows: [["4471", "Bufê Lumière", "12", "✓"], ["4472", "Gelo Polar", "40", "✓"], ["0913", "Flores Íris", "3", "—"], ["2210", "Produção · cases", "8", "✓"], ["2211", "Produção · luz", "4", "✓"], ["0057", "Instituto do Traje", "1", "!"], ["4475", "Bufê Lumière", "6", "—"]],
  },
  "en": {
    rotaDeFuga: "EVACUATION ROUTE",
    voceEstaAqui: "YOU ARE HERE",
    saida: "EXIT",
    museuVesperTerreoEmCasoDeIncendioNaoUseOElevador: "Vesper Museum · ground floor · in case of fire do not use the elevator",
    doca1CargaEDescarga: "DOCK 1 · LOADING AND UNLOADING",
    entregasDaGalaSomenteComCredencial: "GALA DELIVERIES · CREDENTIAL REQUIRED",
    alturaLivre: "CLEARANCE",
    n420M: "4.20 m",
    portariaControleDeAcesso: "GATEHOUSE · ACCESS CONTROL",
    motoristasApresentemSeNaPortaria: "DRIVERS: REPORT TO THE GATEHOUSE",
    usoObrigatorio: "MANDATORY",
    deEpi: "PPE AREA",
    capaceteColeteBotina: "helmet · vest · boots",
    proibido: "NO",
    fumar: "SMOKING",
    leiEstadual: "State law",
    cuidado: "CAUTION",
    empilhadeiraE: "FORKLIFT AND",
    paleteiraEmManobra: "PALLET JACK OPERATING",
    extintor: "EXTINGUISHER",
    cargaMaxima: "MAX LOAD",
    n300KgPorPrateleira: "300 kg PER SHELF",
    pontoEletronico: "TIME CLOCK",
    sab0412AproximeOCracha: "SAT 12/04  ·  TAP YOUR BADGE",
    escalaDocaGalaLumiereSab0412: "SHIFT BOARD · DOCK · GALA LUMIÈRE · SAT 12/04",
    n2310TrocaDeTurnoDaSeguranca: "23:10  SECURITY SHIFT CHANGE",
    portaoSoComOGil: "gate ONLY with Gil!",
    cafe: "COFFEE",
    naCopa: "in the pantry ↑",
    semanaDe: "WEEK OF",
    prevencao: "PREVENTION",
    ramais: "EXTENSIONS",
    aniversariante: "birthday today",
    aviso: "NOTICE",
    proibidoEstacionar: "NO PARKING",
    naRampaDaDoca: "ON THE DOCK RAMP",
    administracao: "— Management",
    marmita: "LUNCH ✓",
    sextaFeijoada: "friday: feijoada",
    conferenciaDeCarga: "CARGO CHECK",
    bufeLumiereNf0412: "Bufê Lumière · invoice 0412",
    manterRefrigerado: "KEEP REFRIGERATED",
    fragil: "FRAGILE",
    iluminacaoCase07: "LIGHTING · CASE 07",
    galaLumiereProducao: "GALA LUMIÈRE · PRODUCTION",
    somCase12: "SOUND · CASE 12",
    paLadoL: "PA · SIDE L",
    figurinoCase21: "COSTUMES · CASE 21",
    desfileFinalAurora: "FINAL SHOW · AURORA",
    cabosCase03: "CABLES · CASE 03",
    naoEmpilharSobreEste: "DO NOT STACK ON TOP",
    museuVesper: "VESPER MUSEUM",
    institutoDoTrajeObra195704: "COSTUME INSTITUTE · WORK 1957-04",
    fragilEsteLadoParaCimaManterSeco: "FRAGILE · THIS SIDE UP · KEEP DRY",
    luzPalco: "STAGE LIGHT",
    naoAbrir: "DO NOT OPEN!",
    somLR: "SOUND L/R",
    docaSalao: "DOCK → BALLROOM",
    pedestres: "PEDESTRIANS",
    naoObstruir: "KEEP CLEAR",
    seguranca: "SECURITY",
    perigo220380V: "DANGER 220/380 V",
    portaoAutomatico: "AUTOMATIC DOOR",
    naoPermanecaSobAPorta: "DO NOT STAND UNDER THE DOOR",
    bufe: "CATERING",
    conferenciaDeCargaDoca: "CARGO CHECK · DOCK",
    n23473436Volumes: "23:47 · 34/36 items",
    empilhadeiraEletricaNo03: "ELECTRIC STACKER  No. 03",
    capacidade1200Kg: "CAPACITY 1,200 kg",
    centroDeCarga600MmElevacao16M: "LOAD CENTER 600 mm  ·  LIFT 1.6 m",
    soOperadorTreinadoNaoTransportePessoas: "TRAINED OPERATORS ONLY · NO RIDERS",
    scheduleRows: [["SHIFT", "NAME", "ROLE", "IN", "OUT"], ["NIGHT", "Gil", "Gate / key", "18:00", "02:00"], ["NIGHT", "Sônia", "Dock patrol", "18:00", "02:00"], ["NIGHT", "Dorival", "Gatehouse", "18:00", "06:00"], ["CATERING", "Márcia", "Check-in", "17:00", "01:00"], ["CATERING", "Tião", "Loading", "17:00", "01:00"]],
    deliveries: ["DELIVERIES:", "21:00  Bufê Lumière — cold room  ✓", "21:40  Ice, 40 bags  ✓", "22:30  Flowers (extra arrangement)", "00:30  Case pickup"],
    extensions: ["Gatehouse 201", "Security 202", "Catering 230", "Production 245"],
    checklist: ["Cold room (3)", "Steel pans (24)", "Glasses (12 bx)", "Linens (6 bales)", "Ice (40 bags)", "Flowers (extra)", "Light cases (8)"],
    buttons: ["OPEN", "STOP", "CLOSE"],
    laptopCols: ["INV.", "SUPPLIER", "QTY", "OK"],
    laptopRows: [["4471", "Bufê Lumière", "12", "✓"], ["4472", "Polar Ice", "40", "✓"], ["0913", "Íris Flowers", "3", "—"], ["2210", "Production · cases", "8", "✓"], ["2211", "Production · lights", "4", "✓"], ["0057", "Costume Institute", "1", "!"], ["4475", "Bufê Lumière", "6", "—"]],
  },
  "es": {
    rotaDeFuga: "RUTA DE EVACUACIÓN",
    voceEstaAqui: "USTED ESTÁ AQUÍ",
    saida: "SALIDA",
    museuVesperTerreoEmCasoDeIncendioNaoUseOElevador: "Museo Vesper · planta baja · en caso de incendio no use el ascensor",
    doca1CargaEDescarga: "MUELLE 1 · CARGA Y DESCARGA",
    entregasDaGalaSomenteComCredencial: "ENTREGAS DE LA GALA · SOLO CON CREDENCIAL",
    alturaLivre: "ALTURA LIBRE",
    n420M: "4,20 m",
    portariaControleDeAcesso: "PORTERÍA · CONTROL DE ACCESO",
    motoristasApresentemSeNaPortaria: "CONDUCTORES: PRESÉNTENSE EN LA PORTERÍA",
    usoObrigatorio: "USO OBLIGATORIO",
    deEpi: "DE EPP",
    capaceteColeteBotina: "casco · chaleco · botas",
    proibido: "PROHIBIDO",
    fumar: "FUMAR",
    leiEstadual: "Ley estatal",
    cuidado: "CUIDADO",
    empilhadeiraE: "MONTACARGAS Y",
    paleteiraEmManobra: "TRANSPALETA EN MANIOBRA",
    extintor: "EXTINTOR",
    cargaMaxima: "CARGA MÁXIMA",
    n300KgPorPrateleira: "300 kg POR ESTANTE",
    pontoEletronico: "RELOJ DE FICHAR",
    sab0412AproximeOCracha: "SÁB 04/12  ·  ACERQUE SU CREDENCIAL",
    escalaDocaGalaLumiereSab0412: "TURNOS · MUELLE · GALA LUMIÈRE · SÁB 04/12",
    n2310TrocaDeTurnoDaSeguranca: "23:10  CAMBIO DE TURNO DE SEGURIDAD",
    portaoSoComOGil: "¡portón SOLO con Gil!",
    cafe: "CAFÉ",
    naCopa: "en la cocina ↑",
    semanaDe: "SEMANA DE",
    prevencao: "PREVENCIÓN",
    ramais: "EXTENSIONES",
    aniversariante: "cumpleañero",
    aviso: "AVISO",
    proibidoEstacionar: "PROHIBIDO ESTACIONAR",
    naRampaDaDoca: "EN LA RAMPA DEL MUELLE",
    administracao: "— Administración",
    marmita: "ALMUERZO ✓",
    sextaFeijoada: "viernes: feijoada",
    conferenciaDeCarga: "VERIFICACIÓN DE CARGA",
    bufeLumiereNf0412: "Bufê Lumière · factura 0412",
    manterRefrigerado: "MANTENER REFRIGERADO",
    fragil: "FRÁGIL",
    iluminacaoCase07: "ILUMINACIÓN · CASE 07",
    galaLumiereProducao: "GALA LUMIÈRE · PRODUCCIÓN",
    somCase12: "SONIDO · CASE 12",
    paLadoL: "PA · LADO L",
    figurinoCase21: "VESTUARIO · CASE 21",
    desfileFinalAurora: "DESFILE FINAL · AURORA",
    cabosCase03: "CABLES · CASE 03",
    naoEmpilharSobreEste: "NO APILAR ENCIMA",
    museuVesper: "MUSEO VESPER",
    institutoDoTrajeObra195704: "INSTITUTO DEL TRAJE · OBRA 1957-04",
    fragilEsteLadoParaCimaManterSeco: "FRÁGIL · ESTE LADO ARRIBA · MANTENER SECO",
    luzPalco: "LUZ ESCENARIO",
    naoAbrir: "¡NO ABRIR!",
    somLR: "SONIDO L/R",
    docaSalao: "MUELLE → SALÓN",
    pedestres: "PEATONES",
    naoObstruir: "NO OBSTRUIR",
    seguranca: "SEGURIDAD",
    perigo220380V: "PELIGRO 220/380 V",
    portaoAutomatico: "PORTÓN AUTOMÁTICO",
    naoPermanecaSobAPorta: "NO PERMANEZCA BAJO LA PUERTA",
    bufe: "BUFÉ",
    conferenciaDeCargaDoca: "VERIFICACIÓN DE CARGA · MUELLE",
    n23473436Volumes: "23:47 · 34/36 bultos",
    empilhadeiraEletricaNo03: "APILADOR ELÉCTRICO  Nº 03",
    capacidade1200Kg: "CAPACIDAD 1.200 kg",
    centroDeCarga600MmElevacao16M: "CENTRO DE CARGA 600 mm  ·  ELEVACIÓN 1,6 m",
    soOperadorTreinadoNaoTransportePessoas: "SOLO OPERADOR CAPACITADO · NO TRANSPORTE PERSONAS",
    scheduleRows: [["TURNO", "NOMBRE", "FUNCIÓN", "ENTRA", "SALE"], ["NOCHE", "Gil", "Portón / llave", "18:00", "02:00"], ["NOCHE", "Sônia", "Ronda del muelle", "18:00", "02:00"], ["NOCHE", "Dorival", "Portería", "18:00", "06:00"], ["BUFÉ", "Márcia", "Verificación", "17:00", "01:00"], ["BUFÉ", "Tião", "Carga y descarga", "17:00", "01:00"]],
    deliveries: ["ENTREGAS:", "21:00  Bufê Lumière — cámara fría  ✓", "21:40  Hielo, 40 bolsas  ✓", "22:30  Flores (arreglo extra)", "00:30  Retiro de los cases"],
    extensions: ["Portería 201", "Seguridad 202", "Bufé 230", "Producción 245"],
    checklist: ["Cámara fría (3)", "Cubetas inox (24)", "Copas (12 cj)", "Manteles (6 fardos)", "Hielo (40 bolsas)", "Flores (extra)", "Cases de luz (8)"],
    buttons: ["ABRE", "PARA", "CIERRA"],
    laptopCols: ["FACT.", "PROVEEDOR", "VOL.", "OK"],
    laptopRows: [["4471", "Bufê Lumière", "12", "✓"], ["4472", "Hielo Polar", "40", "✓"], ["0913", "Flores Íris", "3", "—"], ["2210", "Producción · cases", "8", "✓"], ["2211", "Producción · luz", "4", "✓"], ["0057", "Instituto del Traje", "1", "!"], ["4475", "Bufê Lumière", "6", "—"]],
  },
};
