package br.com.fashionai.web.controller;

/**
 * Dublês dos colaboradores do FLAIR que os controllers usam antes de chamar o serviço (fora de {@link ServiceFakes},
 * congelado no limite de linhas). {@link Fk#fakeClasses()} junta os conjuntos.
 */
final class ServiceFakesFlair {
    private ServiceFakesFlair() {
    }

    /** O oponente do duelo 2D: devolve o campo antigo como veio, para o teste ver a delegação ao FlairService. */
    static final class FakeFlairDueloOponente extends br.com.fashionai.application.flair.FlairDueloOponente {
        FakeFlairDueloOponente() {
            super((br.com.fashionai.domain.repository.UserRepository) Fk.arg(br.com.fashionai.domain.repository.UserRepository.class), null);
        }

        @Override
        public String oponente(br.com.fashionai.application.security.CurrentUser user, java.util.UUID opponentId, String opponent) {
            return opponent;
        }
    }
}
