package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoPeca;
import br.com.fashionai.domain.repository.acervo.AcervoPecaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * ACERVO — peças no espaço: a árvore com as contagens e as fichas, mover uma ou várias peças de compartimento, anotar
 * medidas e o modo arrumação (o servidor propõe os movimentos sem gravar; só a confirmação grava).
 */
@Service
@Transactional
public class AcervoPecasService {
    public record MoverForm(List<UUID> pieceIds, UUID compartimentoId) { }
    public record MedidasForm(BigDecimal larguraCm, BigDecimal comprimentoCm, String nota) { }
    /** escopo: SEM_LUGAR (padrão) arruma só o que não tem lugar; TUDO revê todas as peças; pieceIds limita a seleção. */
    public record PreviaForm(String escopo, List<UUID> pieceIds) { }
    public record Movimento(UUID pieceId, UUID compartimentoId) { }
    public record ConfirmarForm(List<Movimento> movimentos) { }

    private static final BigDecimal MEDIDA_MAX = new BigDecimal("999.9");

    private final AcervoPecaRepository linhas;
    private final AcervoAcesso acesso;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AcervoPecasService(AcervoPecaRepository linhas, AcervoAcesso acesso) {
        this(linhas, acesso, Clock.systemDefaultZone());
    }

    AcervoPecasService(AcervoPecaRepository linhas, AcervoAcesso acesso, Clock clock) {
        this.linhas = linhas;
        this.acesso = acesso;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> arvore(CurrentUser user) {
        AcervoMapa mapa = acesso.mapa(user);
        LocalDate hoje = LocalDate.now(clock);
        Map<UUID, Long> porCompartimento = new HashMap<>();
        List<Map<String, Object>> fichas = new ArrayList<>();
        long semLugar = 0;
        for (WardrobeItem w : acesso.pecas(user)) {
            UUID lugar = mapa.lugar(w.getId());
            if (lugar == null) {
                semLugar++;
            } else {
                porCompartimento.merge(lugar, 1L, Long::sum);
            }
            fichas.add(AcervoViews.peca(w, mapa, hoje));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ambientes", AcervoViews.arvore(mapa, porCompartimento));
        out.put("pecas", fichas);
        out.put("total", fichas.size());
        out.put("semLugar", semLugar);
        return out;
    }

    /** Move uma ou várias peças para um compartimento; compartimento nulo deixa as peças sem lugar. */
    public Map<String, Object> mover(CurrentUser user, MoverForm form) {
        List<UUID> ids = ids(form == null ? null : form.pieceIds());
        AcervoCompartimento destino = acesso.destino(user, form.compartimentoId());
        List<WardrobeItem> pecas = ids.stream().map(id -> acesso.peca(user, id)).toList();
        UUID para = destino == null ? null : destino.getId();
        pecas.forEach(w -> gravar(user, w, para));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("movidas", pecas.size());
        out.put("compartimentoId", para);
        return out;
    }

    public Map<String, Object> medidas(CurrentUser user, UUID pieceId, MedidasForm form) {
        WardrobeItem w = acesso.peca(user, pieceId);
        AcervoPeca linha = linha(user, w);
        linha.setLarguraCm(medida("larguraCm", form == null ? null : form.larguraCm()));
        linha.setComprimentoCm(medida("comprimentoCm", form == null ? null : form.comprimentoCm()));
        linha.setMedidasNota(AcervoRegras.opcional(form == null ? null : form.nota(), 160));
        linhas.save(linha);
        return AcervoViews.medidas(linha);
    }

    /** Proposta de arrumação: nada é gravado. */
    @Transactional(readOnly = true)
    public Map<String, Object> previa(CurrentUser user, PreviaForm form) {
        AcervoMapa mapa = acesso.mapa(user);
        List<WardrobeItem> todas = acesso.pecas(user);
        List<WardrobeItem> escolhidas = escolhidas(todas, mapa, form);
        AcervoArrumacao.Plano plano = AcervoArrumacao.plano(escolhidas, todas, mapa);
        List<Map<String, Object>> movimentos = new ArrayList<>();
        for (AcervoArrumacao.Movimento m : plano.movimentos()) {
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("pieceId", m.peca().getId());
            linha.put("name", m.peca().getName());
            AcervoViews.imagemComCor(linha, m.peca());
            linha.put("de", lugar(mapa, m.de()));
            linha.put("para", lugar(mapa, m.para()));
            linha.put("motivo", Msg.t("acervo.arrumacao.motivo." + m.tipo().toLowerCase(java.util.Locale.ROOT)));
            movimentos.add(linha);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("movimentos", movimentos);
        out.put("semDestino", plano.semDestino().stream().map(WardrobeItem::getId).toList());
        out.put("analisadas", escolhidas.size());
        return out;
    }

    /** Grava os movimentos que a pessoa confirmou (os da prévia, ou os que ela ajustou). */
    public Map<String, Object> confirmar(CurrentUser user, ConfirmarForm form) {
        List<Movimento> movimentos = form == null || form.movimentos() == null ? List.of() : form.movimentos();
        if (movimentos.isEmpty() || movimentos.size() > AcervoRegras.MAX_PECAS_POR_PEDIDO) {
            throw ApiException.badRequest("ACERVO_SEM_PECAS", Msg.t("acervo.erro.sem_pecas"));
        }
        Map<WardrobeItem, UUID> validados = new LinkedHashMap<>();
        for (Movimento m : movimentos) {
            if (m == null || m.pieceId() == null) {
                throw ApiException.badRequest("ACERVO_SEM_PECAS", Msg.t("acervo.erro.sem_pecas"));
            }
            AcervoCompartimento destino = acesso.destino(user, m.compartimentoId());
            validados.put(acesso.peca(user, m.pieceId()), destino == null ? null : destino.getId());
        }
        validados.forEach((w, para) -> gravar(user, w, para));
        return Map.of("movidas", validados.size());
    }

    private static List<WardrobeItem> escolhidas(List<WardrobeItem> todas, AcervoMapa mapa, PreviaForm form) {
        if (form != null && form.pieceIds() != null && !form.pieceIds().isEmpty()) {
            Set<UUID> ids = new LinkedHashSet<>(form.pieceIds());
            return todas.stream().filter(w -> ids.contains(w.getId())).toList();
        }
        if (form != null && "TUDO".equals(form.escopo())) {
            return todas;
        }
        return todas.stream().filter(w -> mapa.lugar(w.getId()) == null).toList();
    }

    private static Map<String, Object> lugar(AcervoMapa mapa, UUID compartimentoId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("compartimentoId", compartimentoId);
        out.put("caminho", mapa.caminho(compartimentoId));
        return out;
    }

    private static List<UUID> ids(List<UUID> pieceIds) {
        Set<UUID> unicos = pieceIds == null ? Set.of() : new LinkedHashSet<>(pieceIds);
        unicos.remove(null);
        if (unicos.isEmpty() || unicos.size() > AcervoRegras.MAX_PECAS_POR_PEDIDO) {
            throw ApiException.badRequest("ACERVO_SEM_PECAS", Msg.t("acervo.erro.sem_pecas"));
        }
        return List.copyOf(unicos);
    }

    private static BigDecimal medida(String campo, BigDecimal valor) {
        if (valor == null) {
            return null;
        }
        if (valor.signum() <= 0 || valor.compareTo(MEDIDA_MAX) > 0) {
            String texto = Msg.t("acervo.erro.medida_peca");
            throw ApiException.badRequest("ACERVO_MEDIDA", texto, Map.of(campo, texto));
        }
        return valor.setScale(1, java.math.RoundingMode.HALF_UP);
    }

    private AcervoPeca linha(CurrentUser user, WardrobeItem w) {
        return linhas.findByPieceId(w.getId()).orElseGet(() -> {
            AcervoPeca nova = new AcervoPeca();
            nova.setUserId(user.id());
            nova.setPieceId(w.getId());
            return nova;
        });
    }

    private void gravar(CurrentUser user, WardrobeItem w, UUID compartimentoId) {
        AcervoPeca linha = linha(user, w);
        linha.setCompartimentoId(compartimentoId);
        linhas.save(linha);
    }
}
