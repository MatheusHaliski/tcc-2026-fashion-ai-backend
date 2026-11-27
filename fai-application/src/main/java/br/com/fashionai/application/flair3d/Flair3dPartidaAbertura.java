package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Abertura de uma partida do FLAIR 3D (ponto de extensão tirado de {@link Flair3dNucleoService}, PLANO A1/P0): confere o
 * deck (422), grava semente, rodada e participantes e devolve a abertura do núcleo. A semente vem de fora: sorteada na
 * partida solo e a da sala na partida multiplayer assíncrona (os dois lados jogam o mesmo sorteio).
 */
final class Flair3dPartidaAbertura {
    private final Flair3dMatchRepository matches;
    private final Flair3dCartas cartas;

    Flair3dPartidaAbertura(Flair3dMatchRepository matches, Flair3dCartas cartas) {
        this.matches = matches;
        this.cartas = cartas;
    }

    Map<String, Object> abrir(CurrentUser user, Flair3dNucleo n, Flair3dNucleoService.AbrirPartida pedido, long semente) {
        Definicao d = n.definicao();
        List<UUID> deck = pedido == null || pedido.deck() == null ? List.of() : pedido.deck().stream().filter(Objects::nonNull).toList();
        if (!d.deck().semDeck()) {
            Flair3dDeck.validar(d.deck(), deck, cartas.daPessoa(user.id(), deck));
        }
        Flair3dMatch m = new Flair3dMatch();
        m.setUserId(user.id());
        m.setNucleo(n.codigo());
        m.setStatus(Flair3dMatch.ABERTA);
        m.setSemente(semente);
        m.setDeckJson(d.deck().semDeck() ? null : Json.write(deck));
        String rodada = rodadaPedida(d, pedido == null ? null : pedido.rodada());
        m.setEstadoJson(rodada == null ? null : Json.write(Andamento.naRodada(rodada)));
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
        out.put("rodada", rodada);
        out.put("abertura", n.abertura(cartas.contexto(cartas.daPessoa(user.id(), deck), m.getSemente()).naRodada(rodada)));
        return out;
    }

    /** A rodada pedida, quando o jogo a tem (422 RODADA_INVALIDA); sem pedido, nula: vale o objetivo mais simples. */
    static String rodadaPedida(Definicao d, String pedida) {
        if (pedida == null || pedida.isBlank()) {
            return null;
        }
        return d.rodada(pedida.trim()).map(Definicao.Rodada::codigo)
                .orElseThrow(() -> Flair3dErros.invalido("RODADA_INVALIDA", "rodada_invalida"));
    }
}
