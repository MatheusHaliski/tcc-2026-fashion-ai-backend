package br.com.fashionai.application.acervo;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.acervo.AcervoDesejoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * ACERVO — consultas, todas só de leitura e só sobre o que é da pessoa: painel financeiro, busca espacial, mapa de uso
 * e looks vinculados a uma peça.
 */
@Service
@Transactional(readOnly = true)
public class AcervoConsultaService {
    static final int DIAS_PADRAO = 180;
    static final int DIAS_MIN = 30;
    static final int DIAS_MAX = 730;

    private final AcervoAcesso acesso;
    private final AcervoDesejoRepository desejos;
    private final SchemeItemRepository itensDeLook;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AcervoConsultaService(AcervoAcesso acesso, AcervoDesejoRepository desejos, SchemeItemRepository itensDeLook) {
        this(acesso, desejos, itensDeLook, Clock.systemDefaultZone());
    }

    AcervoConsultaService(AcervoAcesso acesso, AcervoDesejoRepository desejos, SchemeItemRepository itensDeLook, Clock clock) {
        this.acesso = acesso;
        this.desejos = desejos;
        this.itensDeLook = itensDeLook;
        this.clock = clock;
    }

    /** Valor do acervo, por grupo, subtotal das peças selecionadas, lista de desejos (estimada) e custo por uso. */
    public Map<String, Object> financeiro(CurrentUser user, List<UUID> selecao) {
        List<WardrobeItem> pecas = acesso.pecas(user);
        Set<UUID> escolhidas = selecao == null ? Set.of() : new HashSet<>(selecao);
        return AcervoFinanceiro.resumo(pecas, escolhidas, desejos.findByUserIdOrderByCreatedAtDesc(user.id()));
    }

    /** Peças que batem com o texto e os compartimentos onde elas estão. */
    public Map<String, Object> busca(CurrentUser user, String texto) {
        AcervoMapa mapa = acesso.mapa(user);
        LocalDate hoje = LocalDate.now(clock);
        List<String> termos = AcervoBusca.termos(texto);
        List<Map<String, Object>> achadas = new ArrayList<>();
        Map<UUID, Integer> porCompartimento = new LinkedHashMap<>();
        int semLugar = 0;
        for (WardrobeItem w : acesso.pecas(user)) {
            if (!AcervoBusca.casa(w, termos)) {
                continue;
            }
            achadas.add(AcervoViews.peca(w, mapa, hoje));
            UUID lugar = mapa.lugar(w.getId());
            if (lugar == null) {
                semLugar++;
            } else {
                porCompartimento.merge(lugar, 1, Integer::sum);
            }
        }
        List<Map<String, Object>> compartimentos = new ArrayList<>();
        porCompartimento.forEach((id, quantas) -> {
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("id", id);
            linha.put("caminho", mapa.caminho(id));
            linha.put("pecas", quantas);
            compartimentos.add(linha);
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("termos", termos);
        out.put("pecas", achadas);
        out.put("compartimentos", compartimentos);
        out.put("semLugar", semLugar);
        return out;
    }

    /**
     * Mapa de uso: peça "esquecida" foi usada, mas não nos últimos {@code dias}; "nunca usada" não tem uso registrado;
     * "sem look" não entra em nenhum look da pessoa. Cada compartimento traz quantas peças paradas guarda.
     */
    public Map<String, Object> uso(CurrentUser user, Integer dias) {
        int janela = Math.max(DIAS_MIN, Math.min(DIAS_MAX, dias == null ? DIAS_PADRAO : dias));
        AcervoMapa mapa = acesso.mapa(user);
        LocalDate hoje = LocalDate.now(clock);
        List<WardrobeItem> pecas = acesso.pecas(user);
        Set<UUID> emLooks = new HashSet<>();
        if (!pecas.isEmpty()) {
            itensDeLook.findByWardrobeItemIdIn(pecas.stream().map(WardrobeItem::getId).toList())
                    .forEach(i -> emLooks.add(i.getWardrobeItem().getId()));
        }
        List<Map<String, Object>> linhas = new ArrayList<>();
        Map<UUID, int[]> porCompartimento = new LinkedHashMap<>();
        for (WardrobeItem w : pecas) {
            boolean nunca = w.getLastWornDate() == null;
            Long semUso = nunca ? null : ChronoUnit.DAYS.between(w.getLastWornDate(), hoje);
            boolean esquecida = !nunca && semUso > janela;
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("id", w.getId());
            linha.put("diasSemUso", semUso);
            linha.put("nuncaUsada", nunca);
            linha.put("esquecida", esquecida);
            linha.put("semLook", !emLooks.contains(w.getId()));
            linhas.add(linha);
            UUID lugar = mapa.lugar(w.getId());
            if (lugar != null) {
                int[] conta = porCompartimento.computeIfAbsent(lugar, k -> new int[3]);
                conta[0]++;
                conta[1] += esquecida ? 1 : 0;
                conta[2] += nunca ? 1 : 0;
            }
        }
        List<Map<String, Object>> compartimentos = new ArrayList<>();
        porCompartimento.forEach((id, conta) -> {
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("id", id);
            linha.put("pecas", conta[0]);
            linha.put("esquecidas", conta[1]);
            linha.put("nuncaUsadas", conta[2]);
            compartimentos.add(linha);
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dias", janela);
        out.put("pecas", linhas);
        out.put("compartimentos", compartimentos);
        return out;
    }

    /** Looks da pessoa que usam a peça, com o lugar de cada item do look. */
    public List<Map<String, Object>> looks(CurrentUser user, UUID pieceId) {
        WardrobeItem peca = acesso.peca(user, pieceId);
        AcervoMapa mapa = acesso.mapa(user);
        Map<UUID, Scheme> looks = new LinkedHashMap<>();
        for (SchemeItem item : itensDeLook.findByWardrobeItemId(peca.getId())) {
            Scheme s = item.getScheme();
            if (s.getUser().getId().equals(user.id()) && s.getStatus() != SchemeStatus.ARCHIVED) {
                looks.putIfAbsent(s.getId(), s);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Scheme s : looks.values()) {
            List<Map<String, Object>> itens = new ArrayList<>();
            for (SchemeItem item : itensDeLook.findBySchemeIdOrderBySortOrder(s.getId())) {
                WardrobeItem w = item.getWardrobeItem();
                boolean minha = w.getUser().getId().equals(user.id());
                UUID lugar = minha ? mapa.lugar(w.getId()) : null;
                Map<String, Object> linha = new LinkedHashMap<>();
                linha.put("pieceId", w.getId());
                linha.put("name", w.getName());
                linha.put("thumbnailUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
                linha.put("minha", minha);
                linha.put("compartimentoId", lugar);
                linha.put("caminho", mapa.caminho(lugar));
                itens.add(linha);
            }
            Map<String, Object> look = new LinkedHashMap<>();
            look.put("id", s.getId());
            look.put("title", s.getTitle());
            look.put("itens", itens);
            out.add(look);
        }
        return out;
    }
}
