/* API simulada do multiplayer do FLAIR 3D para a prova no navegador (page.route): um servidor em memória dividido
   pelas duas pessoas (dois contextos do navegador), com os mesmos DTOs de lib/flair/multi/types.ts. O julgamento do
   turno aqui é uma conta simples de prova (a regra de verdade é a do servidor, coberta pelos testes JUnit). */
const PESSOAS = {
  'u-ana': { id: 'u-ana', username: 'ana', displayName: 'Ana Souza' },
  'u-bia': { id: 'u-bia', username: 'bia', displayName: 'Bia Lima' },
  'u-caio': { id: 'u-caio', username: 'caio', displayName: 'Caio Reis' },
  'u-eva': { id: 'u-eva', username: 'eva', displayName: 'Eva Prado' },
};
const ADV = {
  'u-ana': { nivel: 'STYLE_MAVEN', estilo: 'CLASSIC', pais: 'BR', cidade: 'Recife', ativo: true },
  'u-bia': { nivel: 'ICONIC', estilo: 'DRAMATIC', pais: 'BR', cidade: 'São Paulo', ativo: true },
  'u-caio': { nivel: 'ROOKIE', estilo: 'NATURAL', pais: 'PT', cidade: null, ativo: false },
  'u-eva': { nivel: 'TRENDSETTER', estilo: null, pais: 'BR', cidade: null, ativo: true, privada: true },
};
const NIVEIS = ['ROOKIE', 'TRENDSETTER', 'STYLE_MAVEN', 'FASHION_ARCHITECT', 'ICONIC', 'LEGEND'];
const SIGO = { 'u-ana': ['u-bia', 'u-caio'], 'u-bia': ['u-ana'] };
const DESAFIOS = ['MONO_AZUL', 'CONVITE_BLACK_TIE', 'CLIMA_FRIO'];
const COR = { SUP: 'blue', INF: 'black', CAL: 'white' };

const carta = (dono, n, position) => ({ id: `${dono}-c${n}`, originType: 'PIECE', originId: `${dono}-p${n}`, season: 'SPRING', tier: n % 2 ? 'OURO' : 'PRATA', ovr: 70 + n,
  rare: false, position, name: `${position === 'SUP' ? 'Blusa' : position === 'INF' ? 'Calça' : 'Sapato'} ${n}`, priceVerified: true, state: 'AVAILABLE',
  tradeable: true, acquiredVia: 'PIECE', tags: { colors: [COR[position]], occasions: ['formal'], materials: ['wool'] } });
const banco = (dono) => ({ season: 'SPRING', counts: {}, total: 6, cards: ['SUP', 'INF', 'CAL', 'SUP', 'INF', 'CAL'].map((p, i) => carta(dono, i + 1, p)) });

