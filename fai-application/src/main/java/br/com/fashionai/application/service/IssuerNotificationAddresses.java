package br.com.fashionai.application.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

final class IssuerNotificationAddresses {
    private IssuerNotificationAddresses() {}

    static List<String> parse(String csv) {
        List<String> out = new ArrayList<>();
        if (csv == null) {
            return out;
        }
        Arrays.stream(csv.split("[,;\\s]+")).map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> s.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+") && !out.contains(s)).forEach(out::add);
        return out;
    }

}
