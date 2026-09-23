package br.com.fashionai.application.rf;

public class UseCaseNotImplementedException extends UnsupportedOperationException {
    public UseCaseNotImplementedException(String rf) {
        super(rf + " ainda tem regra de negocio pendente de implementacao detalhada pelos CAs.");
    }
}
