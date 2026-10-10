package br.com.fashionai.application.ai;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Bounded workers for interactive vision requests; queueing counts toward the same deadline. */
final class AiDeadline {
    private static final ThreadPoolExecutor WORKERS = new ThreadPoolExecutor(4, 4, 30, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(8), Thread.ofPlatform().daemon().name("vision-deadline-", 0).factory());

    private AiDeadline() { }

    static <T> T call(Callable<T> call, long deadlineNanos) throws Exception {
        long remaining = deadlineNanos - System.nanoTime();
        if (remaining <= 0) throw new TimeoutException("Vision deadline exceeded");
        var task = WORKERS.submit(call);
        try {
            return task.get(remaining, TimeUnit.NANOSECONDS);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof Exception cause) throw cause;
            throw e;
        } finally {
            task.cancel(true);
            WORKERS.remove((Runnable) task);
        }
    }
}
