package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dDeck;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDaPeca;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Usar uma peça do deck como recurso (POST /api/flair/3d/partidas/{id}/usar). Só o servidor decide: a partida é da
 * pessoa e não fechou; a carta é dela e está no deck da partida (nos jogos sem deck, como o Road to Glory, entre as
 * vestidas na partida: o look entregue ou o rascunho guardado); ainda tem uso (a raridade dá 1 ou 2 por partida); o
 * mesmo pedido repetido (rede lenta, clique duplo) devolve a mesma resposta sem gastar de novo. A quantidade sai da
 * tabela peça-recurso, nunca do cliente.
 */
@Service
public class Flair3dRecursoUso {
    private final Flair3dMatchRepository matches;
    private final Flair3dCartas cartas;

    public Flair3dRecursoUso(Flair3dMatchRepository matches, Flair3dCartas cartas) {
        this.matches = matches;
        this.cartas = cartas;
    }

    /** Corpo do pedido: a carta e um identificador do pedido, gerado pela tela a cada toque. */
    public record PedidoDeUso(UUID carta, String pedido) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> estado(CurrentUser user, UUID partidaId) {
        Flair3dMatch m = daPessoa(user, partidaId);
        Andamento a = Andamento.ler(m.getEstadoJson());
        return resposta(m, a, null);
    }

    @Transactional
    public Map<String, Object> usar(CurrentUser user, UUID partidaId, PedidoDeUso pedido) {
        Flair3dMatch m = daPessoa(user, partidaId);
        if (Flair3dMatch.ENTREGUE.equals(m.getStatus())) {
            throw ApiException.conflict("PARTIDA_JA_ENTREGUE", Msg.t("flair3d.erro.partida_ja_entregue"));
        }
        if (pedido == null || pedido.carta() == null || pedido.pedido() == null || pedido.pedido().isBlank()) {
            throw Flair3dErros.invalido("USO_INVALIDO", "uso_invalido");
        }
        Andamento a = Andamento.ler(m.getEstadoJson());
        Optional<UsoDeRecurso> repetido = a.usos().stream().filter(u -> u.pedido().equals(pedido.pedido())).findFirst();
        if (repetido.isPresent()) {
            return resposta(m, a, repetido.get());
        }
        CbcRules.Card carta = usaveis(m, a).contains(pedido.carta()) ? cartas.daPessoa(user.id(), List.of(pedido.carta())).get(pedido.carta()) : null;
        if (carta == null) {
            throw Flair3dErros.invalido("CARTA_FORA_DO_DECK", "carta_fora_do_deck");
        }
        PerfilDaPeca perfil = Flair3dRecursoCalculo.daCarta(carta, null);
        if (Flair3dRecursoEstado.usosDa(pedido.carta(), a.usos()) >= perfil.usos()) {
            throw Flair3dErros.invalido("SEM_USOS", "sem_usos");
        }
        UsoDeRecurso uso = new UsoDeRecurso(pedido.carta(), perfil.recurso().name(), perfil.quantidade(), pedido.pedido(),
                a.acionamentos().size(), etapaDeAgora(m, a));
        Andamento depois = a.comUso(uso);
        m.setEstadoJson(Json.write(depois));
        matches.save(m);
        return resposta(m, depois, uso);
    }

    /**
     * A etapa em que o uso vale: quantas entregas a partida já fechou. Na rodada em etapas que segue ABERTA (a Batalha, a
     * Boutique), a última entrega ainda não entrou nas anteriores do andamento, mas já passou: o uso é da etapa seguinte.
     */
    public static int etapaDeAgora(Flair3dMatch m, Andamento a) {
        boolean jaEntregou = Flair3dMatch.ABERTA.equals(m.getStatus()) && a.tentativas() > 0 && m.getEntregaJson() != null;
        return a.anteriores().size() + (jaEntregou ? 1 : 0);
    }

    /** {recursos, uso:{carta, recurso, quantidade, antes, depois}, usados:{cardId: n}}. */
    private static Map<String, Object> resposta(Flair3dMatch m, Andamento a, UsoDeRecurso uso) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("recursos", Flair3dRecursoEstado.paraTela(Flair3dRecursoEstado.de(a.usos())));
        if (uso != null) {
            int i = a.usos().indexOf(uso);
            EnumMap<Recurso, Integer> antes = Flair3dRecursoEstado.de(a.usos().subList(0, i));
            Recurso r = Recurso.valueOf(uso.recurso());
            Map<String, Object> u = new LinkedHashMap<>();
            u.put("carta", uso.carta());
            u.put("recurso", uso.recurso());
            u.put("quantidade", uso.quantidade());
            u.put("antes", antes.get(r));
            u.put("depois", Flair3dRecursoEstado.de(a.usos().subList(0, i + 1)).get(r));
            out.put("uso", u);
        }
        Map<String, Long> usados = new LinkedHashMap<>();
        for (UUID id : usaveis(m, a)) usados.put(id.toString(), Flair3dRecursoEstado.usosDa(id, a.usos()));
        out.put("usados", usados);
        return out;
    }

    /**
     * As cartas que dá para usar: as do deck; no jogo sem deck (o Road to Glory veste do guarda-roupa inteiro), as que
     * a pessoa vestiu na partida — o look entregue e o rascunho guardado. A carta de outra pessoa cai depois, no dono.
     */
    public static List<UUID> usaveis(Flair3dMatch m, Andamento a) {
        List<UUID> deck = Flair3dDeck.ids(m.getDeckJson());
        if (!deck.isEmpty()) {
            return deck;
        }
        Set<UUID> vestidas = new LinkedHashSet<>();
        Entrega entregue = Json.read(m.getEntregaJson(), Entrega.class);
        if (entregue != null) {
            vestidas.addAll(entregue.cartas().values());
        }
        if (a.rascunho() != null) {
            vestidas.addAll(a.rascunho().cartas().values());
        }
        vestidas.remove(null);
        return List.copyOf(vestidas);
    }

    private Flair3dMatch daPessoa(CurrentUser user, UUID partidaId) {
        Flair3dMatch m = matches.findById(partidaId)
                .orElseThrow(() -> Flair3dErros.naoEncontrado("PARTIDA_NAO_ENCONTRADA", "partida_nao_encontrada"));
        if (!m.getUserId().equals(user.id())) {
            throw new ApiException(403, "PARTIDA_DE_OUTRA_PESSOA", Msg.t("flair3d.erro.partida_de_outra_pessoa"));
        }
        return m;
    }
}
