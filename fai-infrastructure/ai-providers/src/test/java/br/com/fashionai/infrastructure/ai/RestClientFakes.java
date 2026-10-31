package br.com.fashionai.infrastructure.ai;

import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Field;

/** Troca o RestClient de um adaptador por um ligado ao MockRestServiceServer: nenhuma chamada sai para a rede. */
public final class RestClientFakes {
    private RestClientFakes() {
    }

    public static MockRestServiceServer bind(Object adapter, String field, String baseUrl) {
        RestClient.Builder builder = RestClient.builder().baseUrl(baseUrl);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        set(adapter, field, builder.build());
        return server;
    }

    public static MockRestServiceServer bind(Object adapter, String baseUrl) {
        return bind(adapter, "client", baseUrl);
    }

    public static void set(Object target, String field, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
