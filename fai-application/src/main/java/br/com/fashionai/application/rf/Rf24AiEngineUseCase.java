package br.com.fashionai.application.rf;

import br.com.fashionai.application.ai.AiProviderPort;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.AiResponse;

public class Rf24AiEngineUseCase implements AcceptanceTrackedUseCase<AiRequest, AiResponse> {
    private final AiProviderPort aiProviderPort;

    public Rf24AiEngineUseCase(AiProviderPort aiProviderPort) {
        this.aiProviderPort = aiProviderPort;
    }

    @Override
    public String rf() {
        return "RF24";
    }

    @Override
    public AiResponse execute(AiRequest input) {
        return aiProviderPort.invoke(input);
    }
}
