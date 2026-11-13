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
 * entrega e delega a pontuação ao núcleo. A partida é entregue uma vez só (409 na segunda).
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

    /** O efeito de cada carta da pessoa neste núcleo: {efeitos:[{cardId, itens:[{codigo, valor}]}]}. */
    @Transactional(readOnly = true)
    public Map<String, Object> efeitos(CurrentUser user, String codigo, PedidoEfeitos pedido) {
        Flair3dNucleo n = nucleo(codigo);
        List<UUID> ids = pedido == null || pedido.cartas() == null ? List.of() : pedido.cartas();
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), ids);
        Contexto ctx = new Contexto(minhas, cartas.paises(), null);
        List<Map<String, Object>> out = new ArrayList<>();
        minhas.forEach((id, carta) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cardId", id);
            m.put("itens", n.efeitos(carta, ctx));
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

    /** Entrega e pontua: só o dono (403), uma vez (409), cartas da pessoa e do deck nas vagas do núcleo (422). */
    @Transactional
    public Resultado entregar(CurrentUser user, UUID partidaId, Entrega entrega) {
        Flair3dMatch m = matches.findById(partidaId)
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PARTIDA_NAO_ENCONTRADA", "partida_nao_encontrada"));
        if (!m.getUserId().equals(user.id())) {
            throw new ApiException(403, "PARTIDA_DE_OUTRA_PESSOA", Msg.t("flair3d.erro.partida_de_outra_pessoa"));
        }
        if (!Flair3dMatch.ABERTA.equals(m.getStatus())) {
            throw ApiException.conflict("PARTIDA_JA_ENTREGUE", Msg.t("flair3d.erro.partida_ja_entregue"));
        }
        Flair3dNucleo n = nucleo(m.getNucleo());
        Entrega e = entrega == null ? new Entrega(null, null, null, null) : entrega;
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), e.cartas().values());
        Flair3dEntregas.conferir(n.definicao(), e, minhas, Flair3dDeck.ids(m.getDeckJson()));
        Resultado r = n.pontuar(e, cartas.contexto(minhas, m.getSemente()));
        m.setStatus(Flair3dMatch.ENTREGUE);
        m.setEntregaJson(Json.write(e));
        m.setResultadoJson(Json.write(r));
        m.setPontos(r.pontos());
        m.setEstrelas(r.estrelas());
        matches.save(m);
        return r;
    }
}
