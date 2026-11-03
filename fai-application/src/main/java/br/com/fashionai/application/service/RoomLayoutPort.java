package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomLayout;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Meu Quarto — a porta {@link FaiPointsService.RoomLayoutAccess} (RF35) da fachada {@link RoomService}: nível, layout
 * com os módulos liberados, módulos compatíveis e acabamentos da loja do quarto, e a leitura dos rótulos das gavetas.
 * Dona das mesmas transações de antes; o trabalho mora em {@link RoomFurniture} e {@link RoomModules}. Só o
 * {@link RoomService} a estende (o bean continua um só).
 */
public abstract class RoomLayoutPort implements FaiPointsService.RoomLayoutAccess {
    final RoomContext ctx;

    RoomLayoutPort(RoomContext ctx) {
        this.ctx = ctx;
    }

    // ================================================================== layout (FAI Origem → Maison)
    /** RF35 §5.3 — módulos do móvel por nível. O FAI Origem (Estreia) é propositalmente simples. */
    static List<Map<String, Object>> defaultModules(FaiPointsService.Level level) {
        return RoomModules.defaultModules(level);
    }

    public FaiPointsService.Level levelOf(UUID userId) {
        return ctx.furniture.levelOf(userId);
    }

    @Override
    @Transactional
    public RoomLayout layout(UUID userId) {
        return ctx.furniture.layout(userId);
    }

    Map<String, String> labels(RoomLayout layout) {
        return RoomModules.labels(layout);
    }

    Map<String, String> labelSources(RoomLayout layout) {
        return RoomModules.labelSources(layout);
    }

    // ------------------------------------------------------------------ RoomLayoutAccess (RF35)
    @Override
    @Transactional
    public void setLevel(UUID userId, String level) {
        ctx.furniture.setLevel(userId, level);
    }

    @Override
    public List<String> compatibleModules(UUID userId, RoomCatalogItem item) {
        return ctx.furniture.compatibleModules(userId, item);
    }

    @Override
    @Transactional
    public void applyFinish(UUID userId, String moduleId, RoomCatalogItem item) {
        ctx.furniture.applyFinish(userId, moduleId, item);
    }

    @Override
    @Transactional
    public void resetFinish(UUID userId, String moduleId, RoomCatalogItem item) {
        ctx.furniture.resetFinish(userId, moduleId, item);
    }
}
