package br.com.fashionai.application.rf;

public class Rf19SocialInteractionUseCase implements AcceptanceTrackedUseCase<Object, Object> {
    @Override
    public String rf() {
        return "RF19";
    }

    @Override
    public Object execute(Object input) {
        throw new UseCaseNotImplementedException(rf());
    }
}
