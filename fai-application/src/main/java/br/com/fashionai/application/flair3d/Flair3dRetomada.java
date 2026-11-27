package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * "Continuar partida" (pedido da dona: a partida em andamento sobrevive a recarregar, sair e voltar, e sair da conta e
 * entrar de novo). O servidor já guarda tudo de cada partida (deck, semente, entregas, passos); aqui a tela recebe a mais
 * recente que ainda não fechou, como a abertura a devolveu, e o ponto em que ela estava, refeito da semente e do que foi
 * gravado, sem gravar nada:
 * <ul>
 *   <li>EM_ACAO (a ação começou: a investigação, a partida por cartas, a carta Especial): o resultado de agora;</li>
 *   <li>ABERTA com entregas (rodadas em etapas, o espelho do Labirinto): a última entrega como "tentativa", com a etapa
 *   da vez e as etapas já fechadas;</li>
 *   <li>ABERTA sem entrega, nos jogos com deck: o deck já escolhido e o look que estava em montagem
 *   ({@link Flair3dRascunho}), para voltar à preparação com as peças nas vagas.</li>
 * </ul>
 * A resposta diz também o que está guardado ({@code salvo}) e quando ({@code atualizadaEm}).
 * Só a partida da própria pessoa; partida fechada (ENTREGUE) não volta.
 */
@Service
public class Flair3dRetomada {
    private final Flair3dMatchRepository matches;
    private final Flair3dNucleoService nucleos;

    public Flair3dRetomada(Flair3dMatchRepository matches, Flair3dNucleoService nucleos) {
        this.matches = matches;
        this.nucleos = nucleos;
    }

    /** A partida mais recente da pessoa neste núcleo que ainda pode continuar, ou vazio. */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> emAndamento(CurrentUser user, String codigo) {
        Flair3dNucleo n = Flair3dNucleoService.nucleo(codigo);
        return matches.findByUserIdAndNucleo(user.id(), n.codigo()).stream()
                .filter(Flair3dRetomada::continuavel)
                .max(Comparator.comparing(Flair3dRetomada::quando))
                .map(m -> semCartasPerdidas(() -> retomada(user, n, m)));
    }

    /** Uma carta da partida saiu do guarda-roupa (trocada, excluída): a partida não tem como continuar e não é oferecida. */
    private static Map<String, Object> semCartasPerdidas(java.util.function.Supplier<Map<String, Object>> retomada) {
        try {
            return retomada.get();
        } catch (br.com.fashionai.application.common.ApiException naoVale) {
            return null;
        }
    }

    static boolean continuavel(Flair3dMatch m) {
        if (Flair3dMatch.EM_ACAO.equals(m.getStatus())) {
            return m.getEntregaJson() != null;
        }
        return Flair3dMatch.ABERTA.equals(m.getStatus()) && (m.getEntregaJson() != null || m.getDeckJson() != null);
    }

    private static Instant quando(Flair3dMatch m) {
        Instant t = m.getUpdatedAt() != null ? m.getUpdatedAt() : m.getCreatedAt();
        return t != null ? t : Instant.EPOCH;
    }

    private Map<String, Object> retomada(CurrentUser user, Flair3dNucleo n, Flair3dMatch m) {
        Entrega e = m.getEntregaJson() == null ? null : Json.read(m.getEntregaJson(), Entrega.class);
        Andamento a = Andamento.ler(m.getEstadoJson());
        Contexto contexto = nucleos.contexto(user, m, n, e == null ? new Entrega(null, null, null, null) : e, a);
        Map<String, Object> partida = new LinkedHashMap<>();
        partida.put("id", m.getId());
        partida.put("nucleo", m.getNucleo());
        partida.put("status", m.getStatus());
        partida.put("semente", m.getSemente());
        partida.put("deck", m.getDeckJson() == null ? null : Flair3dDeck.ids(m.getDeckJson()));
        partida.put("participantes", m.getParticipantesJson() == null ? List.of() : Json.list(m.getParticipantesJson()));
        partida.put("rodada", a.rodada());
        partida.put("abertura", n.abertura(contexto));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("partida", partida);
        out.put("vestidas", e == null ? null : e.cartas());
        Resultado agora = e == null ? null : n.pontuar(e, contexto).comStatus(m.getStatus());
        out.put("resultado", Flair3dMatch.EM_ACAO.equals(m.getStatus()) ? agora : null);
        out.put("tentativa", Flair3dMatch.ABERTA.equals(m.getStatus()) ? agora : null);
        Entrega rascunho = Flair3dMatch.ABERTA.equals(m.getStatus()) ? Flair3dRascunho.doAndamento(a, Flair3dDeck.ids(m.getDeckJson())) : null;
        out.put("rascunho", rascunho);
        out.put("salvo", Flair3dRascunho.salvo(m, e, a, rascunho));
        out.put("atualizadaEm", quando(m).toString());
        return out;
    }
}
