package br.com.fashionai.application.rf;

public class Rf23ProfilePreferencesUseCase implements AcceptanceTrackedUseCase<Object, Object> {
    @Override
    public String rf() {
        return "RF23";
    }

    @Override
    public Object execute(Object input) {
        throw new UseCaseNotImplementedException(rf());
    }
}
