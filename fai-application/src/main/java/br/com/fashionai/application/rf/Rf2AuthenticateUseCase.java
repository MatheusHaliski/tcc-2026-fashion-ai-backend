package br.com.fashionai.application.rf;

public class Rf2AuthenticateUseCase implements AcceptanceTrackedUseCase<Rf2AuthenticateUseCase.Command, Rf2AuthenticateUseCase.Result> {
    @Override
    public String rf() {
        return "RF2";
    }

    @Override
    public Result execute(Command input) {
        throw new UseCaseNotImplementedException(rf());
    }

    public record Command(String email, String password, String ip, String userAgent) {
    }

    public record Result(String accessToken, String refreshToken) {
    }
}