function criarServidor() {
  const salas = new Map();
  const log = [];
  let n = 0;
  const pessoa = (id) => ({ id, username: PESSOAS[id].username, nome: PESSOAS[id].displayName, avatarUrl: null });
  const relacao = (eu, ela) => {
    const a = (SIGO[eu] || []).includes(ela); const b = (SIGO[ela] || []).includes(eu);
    return a && b ? 'MUTUOS' : a ? 'SIGO' : b ? 'ME_SEGUE' : 'NENHUMA';
  };
  function adversarios(eu, q) {
    const termo = (q.get('q') || '').toLowerCase();
    const rel = q.get('relacao') || 'TODOS';
    const min = NIVEIS.indexOf(q.get('nivel') || 'ROOKIE');
    const out = Object.keys(PESSOAS).filter((id) => id !== eu).map((id) => {
      const a = ADV[id]; const r = relacao(eu, id);
      const aberta = [...salas.values()].find((s) => ['CONVIDADO', 'JOGANDO'].includes(s.estado) && [s.de, s.para].includes(eu) && [s.de, s.para].includes(id));
      return { ...pessoa(id), pais: a.pais, cidade: a.cidade, nivel: a.nivel, nivelLabel: a.nivel, pontos: 100, estilo: a.estilo, ativo: a.ativo, temDeck: true,
        relacao: r, status: aberta ? (aberta.estado === 'JOGANDO' ? 'EM_SALA' : 'CONVITE_PENDENTE') : 'DISPONIVEL',
        convidavel: !(a.privada && !(SIGO[eu] || []).includes(id)), motivo: a.privada && !(SIGO[eu] || []).includes(id) ? 'CONTA_PRIVADA' : null };
    }).filter((p) => !termo || p.username.includes(termo) || p.nome.toLowerCase().includes(termo))
      .filter((p) => rel === 'TODOS' || p.relacao === rel || (rel === 'SIGO' && p.relacao === 'MUTUOS') || (rel === 'ME_SEGUE' && p.relacao === 'MUTUOS'))
      .filter((p) => NIVEIS.indexOf(p.nivel) >= min).filter((p) => q.get('ativo') !== 'true' || p.ativo);
    return { resultados: out, niveis: NIVEIS };
  }
  const nota = (lance) => Math.min(100, Object.keys(lance).length * 25 + (lance.SUP ? 10 : 0));
  function julgados(s) {
    const out = [];
    for (let i = 0; i < Math.min(s.lances.DE.length, s.lances.PARA.length); i++) {
      const de = nota(s.lances.DE[i]); const para = nota(s.lances.PARA[i]);
      out.push({ turno: i + 1, desafio: DESAFIOS[i], vencedor: de > para ? 'DE' : de < para ? 'PARA' : 'EMPATE',
        de: { nota: de, conta: { regra: de, look: 0, recurso: 0 }, cartas: s.lances.DE[i] }, para: { nota: para, conta: { regra: para, look: 0, recurso: 0 }, cartas: s.lances.PARA[i] } });
    }
    return out;
  }
  function vista(s, eu) {
    const voce = s.de === eu ? 'DE' : 'PARA'; const outro = voce === 'DE' ? 'PARA' : 'DE';
    const v = { id: s.id, jogo: s.jogo, rodada: s.rodada, modo: s.modo, estado: s.estado, prazo: s.prazo, criadaEm: s.criadaEm, voce, de: pessoa(s.de), para: pessoa(s.para),
      revancheDe: null, resultado: s.resultado, vencedor: s.vencedor, semente: s.estado === 'FECHADO' ? s.semente : null, modos: [s.modo] };
    if (s.modo === 'TURNOS') {
      const j = julgados(s); const meus = s.lances[voce]; const deles = s.lances[outro];
      v.turnos = { total: 3, vagas: ['SUP', 'INF', 'CAL', 'ACE'], minimo: 1, repete: true, vez: meus.length + 1, esperando: meus.length > deles.length,
        outroLancou: deles.length > meus.length, meuDeck: s.decks[voce], deckDoOutroPronto: s.decks[outro].length > 0,
        meuLance: meus.length > deles.length ? meus[meus.length - 1] : null, usadas: [], julgados: j,
        pontos: { de: j.reduce((a, t) => a + t.de.nota, 0), para: j.reduce((a, t) => a + t.para.nota, 0) }, encerrado: j.length === 3, vencedor: s.vencedor,
        desafios: DESAFIOS.slice(0, Math.min(meus.length, deles.length) + 1) };
    } else {
      const lado = (l) => (s.partidas[l] ? { terminou: !!s.notas[l], pontos: s.notas[l] ?? null, estrelas: s.notas[l] ? 2 : null } : null);
      v.assincrono = { minhaPartida: s.partidas[voce], eu: lado(voce), outro: s.estado === 'FECHADO' ? lado(outro) : lado(outro) && { terminou: lado(outro).terminou } };
    }
    return v;
  }
  function fecharSePreciso(s) {
    if (s.modo === 'TURNOS' && julgados(s).length === 3) {
      const j = julgados(s); const de = j.reduce((a, t) => a + t.de.nota, 0); const para = j.reduce((a, t) => a + t.para.nota, 0);
      Object.assign(s, { estado: 'FECHADO', vencedor: de > para ? 'DE' : de < para ? 'PARA' : 'EMPATE', resultado: { de: { pontos: de }, para: { pontos: para }, motivo: 'TURNOS' } });
    }
    if (s.modo === 'ASSINCRONO' && s.notas.DE != null && s.notas.PARA != null) {
      Object.assign(s, { estado: 'FECHADO', vencedor: s.notas.DE > s.notas.PARA ? 'DE' : s.notas.DE < s.notas.PARA ? 'PARA' : 'EMPATE',
        resultado: { de: { pontos: s.notas.DE, estrelas: 2 }, para: { pontos: s.notas.PARA, estrelas: 2 }, motivo: 'PONTOS' } });
    }
  }
  /** Responde à rota da pessoa {@code eu}; devolve [status, corpo] ou null (rota fora do multiplayer). */
  function responder(eu, method, url, body) {
    const p = url.pathname;
    log.push(`${PESSOAS[eu].username} ${method} ${p}${url.search}`);
    if (p === '/api/flair/3d/adversarios') return [200, adversarios(eu, url.searchParams)];
    if (p === '/api/flair/3d/convites' && method === 'POST') {
      const id = `sala-${++n}`;
      const s = { id, jogo: body.jogo, rodada: body.rodada || null, modo: body.modo || 'ASSINCRONO', estado: 'CONVIDADO', prazo: '2026-11-29T18:00:00Z', criadaEm: new Date().toISOString(),
        de: eu, para: body.para, semente: 424242, lances: { DE: [], PARA: [] }, decks: { DE: [], PARA: [] }, partidas: {}, notas: {}, resultado: null, vencedor: null };
      salas.set(id, s);
      return [201, vista(s, eu)];
    }
    if (p === '/api/flair/3d/convites') {
      const minhas = [...salas.values()].filter((s) => [s.de, s.para].includes(eu));
      return [200, { recebidos: minhas.filter((s) => s.estado === 'CONVIDADO' && s.para === eu).map((s) => vista(s, eu)),
        enviados: minhas.filter((s) => s.estado === 'CONVIDADO' && s.de === eu).map((s) => vista(s, eu)),
        ativas: minhas.filter((s) => s.estado === 'JOGANDO').map((s) => vista(s, eu)), recentes: minhas.filter((s) => s.estado === 'FECHADO').map((s) => vista(s, eu)) }];
    }
    const h = p.match(/^\/api\/flair\/3d\/historico\/(.+)$/);
    if (h) {
      const fechadas = [...salas.values()].filter((s) => s.estado === 'FECHADO' && [s.de, s.para].includes(eu) && [s.de, s.para].includes(h[1]));
      const v = fechadas.filter((s) => (s.vencedor === 'DE' ? s.de : s.vencedor === 'PARA' ? s.para : null) === eu).length;
      const e = fechadas.filter((s) => s.vencedor === 'EMPATE').length;
      return [200, { placar: { vitorias: v, derrotas: fechadas.length - v - e, empates: e }, salas: fechadas.map((s) => vista(s, eu)) }];
    }
    const m = p.match(/^\/api\/flair\/3d\/salas\/([^/]+)(?:\/(\w+))?$/);
    if (!m) return null;
    const s = salas.get(m[1]);
    if (!s || ![s.de, s.para].includes(eu)) return [404, { status: 404, code: 'SALA_NAO_ENCONTRADA', message: 'Sala não encontrada.' }];
    const lado = s.de === eu ? 'DE' : 'PARA';
    const acao = m[2];
    if (acao === 'aceitar') s.estado = 'JOGANDO';
    if (acao === 'recusar') s.estado = 'RECUSADO';
    if (acao === 'cancelar') s.estado = 'CANCELADO';
    if (acao === 'deck') s.decks[lado] = body.deck;
    if (acao === 'lance') {
      if (body.turno !== s.lances[lado].length + 1) return [409, { status: 409, code: 'TURNO_FORA_DE_ORDEM', message: 'Esse turno já foi jogado ou ainda não chegou.' }];
      s.lances[lado].push(body.cartas);
      fecharSePreciso(s);
    }
    if (acao === 'partida') {
      s.partidas[lado] = `partida-${lado}`;
      return [201, { id: s.partidas[lado], nucleo: s.jogo, status: 'ABERTA', semente: s.semente, deck: body.deck, rodada: s.rodada, abertura: {},
        participantes: [{ tipo: 'MODELO_CASA', papel: 'PROTAGONISTA', time: 'A', userId: eu }], sala: s.id }];
    }
    return [200, vista(s, eu)];
  }
  /** A partida do lado terminou com a nota (como a entrega no jogo faria). */
  function terminar(salaId, lado, pontos) {
    const s = salas.get(salaId); s.notas[lado] = pontos; fecharSePreciso(s);
  }
  return { responder, terminar, banco, salas, log, PESSOAS };
}

module.exports = { criarServidor };
