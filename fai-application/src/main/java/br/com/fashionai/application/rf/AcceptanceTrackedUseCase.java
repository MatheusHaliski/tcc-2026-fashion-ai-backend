package br.com.fashionai.application.rf;

public interface AcceptanceTrackedUseCase<I, O> {
    String rf();

    O execute(I input);
}
