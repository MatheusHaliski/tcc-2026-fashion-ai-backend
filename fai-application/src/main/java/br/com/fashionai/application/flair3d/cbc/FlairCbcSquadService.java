package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairCbcSquadEntrega;
import br.com.fashionai.domain.repository.FlairCbcSquadEntregaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR Card Building Challenge — os cinco elencos (BASE_NUCLEOS.md). Contexto do Strategy {@link FlairCbcElenco}: lista,
 * formação, conferir (cartas da pessoa, 422) e entrega (422 com requisito falhando), com a edição pela ordem de conclusão
 * do elenco; repetir não cria nova edição.
 */
@Service
public class FlairCbcSquadService {
    public record Pedido(Map<String, UUID> cartas) {
    }

    private final FlairCbcSquadEntregaRepository entregas;
    private final Flair3dCartas cartas;

    public FlairCbcSquadService(FlairCbcSquadEntregaRepository entregas, Flair3dCartas cartas) {
        this.entregas = entregas;
        this.cartas = cartas;
    }

    static FlairCbcElenco elenco(String codigo) {
        return FlairCbcElencos.porCodigo(codigo).orElseThrow(() -> Flair3dErros.naoEncontrado("ELENCO_NAO_ENCONTRADO", "elenco_nao_encontrado"));
    }

    /** {elencos:[{codigo, vagas, linhas, concluido, edicao}]}: vagas e linhas são contagens; edição da pessoa ou nula. */
    @Transactional(readOnly = true)
    public Map<String, Object> lista(CurrentUser user) {
        Map<String, Integer> edicoes = new LinkedHashMap<>();
        for (FlairCbcSquadEntrega e : entregas.findByUserId(user.id())) {
            if (e.isOk() && e.getEdicao() != null) {
                edicoes.merge(e.getElenco(), e.getEdicao(), Math::min);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairCbcElenco e : FlairCbcElencos.TODOS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo", e.codigo());
            m.put("vagas", e.vagas().size());
            m.put("linhas", e.linhas().size());
            m.put("concluido", edicoes.containsKey(e.codigo()));
            m.put("edicao", edicoes.get(e.codigo()));
            out.add(m);
        }
        return Map.of("elencos", out);
    }

    /** {codigo, vagas:[{chave, posicao, coluna, linha}], linhas:[{a, b}], requisitos:[{tipo, alvo, ...}]}. */
    public Map<String, Object> formacao(String codigo) {
        FlairCbcElenco e = elenco(codigo);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("codigo", e.codigo());
        out.put("vagas", e.vagas());
        out.put("linhas", e.linhas().stream().map(l -> Map.of("a", l.a(), "b", l.b())).toList());
        out.put("requisitos", e.requisitosCompletos().stream().map(FlairCbcElenco.Requisito::toMap).toList());
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> conferir(CurrentUser user, String codigo, Pedido pedido) {
        FlairCbcElenco e = elenco(codigo);
        return FlairCbcAvaliacao.conferir(e, tabuleiro(user, e, pedido));
    }

    /** Entrega: 422 se algum requisito falha; grava e devolve o resultado com a edição (a da 1ª conclusão, se repetir). */
    @Transactional
    public Map<String, Object> entregar(CurrentUser user, String codigo, Pedido pedido) {
        FlairCbcElenco e = elenco(codigo);
        Map<String, Object> out = FlairCbcAvaliacao.conferir(e, tabuleiro(user, e, pedido));
        if (!Boolean.TRUE.equals(out.get("ok"))) {
            throw Flair3dErros.invalido("REQUISITOS_NAO_CUMPRIDOS", "requisitos_nao_cumpridos", Map.of("requisitos", out.get("requisitos")));
        }
        int edicao = entregas.findFirstByUserIdAndElencoAndOkTrueOrderByCreatedAtAsc(user.id(), e.codigo())
                .map(FlairCbcSquadEntrega::getEdicao)
                .orElseGet(() -> entregas.findFirstByElencoAndOkTrueOrderByEdicaoDesc(e.codigo())
                        .map(FlairCbcSquadEntrega::getEdicao).orElse(0) + 1);
        FlairCbcSquadEntrega nova = new FlairCbcSquadEntrega();
        nova.setUserId(user.id());
        nova.setElenco(e.codigo());
        nova.setCartasJson(Json.write(pedido.cartas()));
        nova.setQuimica((Integer) out.get("quimica"));
        nova.setOk(true);
        nova.setEdicao(edicao);
        entregas.save(nova);
        out.put("edicao", edicao);
        return out;
    }

    /** Cartas por vaga, todas da pessoa (422), em vagas do elenco e sem repetir carta (422). */
    Map<String, CbcRules.Card> tabuleiro(CurrentUser user, FlairCbcElenco e, Pedido pedido) {
        Map<String, UUID> pedidas = pedido == null || pedido.cartas() == null ? Map.of() : pedido.cartas();
        Set<String> vagas = new HashSet<>();
        e.vagas().forEach(v -> vagas.add(v.chave()));
        List<String> problemas = new ArrayList<>();
        Set<UUID> vistas = new HashSet<>();
        pedidas.forEach((vaga, id) -> {
            if (!vagas.contains(vaga)) {
                problemas.add("VAGA:" + vaga);
            }
            if (id != null && !vistas.add(id)) {
                problemas.add("REPETIDA:" + vaga);
            }
        });
        if (!problemas.isEmpty()) {
            throw Flair3dErros.invalido("ENTREGA_INVALIDA", "entrega_invalida", Map.of("problemas", problemas));
        }
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), pedidas.values());
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        pedidas.forEach((vaga, id) -> {
            if (id != null) {
                board.put(vaga, minhas.get(id));
            }
        });
        return board;
    }
}
