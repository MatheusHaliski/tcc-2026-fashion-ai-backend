package br.com.fashionai.application.catalog.image;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.UnaryOperator;

/**
 * Execução do protocolo JSONL do {@link CatalogImageBatchCli}: anuncia {@code ready}, despacha cada linha para um pool
 * de threads com contrapressão e serializa as respostas no stdout.
 */
final class CatalogBatchLoop {
    /** pedidos aceitos por thread antes de a leitura do stdin esperar (contrapressão: memória limitada) */
    static final int IN_FLIGHT_PER_THREAD = 4;

    private CatalogBatchLoop() {
    }

    /**
     * Laço do protocolo: anuncia {@code ready}, lê uma linha por pedido e despacha para {@code threads} workers; no EOF
     * espera os pedidos em andamento. Devolve o código de saída (0 = EOF normal; 1 = stdin ou stdout quebrou).
     */
    static int run(String ready, UnaryOperator<String> handler, InputStream in, PrintStream out, int threads) {
        Object lock = new Object();
        emit(out, lock, ready);
        AtomicInteger seq = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(threads, r -> {
            Thread t = new Thread(r, "catalog-batch-" + seq.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
        Semaphore slots = new Semaphore(threads * IN_FLIGHT_PER_THREAD);
        int code = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                if (out.checkError()) {
                    System.err.println("catalog-batch: stdout fechado; encerrando");
                    code = 1;
                    break;
                }
                slots.acquireUninterruptibly();
                String request = line;
                try {
                    pool.execute(() -> {
                        try {
                            emit(out, lock, handler.apply(request));
                        } catch (Throwable e) {     // nem a resposta de erro saiu: devolve o mínimo que der
                            emit(out, lock, "{\"id\":null,\"op\":null,\"ok\":false,\"error\":\"INTERNAL: " + e.getClass().getSimpleName() + "\"}");
                        } finally {
                            slots.release();
                        }
                    });
                } catch (RejectedExecutionException e) {
                    slots.release();
                    emit(out, lock, handler.apply(request));
                }
            }
        } catch (IOException e) {
            System.err.println("catalog-batch: falha lendo stdin: " + e.getMessage());
            code = 1;
        } finally {
            pool.shutdown();
            try {
                while (!pool.awaitTermination(1, TimeUnit.MINUTES)) {
                    System.err.println("catalog-batch: aguardando pedidos em andamento");
                }
            } catch (InterruptedException e) {
                pool.shutdownNow();
                Thread.currentThread().interrupt();
                code = 1;
            }
        }
        synchronized (lock) {
            out.flush();
        }
        return out.checkError() ? 1 : code;
    }

    private static void emit(PrintStream out, Object lock, String json) {
        synchronized (lock) {
            out.print(json);
            out.print('\n');
            out.flush();
        }
    }
}
