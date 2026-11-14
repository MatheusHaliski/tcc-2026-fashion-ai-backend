package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    public record AbrirPartida(List<UUID> deck, String avatar) {
    }

    public record PedidoEfeitos(List<UUID> cartas) {
    }

    private final Flair3dMatchRepository matches;
    private final Flair3dCartas cartas;

    public Flair3dNucleoService(Flair3dMatchRepository matches, Flair3dCartas cartas) {
        this.matches = matches;
        this.cartas = cartas;
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
     * O efeito de cada carta da pessoa neste núcleo: {efeitos:[{cardId, itens:[{codigo, valor, motivo}]}]}. Carta que não
     * pontua num núcleo de cartas leva um item de motivo (o do núcleo, ou SEM_BONUS), nunca a lista vazia.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> efeitos(CurrentUser user, String codigo, PedidoEfeitos pedido) {
        Flair3dNucleo n = nucleo(codigo);
        List<UUID> ids = pedido == null || pedido.cartas() == null ? List.of() : pedido.cartas();
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), ids);
        Contexto ctx = new Contexto(minhas, cartas.paises(), null);
        boolean deCartas = n.definicao().recursos().contains(Definicao.CARTAS);
        List<Map<String, Object>> out = new ArrayList<>();
        minhas.forEach((id, carta) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cardId", id);
            List<Efeito> itens = n.efeitos(carta, ctx);
            m.put("itens", itens.isEmpty() && deCartas ? List.of(Efeito.motivo(Efeito.SEM_BONUS)) : itens);
            out.add(m);
        });
        return Map.of("efeitos", out);
    }

    /** Abre a partida solo: confere o deck (422), sorteia a semente e grava os participantes da cena. */
    @Transactional
    public Map<String, Object> abrir(CurrentUser user, String codigo, AbrirPartida pedido) {
        Flair3dNucleo n = nucleo(codigo);
        Definicao d = n.definicao();
        List<UUID> deck = pedido == null || pedido.deck() == null ? List.of() : pedido.deck().stream().filter(Objects::nonNull).toList();
        if (!d.deck().semDeck()) {
            Flair3dDeck.validar(d.deck(), deck, cartas.daPessoa(user.id(), deck));
        }
        Flair3dMatch m = new Flair3dMatch();
        m.setUserId(user.id());
        m.setNucleo(n.codigo());
        m.setStatus(Flair3dMatch.ABERTA);
        m.setSemente(ThreadLocalRandom.current().nextLong(SEMENTE_MAX));
        m.setDeckJson(d.deck().semDeck() ? null : Json.write(deck));
        List<Avatares.Participante> participantes = d.avatares().participantes(user.id(), pedido == null ? null : pedido.avatar());
        m.setParticipantesJson(Json.write(participantes));
        m = matches.save(m);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("nucleo", m.getNucleo());
        out.put("status", m.getStatus());
        out.put("semente", m.getSemente());
        out.put("deck", d.deck().semDeck() ? null : deck);
        out.put("participantes", participantes);
        return out;
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
        return gravar(m, e, a, n.pontuar(e, contexto(user, m, n, e, a)));
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
        return gravar(m, e, a, n.pontuar(e, contexto(user, m, n, e, a)));
    }

    /** Prévia da entrega numa partida ABERTA: pontos e regras de agora, sem gravar nada nem contar tentativa. */
    @Transactional(readOnly = true)
    public Resultado previa(CurrentUser user, UUID partidaId, Entrega entrega) {
        Flair3dMatch m = partida(user, partidaId, Flair3dMatch.ABERTA);
        Flair3dNucleo n = nucleo(m.getNucleo());
        Entrega e = entrega == null ? new Entrega(null, null, null, null) : entrega;
        Andamento a = Andamento.ler(m.getEstadoJson()).proximaTentativa(Json.read(m.getEntregaJson(), Entrega.class));
        return n.previa(e, contexto(user, m, n, e, a)).comStatus(m.getStatus());
    }

    /** A partida da pessoa (404, 403) no status que a operação pede (409). */
    private Flair3dMatch partida(CurrentUser user, UUID partidaId, String status) {
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
    private Contexto contexto(CurrentUser user, Flair3dMatch m, Flair3dNucleo n, Entrega e, Andamento a) {
        List<UUID> usadas = new ArrayList<>(e.cartas().values());
        usadas.addAll(a.cartas());
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), usadas);
        Flair3dEntregas.conferir(n.definicao(), e, minhas, Flair3dDeck.ids(m.getDeckJson()), a.cartas());
        return cartas.contexto(minhas, m.getSemente()).comAndamento(a);
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
