package br.com.fashionai.application.rf;

import java.util.UUID;

public class Rf3ManageAccountUseCase implements AcceptanceTrackedUseCase<Rf3ManageAccountUseCase.Command, Rf3ManageAccountUseCase.Result> {
    @Override
    public String rf() {
        return "RF3";
    }

    @Override
    public Result execute(Command input) {
        throw new UseCaseNotImplementedException(rf());
    }

    public record Command(UUID actorUserId, UUID targetUserId, String operation) {
    }

    public record Result(String status) {
    }
}
