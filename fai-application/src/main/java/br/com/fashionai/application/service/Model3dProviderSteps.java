package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.ReliefModelGenerator;

import java.util.ArrayList;
import java.util.List;

/**
 * RF16 — os provedores de reconstrução 3D como etapas remotas do {@link AiEngine}: o assíncrono (Meshy) devolve a
 * tarefa para acompanhar; o síncrono devolve o GLB na hora (recusado se não for um GLB). Extraído de
 * {@link Model3dService}, que decide quando gerar e grava o resultado.
 */
final class Model3dProviderSteps {
    private Model3dProviderSteps() {
    }

    /** @param png o recorte sem fundo da peça (o mesmo que o relevo local usa) */
    static List<AiEngine.RemoteStep<Model3dService.Started>> of(List<ImageProviderPorts.Model3dPort> providers, byte[] png) {
        List<AiEngine.RemoteStep<Model3dService.Started>> steps = new ArrayList<>();
        for (ImageProviderPorts.Model3dPort p : providers) {
            steps.add(new AiEngine.RemoteStep<>() {
                public String provider() {
                    return p.providerId();
                }

                public String model() {
                    return p.async() ? "image-to-3d" : "stable-fast-3d";
                }

                public boolean available() {
                    return p.available();
                }

                public AiEngine.RemoteResult<Model3dService.Started> call() {
                    if (p.async()) {
                        String task = p.submit(png).orElseThrow(() -> new IllegalStateException(p.providerId() + " recusou a tarefa"));
                        return new AiEngine.RemoteResult<>(new Model3dService.Started(p.providerId(), task, null, p.costUsd(), false, null),
                                p.costUsd(), "tarefa " + task);
                    }
                    byte[] glb = p.generateNow(png).filter(ReliefModelGenerator::isGlb)
                            .orElseThrow(() -> new IllegalStateException(p.providerId() + " não devolveu um GLB válido"));
                    return new AiEngine.RemoteResult<>(new Model3dService.Started(p.providerId(), null, glb, p.costUsd(), false, null),
                            p.costUsd(), glb.length / 1024 + " KB");
                }
            });
        }
        return steps;
    }
}
