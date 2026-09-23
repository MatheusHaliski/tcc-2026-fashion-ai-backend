package br.com.fashionai.application.rf;

import br.com.fashionai.domain.model.enums.ProfileType;

public class Rf1RegisterAccountUseCase implements AcceptanceTrackedUseCase<Rf1RegisterAccountUseCase.Command, Rf1RegisterAccountUseCase.Result> {
    @Override
    public String rf() {
        return "RF1";
    }

    @Override
    public Result execute(Command input) {
        throw new UseCaseNotImplementedException(rf());
    }

    public record Command(String username, String displayName, String email, String password, ProfileType profileType) {
    }

    public record Result(String userId) {
    }
}
