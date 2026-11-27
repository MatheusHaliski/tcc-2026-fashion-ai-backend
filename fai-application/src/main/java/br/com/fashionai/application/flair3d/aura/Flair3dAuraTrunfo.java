package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Andamento.TrunfoDeHype;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoUso;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * O trunfo do Hype (POST /api/flair/3d/partidas/{id}/hype): a pessoa chama, uma vez por partida, o Hype de uma carta do
 * deck — o destaque na foto final, ou, na Batalha de Looks, a plateia na rodada da vez e o voto no empate. Só o
 * servidor decide: a partida é da pessoa (403) e não fechou (409), o jogo tem Aura na partida, a carta está no deck
 * (422), tem Hype Relevante ou mais (422 HYPE_SEM_FORCA) e o trunfo ainda não foi chamado (422 HYPE_JA_CHAMADO; o mesmo
 * pedido repetido devolve a mesma resposta). O Hype real da carta não muda: nada é gasto, gravado nem publicado nele.
 */
@Service
public class Flair3dAuraTrunfo {
    private final Flair3dMatchRepository matches;
    private final Flair3dCartas cartas;

    public Flair3dAuraTrunfo(Flair3dMatchRepository matches, Flair3dCartas cartas) {
        this.matches = matches;
        this.cartas = cartas;
    }

    public record PedidoDeTrunfo(UUID carta, String pedido) {
    }

    @Transactional
    public Map<String, Object> chamar(CurrentUser user, UUID partidaId, PedidoDeTrunfo pedido) {
        Flair3dMatch m = matches.findById(partidaId)
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PARTIDA_NAO_ENCONTRADA", "partida_nao_encontrada"));
        if (!m.getUserId().equals(user.id())) {
            throw new ApiException(403, "PARTIDA_DE_OUTRA_PESSOA", Msg.t("flair3d.erro.partida_de_outra_pessoa"));
        }
        if (Flair3dMatch.ENTREGUE.equals(m.getStatus())) {
            throw ApiException.conflict("PARTIDA_JA_ENTREGUE", Msg.t("flair3d.erro.partida_ja_entregue"));
        }
        if (pedido == null || pedido.carta() == null || pedido.pedido() == null || pedido.pedido().isBlank() || !Flair3dAuraRegras.noJogo(m.getNucleo())) {
            throw Flair3dErros.invalido("USO_INVALIDO", "uso_invalido");
        }
        Andamento a = Andamento.ler(m.getEstadoJson());
        if (a.hype() != null) {
            if (a.hype().pedido().equals(pedido.pedido())) {
                return resposta(a.hype(), carta(user, a.hype().carta()));
            }
            throw Flair3dErros.invalido("HYPE_JA_CHAMADO", "hype_ja_chamado");
        }
        if (!Flair3dRecursoUso.usaveis(m, a).contains(pedido.carta())) {
            throw Flair3dErros.invalido("CARTA_FORA_DO_DECK", "carta_fora_do_deck");
        }
        CbcRules.Card carta = carta(user, pedido.carta());
        if (!Flair3dAuraRegras.podeSerTrunfo(carta)) {
            throw Flair3dErros.invalido("HYPE_SEM_FORCA", "hype_sem_forca");
        }
        TrunfoDeHype trunfo = new TrunfoDeHype(pedido.carta(), pedido.pedido(), Flair3dRecursoUso.etapaDeAgora(m, a));
        m.setEstadoJson(Json.write(a.comHype(trunfo)));
        matches.save(m);
        return resposta(trunfo, carta);
    }

    private CbcRules.Card carta(CurrentUser user, UUID id) {
        return cartas.daPessoa(user.id(), List.of(id)).get(id);
    }

    /** {hype:{carta, faixa, bonus, etapa}}. */
    static Map<String, Object> resposta(TrunfoDeHype t, CbcRules.Card carta) {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("carta", t.carta());
        h.put("faixa", Flair3dHype.bandOf(carta).name());
        h.put("bonus", Flair3dAuraRegras.trunfo(carta));
        h.put("etapa", t.etapa());
        return Map.of("hype", h);
    }
}
