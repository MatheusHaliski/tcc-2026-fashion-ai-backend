package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.recurso.Flair3dPecaVirtual;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoBonus;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * FLAIR 3D — os 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md). Contexto do Strategy: escolhe o {@link Flair3dNucleo}
 * pelo código, abre a partida (deck conferido, semente sorteada, participantes da cena), confere dono, deck e vagas na
 * entrega e delega a pontuação ao núcleo. A partida fecha na entrega (409 na segunda), salvo nos núcleos em etapas: a
 * entrega começa a ação (EM_ACAO) e cada acionamento avança; no LABIRINTO a entrega que não abre mantém a partida ABERTA.
 */
@Service
public class Flair3dNucleoService {
    /** Semente até 2^53, para chegar inteira ao JavaScript. */
    static final long SEMENTE_MAX = 1L << 53;

    /** {@code rodada}: a rodada escolhida (nula = o objetivo mais simples do jogo). */
    public record AbrirPartida(List<UUID> deck, String avatar, String rodada) {
        public AbrirPartida(List<UUID> deck, String avatar) {
            this(deck, avatar, null);
        }
    }

    /** {@code partida}: os selos valem para a rodada e o sorteio dela (o tema já revelado); sem ela, vale {@code rodada}. */
    public record PedidoEfeitos(List<UUID> cartas, String rodada, UUID partida) {
        public PedidoEfeitos(List<UUID> cartas) {
            this(cartas, null, null);
        }
    }

    private final Flair3dMatchRepository matches;
    private final Flair3dCartas cartas;
    private final Flair3dPartidaAbertura abertura;

    public Flair3dNucleoService(Flair3dMatchRepository matches, Flair3dCartas cartas) {
        this.matches = matches;
        this.cartas = cartas;
        this.abertura = new Flair3dPartidaAbertura(matches, cartas);
    }

    static Flair3dNucleo nucleo(String codigo) {
        return Flair3dNucleos.porCodigo(codigo).orElseThrow(() -> Flair3dErros.naoEncontrado("NUCLEO_NAO_ENCONTRADO", "nucleo_nao_encontrado"));
    }

