package br.com.fashionai.application.taxonomy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Regiões do mundo por país (ISO 3166-1 alfa-2) para os filtros e o Top 100 Regional da Passarela 3D (RF33). */
public final class WorldRegions {
    private WorldRegions() {
    }

    public static final Map<String, String> LABELS = new LinkedHashMap<>();
    static final Map<String, String> BY_COUNTRY = new LinkedHashMap<>();

    static void region(String code, String label, String countries) {
        LABELS.put(code, label);
        for (String c : countries.split(",")) {
            BY_COUNTRY.put(c.trim(), code);
        }
    }

    static {
        region("AMERICA_DO_SUL", "América do Sul", "BR,AR,CL,CO,PE,UY,PY,BO,EC,VE,GY,SR");
        region("AMERICA_DO_NORTE", "América do Norte", "US,CA,MX");
        region("AMERICA_CENTRAL_CARIBE", "América Central e Caribe", "GT,CR,PA,HN,SV,NI,BZ,CU,DO,PR,JM,HT,TT,BS,BB");
        region("EUROPA", "Europa", "GB,UK,FR,DE,IT,ES,PT,NL,BE,CH,AT,SE,NO,DK,FI,IE,PL,CZ,GR,RO,HU,UA,IS,LU,HR,SI,SK,BG,RS,EE,LV,LT,MT,CY,MC,AD");
        region("ASIA", "Ásia", "JP,CN,KR,IN,ID,TH,VN,PH,MY,SG,TW,HK,PK,BD,LK,NP,MN,KZ,UZ,KH,MM");
        region("ORIENTE_MEDIO", "Oriente Médio", "AE,SA,IL,TR,QA,KW,BH,OM,JO,LB,IR,IQ,EG");
        region("AFRICA", "África", "ZA,NG,MA,KE,GH,ET,TN,DZ,SN,CI,AO,MZ,TZ,UG,CM,RW,CV");
        region("OCEANIA", "Oceania", "AU,NZ,FJ,PG");
        LABELS.put("OUTRAS", "Outras regiões");
    }

    public static String of(String country) {
        return country == null ? "OUTRAS" : BY_COUNTRY.getOrDefault(country.trim().toUpperCase(Locale.ROOT), "OUTRAS");
    }

    public static String label(String region) {
        return LABELS.getOrDefault(region, region);
    }

    public static List<String> codes() {
        return List.copyOf(LABELS.keySet());
    }
}
