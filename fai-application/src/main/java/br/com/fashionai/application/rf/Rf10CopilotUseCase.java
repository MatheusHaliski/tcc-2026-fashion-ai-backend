package br.com.fashionai.application.rf;

public class Rf10CopilotUseCase implements AcceptanceTrackedUseCase<Object, Object> {
    @Override
    public String rf() {
        return "RF10";
    }

    @Override
    public Object execute(Object input) {
        throw new UseCaseNotImplementedException(rf());
    }
}
