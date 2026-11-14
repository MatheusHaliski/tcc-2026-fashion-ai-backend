package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairCbcSquadEdicaoRepository;
import br.com.fashionai.domain.repository.UserRepository;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR CBC — primeiras conclusões simultâneas nunca dividem a edição. O banco dá o bloqueio (SELECT ... FOR UPDATE na
 * linha do contador, solto no commit); aqui o repositório do contador é um dublê que faz o mesmo com uma trava, solta
 * quando a "transação" de cada entrega termina. Várias pessoas entregam ao mesmo tempo e cada uma leva um número.
 */
class FlairCbcEdicaoConcorrenteTest {
    static final int PESSOAS = 12;

    /** O contador em memória com a trava do FOR UPDATE: quem lê fica com a linha até {@link #commit}. */
    static final class Trava {
        final ReentrantLock linha = new ReentrantLock();
        final FlairCbcSquadEdicaoRepository memoria = MemoryRepository.of(FlairCbcSquadEdicaoRepository.class);
        final FlairCbcSquadEdicaoRepository repositorio = (FlairCbcSquadEdicaoRepository) Proxy.newProxyInstance(
                FlairCbcSquadEdicaoRepository.class.getClassLoader(), new Class<?>[]{FlairCbcSquadEdicaoRepository.class}, this::chamar);

        Object chamar(Object proxy, Method method, Object[] args) throws Throwable {
            Lock lock = method.getAnnotation(Lock.class);
            if (lock != null && lock.value() == LockModeType.PESSIMISTIC_WRITE && !linha.isHeldByCurrentThread()) {
                linha.lock();
            }
            try {
                return method.invoke(memoria, args);
            } catch (InvocationTargetException e) {
                throw e.getCause();
            }
        }

        void commit() {
            while (linha.isHeldByCurrentThread()) {
                linha.unlock();
            }
        }
    }

    @Test
    void contadorELidoComBloqueioDeEscritaDentroDaTransacaoDaEntrega() throws Exception {
        Lock lock = FlairCbcSquadEdicaoRepository.class.getMethod("findByElenco", String.class).getAnnotation(Lock.class);
        assertThat(lock).isNotNull();
        assertThat(lock.value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
        Transactional tx = FlairCbcSquadService.class.getMethod("entregar", CurrentUser.class, String.class, FlairCbcSquadService.Pedido.class)
                .getAnnotation(Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.readOnly()).isFalse();
    }

    @Test
    void primeirasConclusoesSimultaneasLevamEdicoesDiferentes() throws Exception {
        Kit kit = new Kit();
        Trava trava = new Trava();
        kit.with(trava.repositorio);
        kit.real(Flair3dCartas.class);
        FlairCbcSquadService service = kit.build(FlairCbcSquadService.class);
        List<CurrentUser> pessoas = new ArrayList<>();
        List<FlairCbcSquadService.Pedido> pedidos = new ArrayList<>();
        for (int i = 0; i < PESSOAS; i++) {
            CurrentUser pessoa = Kit.as(kit.save(UserRepository.class, Kit.user("pessoa" + i)));
            Map<String, UUID> cartas = new LinkedHashMap<>();
            for (FlairCbcElenco.Vaga v : FlairCbcElencos.porCodigo("PRIMEIRO_ELENCO").orElseThrow().vagas()) {
                cartas.put(v.chave(), kit.save(FlairCardInstanceRepository.class,
                        Flair3dFixtures.instance(pessoa.id(), v.posicao(), "brand:Farm")).getId());
            }
            pessoas.add(pessoa);
            pedidos.add(new FlairCbcSquadService.Pedido(cartas));
        }

        ExecutorService pool = Executors.newFixedThreadPool(PESSOAS);
        CountDownLatch largada = new CountDownLatch(1);
        List<Future<Integer>> entregas = new ArrayList<>();
        for (int i = 0; i < PESSOAS; i++) {
            CurrentUser pessoa = pessoas.get(i);
            FlairCbcSquadService.Pedido pedido = pedidos.get(i);
            Callable<Integer> entrega = () -> {
                largada.await();
                try {
                    return (Integer) service.entregar(pessoa, "PRIMEIRO_ELENCO", pedido).get("edicao");
                } finally {
                    trava.commit();
                }
            };
            entregas.add(pool.submit(entrega));
        }
        largada.countDown();
        List<Integer> edicoes = new ArrayList<>();
        for (Future<Integer> f : entregas) {
            edicoes.add(f.get(30, TimeUnit.SECONDS));
        }
        pool.shutdownNow();

        assertThat(edicoes).doesNotHaveDuplicates().hasSize(PESSOAS);
        assertThat(edicoes).allMatch(e -> e >= 1 && e <= PESSOAS);
        assertThat(trava.memoria.findByElenco("PRIMEIRO_ELENCO").orElseThrow().getUltima()).isEqualTo(PESSOAS);
    }
}