    /** Lista pública: {nucleos:[{codigo, numero, recursos, acoes}]}. */
    public Map<String, Object> lista() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Flair3dNucleo n : Flair3dNucleos.TODOS) {
            Definicao d = n.definicao();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo", d.codigo());
            m.put("numero", d.numero());
            m.put("recursos", d.recursos());
            m.put("acoes", d.acoes());
            out.add(m);
        }
        return Map.of("nucleos", out);
    }

    public Definicao definicao(String codigo) {
        return nucleo(codigo).definicao();
    }

    /**
     * O efeito de cada carta da pessoa neste núcleo: {efeitos:[{cardId, itens:[{codigo, valor, motivo}], perfil}]}
     * (Flair3dEfeitosDaCarta). Carta que não
     * pontua num núcleo de cartas leva um item de motivo (o do núcleo, ou SEM_BONUS), nunca a lista vazia.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> efeitos(CurrentUser user, String codigo, PedidoEfeitos pedido) {
        Flair3dNucleo n = nucleo(codigo);
        List<UUID> ids = pedido == null || pedido.cartas() == null ? List.of() : pedido.cartas();
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), ids);
        Contexto ctx = contextoDosEfeitos(user, n, minhas, pedido);
        boolean deCartas = n.definicao().recursos().contains(Definicao.CARTAS);
        List<Map<String, Object>> out = new ArrayList<>();
        minhas.forEach((id, carta) -> out.add(Flair3dEfeitosDaCarta.daCarta(n, id, carta, ctx, deCartas)));
        return Map.of("efeitos", out);
    }

    /** Abre a partida solo: confere o deck (422), sorteia a semente e grava os participantes da cena. */
    @Transactional
    public Map<String, Object> abrir(CurrentUser user, String codigo, AbrirPartida pedido) {
        return abertura.abrir(user, nucleo(codigo), pedido, ThreadLocalRandom.current().nextLong(SEMENTE_MAX));
    }

    /** Abre a partida de um lado da sala multiplayer com a semente da sala (Flair3dSalaAssincrona). */
    @Transactional
    public Map<String, Object> abrirComSemente(CurrentUser user, String codigo, AbrirPartida pedido, long semente) {
        return abertura.abrir(user, nucleo(codigo), pedido, semente);
    }

    /**
     * Entrega e pontua: só o dono (403), com a partida ABERTA (409), cartas da pessoa e do deck nas vagas do núcleo (422).
     * Fecha a partida, salvo quando o núcleo devolve EM_ACAO (falta acionar) ou ABERTA (LABIRINTO: o espelho não abriu e a
     * pessoa pode apresentar de novo; cada entrega conta uma tentativa).
     */
    @Transactional
    public Resultado entregar(CurrentUser user, UUID partidaId, Entrega entrega) {
        Flair3dMatch m = partida(user, partidaId, Flair3dMatch.ABERTA);
        Flair3dNucleo n = nucleo(m.getNucleo());
        Entrega e = entrega == null ? new Entrega(null, null, null, null) : entrega;
        Andamento a = Andamento.ler(m.getEstadoJson()).proximaTentativa(Json.read(m.getEntregaJson(), Entrega.class));
        return gravar(m, e, a, comLook(n, e, a, contexto(user, m, n, e, a)));
    }

    /**
     * Avança a ação de uma partida EM_ACAO (409 fora dela) com o acionamento da pessoa: a carta Especial do DRESS_FIGHTER
     * ou a troca do intervalo do FASHION_SPORTS (422 se não vale). A última etapa fecha a partida com o resultado.
     */
    @Transactional
    public Resultado acionar(CurrentUser user, UUID partidaId, Acionamento acionamento) {
        Flair3dMatch m = partida(user, partidaId, Flair3dMatch.EM_ACAO);
        Flair3dNucleo n = nucleo(m.getNucleo());
        Entrega e = Json.read(m.getEntregaJson(), Entrega.class);
        Andamento a = Andamento.ler(m.getEstadoJson()).com(acionamento == null ? Acionamento.NENHUM : acionamento);
        return gravar(m, e, a, comLook(n, e, a, contexto(user, m, n, e, a)));
    }

    /** Prévia da entrega numa partida ABERTA: pontos e regras de agora, sem gravar nada nem contar tentativa. */
    @Transactional(readOnly = true)
    public Resultado previa(CurrentUser user, UUID partidaId, Entrega entrega) {
        Flair3dMatch m = partida(user, partidaId, Flair3dMatch.ABERTA);
        Flair3dNucleo n = nucleo(m.getNucleo());
        Entrega e = entrega == null ? new Entrega(null, null, null, null) : entrega;
        Andamento a = Andamento.ler(m.getEstadoJson()).proximaTentativa(Json.read(m.getEntregaJson(), Entrega.class));
        Contexto ctx = contexto(user, m, n, e, a);
        return Flair3dRecursoBonus.naPrevia(n.codigo(), n.previa(e, ctx), vestidasOuZonas(n, e, ctx), a.usos()).comStatus(m.getStatus());
    }

    /** O contexto dos selos: o da partida (rodada e sorteio dela, só do dono) ou o da rodada pedida, ainda sem sorteio. */
    private Contexto contextoDosEfeitos(CurrentUser user, Flair3dNucleo n, Map<UUID, CbcRules.Card> minhas, PedidoEfeitos pedido) {
        Contexto base = new Contexto(minhas, cartas.paises(), null);
        if (pedido == null) {
            return base;
        }
        if (pedido.partida() == null) {
            return base.naRodada(Flair3dPartidaAbertura.rodadaPedida(n.definicao(), pedido.rodada()));
        }
        Flair3dMatch m = matches.findById(pedido.partida()).filter(x -> x.getUserId().equals(user.id()) && x.getNucleo().equals(n.codigo()))
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PARTIDA_NAO_ENCONTRADA", "partida_nao_encontrada"));
        // como na prévia: a entrega já feita conta como etapa passada, e o selo vale para o pedido da vez
        Andamento a = Andamento.ler(m.getEstadoJson());
        boolean aberta = Flair3dMatch.ABERTA.equals(m.getStatus());
        return base.comSemente(m.getSemente()).comAndamento(aberta ? a.proximaTentativa(Json.read(m.getEntregaJson(), Entrega.class)) : a);
    }

    /** A partida da pessoa (404, 403) no status que a operação pede (409). */
    Flair3dMatch partida(CurrentUser user, UUID partidaId, String status) {
        Flair3dMatch m = matches.findById(partidaId)
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PARTIDA_NAO_ENCONTRADA", "partida_nao_encontrada"));
        if (!m.getUserId().equals(user.id())) {
            throw new ApiException(403, "PARTIDA_DE_OUTRA_PESSOA", Msg.t("flair3d.erro.partida_de_outra_pessoa"));
        }
        if (!status.equals(m.getStatus())) {
            throw Flair3dMatch.EM_ACAO.equals(status)
                    ? ApiException.conflict("PARTIDA_SEM_ACAO", Msg.t("flair3d.erro.partida_sem_acao"))
                    : ApiException.conflict("PARTIDA_JA_ENTREGUE", Msg.t("flair3d.erro.partida_ja_entregue"));
        }
        return m;
    }

    /** Cartas da entrega e dos acionamentos, todas da pessoa e do deck (422), no contexto semeado da partida. */
    Contexto contexto(CurrentUser user, Flair3dMatch m, Flair3dNucleo n, Entrega e, Andamento a) {
        List<UUID> usadas = new ArrayList<>(e.cartas().values());
        usadas.addAll(a.cartas());
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), usadas);
        List<UUID> deck = Flair3dDeck.ids(m.getDeckJson());
        Flair3dEntregas.conferir(n.definicao().naRodada(a.rodada()), e, minhas, deck, a.cartas());
        return cartas.contexto(minhas, m.getSemente()).comAndamento(a).comDeck(deck.isEmpty() ? minhas : cartas.daPessoa(user.id(), deck));
    }

    /** A nota do jogo com o que o look e os recursos somam (regra peça-recurso, Flair3dRecursoBonus). */
    private static Resultado comLook(Flair3dNucleo n, Entrega e, Andamento a, Contexto ctx) {
        return Flair3dRecursoBonus.aplicar(n.codigo(), n.pontuar(e, ctx), vestidasOuZonas(n, e, ctx), a.usos());
    }

    /** As cartas vestidas; nos jogos de zonas, as zonas pintadas como peças virtuais. */
    private static Map<String, CbcRules.Card> vestidasOuZonas(Flair3dNucleo n, Entrega e, Contexto ctx) {
        Map<String, CbcRules.Card> vestidas = ctx.vestidas(e);
        return vestidas.isEmpty() ? Flair3dPecaVirtual.daZonas(n.codigo(), e.zonas()) : vestidas;
    }

    /** Grava a etapa: entrega, andamento e status; resultado, pontos e estrelas só quando a partida fecha. */
    private Resultado gravar(Flair3dMatch m, Entrega e, Andamento a, Resultado calculado) {
        Resultado r = calculado.comStatus(calculado.fecha() ? Flair3dMatch.ENTREGUE : calculado.status());
        m.setStatus(r.status());
        m.setEntregaJson(Json.write(e));
        m.setEstadoJson(Json.write(a));
        if (r.fecha()) {
            m.setResultadoJson(Json.write(r));
            m.setPontos(r.pontos());
            m.setEstrelas(r.estrelas());
        }
        matches.save(m);
        return r;
    }
}
