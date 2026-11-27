package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * O look em montagem de uma partida ABERTA, guardado no servidor (no andamento da partida, sem tabela nova): quem sai no
 * meio da preparação e volta, em qualquer aparelho, reencontra as peças nas vagas, a resposta escolhida e as zonas
 * pintadas. Só o dono grava (403), só com a partida aberta (409) e só com cartas dele e do deck (422). Não conta
 * tentativa nem muda a nota; a entrega seguinte descarta o rascunho.
 */
@Service
public class Flair3dRascunho {
    private final Flair3dMatchRepository matches;
    private final Flair3dNucleoService nucleos;

    public Flair3dRascunho(Flair3dMatchRepository matches, Flair3dNucleoService nucleos) {
        this.matches = matches;
        this.nucleos = nucleos;
    }

    /** Guarda o look de agora (vazio apaga) e devolve o que ficou salvo e quando: {salvoEm, pecas}. */
    @Transactional
    public Map<String, Object> guardar(CurrentUser user, UUID partidaId, Entrega look) {
        Flair3dMatch m = nucleos.partida(user, partidaId, Flair3dMatch.ABERTA);
        Entrega e = look == null ? new Entrega(null, null, null, null) : look;
        Andamento a = Andamento.ler(m.getEstadoJson());
        nucleos.contexto(user, m, Flair3dNucleoService.nucleo(m.getNucleo()), e, a);
        m.setEstadoJson(Json.write(a.comRascunho(vazio(e) ? null : e)));
        matches.save(m);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("salvoEm", Instant.now().toString());
        out.put("pecas", e.cartas().size());
        return out;
    }

    static boolean vazio(Entrega e) {
        return e.cartas().isEmpty() && e.zonas().isEmpty() && e.maquiagem().isEmpty() && (e.resposta() == null || e.resposta().isBlank());
    }

    /** O rascunho gravado que ainda vale: todas as cartas dele continuam no deck da partida (senão, nulo). */
    static Entrega doAndamento(Andamento a, List<UUID> deck) {
        Entrega r = a.rascunho();
        if (r == null || (!deck.isEmpty() && !deck.containsAll(r.cartas().values()))) {
            return null;
        }
        return r;
    }

    /** O que o servidor tem guardado da partida, em números, para a tela dizer ("deck de 8 cartas, look com 3 peças"). */
    static Map<String, Object> salvo(Flair3dMatch m, Entrega entregue, Andamento a, Entrega rascunho) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deck", Flair3dDeck.ids(m.getDeckJson()).size());
        out.put("look", entregue == null ? 0 : entregue.cartas().size());
        out.put("etapas", a.anteriores().size());
        out.put("passos", a.acionamentos().size());
        out.put("rascunho", rascunho == null ? 0 : rascunho.cartas().size());
        return out;
    }
}
