package br.com.fashionai.application.rf;

public class Rf18VirtualTryOnUseCase implements AcceptanceTrackedUseCase<Object, Object> {
    @Override
    public String rf() {
        return "RF18";
    }

    @Override
    public Object execute(Object input) {
        throw new UseCaseNotImplementedException(rf());
    }
}
