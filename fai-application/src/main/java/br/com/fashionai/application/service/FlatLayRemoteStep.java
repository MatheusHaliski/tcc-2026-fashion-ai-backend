package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.imaging.FlatLayPipeline;

/**
 * Adapter do Flat Lay remoto (rembg → remove.bg + Cloudinary) para o motor de IA: toda remoção de fundo que pode cair
 * num provedor pago passa pela cota diária da capacidade, pelo teto de gasto e pelo registro da inferência.
 */
final class FlatLayRemoteStep implements AiEngine.RemoteStep<FlatLayPipeline.Result> {
    private final FlatLayPipeline flatLay;
    private final byte[] bytes;

    FlatLayRemoteStep(FlatLayPipeline flatLay, byte[] bytes) {
        this.flatLay = flatLay;
        this.bytes = bytes;
    }

    @Override
    public String provider() {
        return "rembg/remove.bg+cloudinary";
    }

    @Override
    public String model() {
        return "flat-lay-hybrid";
    }

    @Override
    public boolean available() {
        return flatLay.externalAvailable();
    }

    @Override
    public AiEngine.RemoteResult<FlatLayPipeline.Result> call() {
        FlatLayPipeline.Result r = flatLay.run(bytes, true);
        return new AiEngine.RemoteResult<>(r, r.totalCostUsd(), "qualidade " + r.quality().overall());
    }
}
