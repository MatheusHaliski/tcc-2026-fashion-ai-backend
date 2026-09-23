package br.com.fashionai.application.rf;

public class Rf5CreateSchemeUseCase implements AcceptanceTrackedUseCase<Object, Object> {
    @Override
    public String rf() {
        return "RF5";
    }

    @Override
    public Object execute(Object input) {
        throw new UseCaseNotImplementedException(rf());
    }
}
