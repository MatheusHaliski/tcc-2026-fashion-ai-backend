package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.BackgroundAnimation;
import br.com.fashionai.domain.repository.AssetPresetRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * Animação do fundo ao salvar o Studio: o layout Cartela sazonal limpa a animação dele ao sair (e "Sem animação" a
 * desliga) mandando {@code animation: null}. Sem gravar NONE, a animação antiga ficava na entidade e o Views.scheme a
 * devolvia — a neve voltava ao card depois de salvar.
 */
class BackgroundStudioAnimationTest {
    private final BackgroundStudioService service = new BackgroundStudioService(mock(AssetCatalogService.class), mock(AssetPresetRepository.class),
            mock(SchemeRepository.class), mock(WardrobeItemRepository.class), mock(UserRepository.class), mock(CelebrityProfileRepository.class),
            List.of(), mock(AiEngine.class), mock(MediaService.class), mock(Guard.class));

    private static Scheme withSnow() {
        Scheme s = new Scheme();
        s.setBackgroundAnimationType(BackgroundAnimation.SNOW);
        return s;
    }

    @Test
    void animacaoNulaExplicitaDesligaAAnimacaoGravada() {
        Scheme s = withSnow();
        Map<String, Object> config = new HashMap<>();
        config.put("animation", null);
        service.applyToScheme(s, config, false);
        assertEquals(BackgroundAnimation.NONE, s.getBackgroundAnimationType());
    }

    @Test
    void noneTambemDesligaEUmaNovaAnimacaoSubstitui() {
        Scheme s = withSnow();
        service.applyToScheme(s, new HashMap<>(Map.of("animation", "NONE")), false);
        assertEquals(BackgroundAnimation.NONE, s.getBackgroundAnimationType());
        service.applyToScheme(s, new HashMap<>(Map.of("animation", "LEAVES")), false);
        assertEquals(BackgroundAnimation.LEAVES, s.getBackgroundAnimationType());
    }

    @Test
    void semAChaveAAnimacaoGravadaFica() {
        Scheme s = withSnow();
        service.applyToScheme(s, new HashMap<>(Map.of("color", "#FFFFFF")), false);
        assertEquals(BackgroundAnimation.SNOW, s.getBackgroundAnimationType());
    }
}
