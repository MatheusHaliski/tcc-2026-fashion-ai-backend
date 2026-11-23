package br.com.fashionai.web.controller;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.util.List;
import java.util.stream.Stream;

/**
 * Look do Dia Vivido F1 — recorte do {@link ControllerDelegacaoTest} só para os controllers do Look do Dia (os dublês
 * moram em {@link ServiceFakesLookDoDia}): cada endpoint delega ao serviço, repassa a pessoa autenticada e devolve o que o
 * serviço respondeu — inclusive os novos {@code suggest-context}, {@code calendar} e o corpo com {@code context}.
 */
class DailyLookControllerDelegacaoTest {
    static final List<Class<?>> CONTROLLERS = List.of(DailyLookController.class, DailyLookPhaseController.class, LookbookController.class);

    @TestFactory
    Stream<DynamicTest> endpointsDoLookDoDiaDelegamAoServico() {
        return CONTROLLERS.stream().flatMap(type -> ControllerDelegacaoTest.endpoints(type)
                .filter(m -> ControllerDelegacaoTest.generico(type, m)).map(m ->
                DynamicTest.dynamicTest(type.getSimpleName() + "." + m.getName(), () -> ControllerDelegacaoTest.exercita(type, m))));
    }

    @TestFactory
    Stream<DynamicTest> opcionaisAusentesTambemDelegam() {
        return CONTROLLERS.stream().flatMap(type -> ControllerDelegacaoTest.endpoints(type)
                .filter(m -> ControllerDelegacaoTest.generico(type, m))
                .filter(m -> java.util.Arrays.stream(m.getParameters()).anyMatch(ControllerDelegacaoTest::opcional)).map(m ->
                DynamicTest.dynamicTest(type.getSimpleName() + "." + m.getName() + " sem opcionais", () -> ControllerDelegacaoTest.exercita(type, m, true))));
    }
}
