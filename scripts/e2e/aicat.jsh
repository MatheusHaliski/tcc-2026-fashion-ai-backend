String q(String x){ return x==null?"null":"\""+x.replace("\\","\\\\").replace("\"","\\\"").replace("\n"," ")+"\""; }
import br.com.fashionai.application.ai.*;
var sb = new StringBuilder("[");
for (var s : AiCatalog.all()) {
  java.util.function.Function<AiCatalog.ProviderOption,String> po = p -> p == null ? "null" : String.format("{\"id\":%s,\"service\":%s,\"model\":%s,\"cost\":\"%s\",\"costPerCall\":\"%s\",\"note\":%s,\"latency\":%d,\"env\":%s,\"kind\":\"%s\"}",
     q(p.providerId()), q(p.service()), q(p.model()), p.costMode(), p.costPerCallUsd(), q(p.costNote()), p.typicalLatencyMs(), q(p.envKey()), p.kind());
  if (sb.length() > 1) sb.append(",");
  sb.append(String.format("{\"n\":%d,\"cap\":\"%s\",\"name\":%s,\"hostRf\":%s,\"consent\":%s,\"what\":%s,\"primary\":%s,\"alternative\":%s,\"local\":%s,\"fallback\":%s,\"quota\":%d,\"timeout\":%d,\"status\":%s}",
     s.capability().number(), s.capability().name(), q(s.capability().officialName()), q(s.capability().hostRf()), s.capability().consentPurpose()==null?"null":q(s.capability().consentPurpose().name()),
     q(s.whatItDoes()), po.apply(s.primary()), po.apply(s.alternative()), po.apply(s.local()), q(s.fallbackBehavior()), s.dailyQuotaPerUser(), s.timeoutSeconds(), q(s.status())));
}
sb.append("]");
java.nio.file.Files.writeString(java.nio.file.Path.of(System.getProperty("out")), sb.toString());
/exit
