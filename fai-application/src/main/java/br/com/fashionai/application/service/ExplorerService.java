package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * RF26 — Explorador Global: Painel global (globo por País, intensidade = hype médio), Buscar marcas & lojas (grade com
 * filtros de país, categoria, cor e ordenação por hype) e Insights globais (rankings + leitura textual pelo mesmo motor
 * de IA). Só cruza dados já coletados; nenhum campo novo além de User.country. Agregações de volume feitas no MySQL
 * (views e GROUP BY da V6).
 * <p>
 * RF53 (Lote 1 da auditoria de abas): Marcas & lojas e Insights globais leem o HypeScore v2 ({@code hype_scores}) só da
 * população pública ({@code publicEligible} + AVAILABLE) — o fallback {@code vw_brand_usage.avg_hype}, que tirava a média
 * de peças privadas também, saiu; grupos com menos de {@link #MIN_BRAND_ITEMS} itens públicos ficam sem valor ("—").
 * O painel global (globo) mostra volume por país; o Hype por país vem do {@code /api/hype/globe}. A limpeza do v1 (P3-16)
 * tirou daqui as faixas de juízo do RF6, o filtro {@code hypeBand}, o {@code hypeMin} e as médias de {@code hype_score}.
 */
@Service
public class ExplorerService {
    // Colaboradores por caso de uso (package-private, sem Spring): o serviço é a fachada transacional.
    final ExplorerGlobalPanel panel;
    final ExplorerHype hypes;
    final ExplorerBrandGrid brandGrid;
    final ExplorerInsights globalInsights;

    public ExplorerService(AnalyticsQueryPort analytics, BrandProfileRepository brands, SealBondRepository bonds, AiEngine ai,
                           HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, WardrobeItemRepository pieces, SchemeRepository schemes) {
        this.panel = new ExplorerGlobalPanel(analytics);
        this.hypes = new ExplorerHype(hypeScores, hypeConfig, pieces);
        this.brandGrid = new ExplorerBrandGrid(analytics, brands, bonds, hypes, hypeScores, hypeConfig, () -> catalog);
        this.globalInsights = new ExplorerInsights(analytics, ai, hypes, hypeScores, hypeConfig, schemes);
    }

    /** RF47 · marcas do catálogo global (opcional nos testes): entram na grade ao lado dos perfis BRAND. */
    private br.com.fashionai.application.catalog.CatalogService catalog;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setCatalog(br.com.fashionai.application.catalog.CatalogService catalog) {
        this.catalog = catalog;
    }

    /** Mínimo de peças + looks públicos para um país acender no globo (CA01 — "com dados suficientes"). */
    public static final int MIN_DATA = 3;
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry) {
        return globalPanel(viewer, selectedCountry, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry, String season, String color) {
        return panel.globalPanel(viewer, selectedCountry, season, color);
    }

    /** Buscar marcas & lojas — grade de cards (userType = BRAND) com filtros e ordenação por hype. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort) {
        return brandsAndStores(viewer, term, country, category, sort, null, null, null);
    }

    // ================================================================== HypeScore v2 agregado (RF53 · P1-04, P2-04)
    /** Itens públicos mínimos para um grupo (marca, cor, categoria, estação) ter Hype: um item sozinho não representa o grupo. */
    public static final int MIN_BRAND_ITEMS = 3;
    /** Hype da marca pelas peças (BRAND_GROUP): média dos N itens mais relevantes — a mesma régua do "Em alta" de marcas. */
    static final int BRAND_TOP_ITEMS = 5;
    /** Quantas linhas cada ranking de Insights mostra. */
    static final int RANKING_ROWS = 5;

    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort,
                                               String color, String season, String minLevel) {
        return brandGrid.brandsAndStores(viewer, term, country, category, sort, color, season, minLevel);
    }

    // ================================================================== Insights globais (RF26 + RF53 · P2-04)
    /** Insights globais — rankings + leitura textual (Insight Generator, RF24; fallback local). */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer) {
        return globalInsights.insights(viewer);
    }
}
