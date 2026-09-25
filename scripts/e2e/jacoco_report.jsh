import java.io.*;
import java.util.*;
import org.jacoco.core.tools.ExecFileLoader;
import org.jacoco.core.analysis.*;
import org.jacoco.report.*;
import org.jacoco.report.html.HTMLFormatter;
import org.jacoco.report.csv.CSVFormatter;
String root = System.getProperty("root", ".");
String exec = System.getProperty("exec"), out = System.getProperty("out");
var loader = new ExecFileLoader(); loader.load(new File(exec));
String[][] mods = {{"fai-domain","fai-domain"},{"fai-application","fai-application"},{"fai-web","fai-web"},{"fai-infrastructure (MySQL)","fai-infrastructure/persistence-mysql"},{"fai-infrastructure (plataforma)","fai-infrastructure/platform"},{"fai-infrastructure (IA)","fai-infrastructure/ai-providers"},{"fai-infrastructure (Redis, desligado aqui)","fai-infrastructure/cache-redis"},{"fai-infrastructure (Cassandra, desligado aqui)","fai-infrastructure/persistence-cassandra"},{"fai-infrastructure (OpenSearch, desligado aqui)","fai-infrastructure/search-opensearch"},{"fai-infrastructure (S3, desligado aqui)","fai-infrastructure/storage-s3"},{"fai-bootstrap","fai-bootstrap"}};
var html = new HTMLFormatter(); html.setOutputEncoding("UTF-8"); html.setLocale(new Locale("pt","BR"));
var visitor = html.createVisitor(new FileMultiReportOutput(new File(out, "html")));
visitor.visitInfo(loader.getSessionInfoStore().getInfos(), loader.getExecutionDataStore().getContents());
var group = visitor.visitGroup("Fashion AI — cobertura medida pelo teste ponta a ponta (452 passos)");
var summary = new StringBuilder("modulo;linhas_cobertas;linhas_total;pct_linhas;ramos_cobertos;ramos_total;pct_ramos;metodos_cobertos;metodos_total;classes_cobertas;classes_total\n");
for (String[] m : mods) {
  File classes = new File(root + "/" + m[1] + "/target/classes");
  if (!classes.exists()) continue;
  var builder = new CoverageBuilder();
  var analyzer = new Analyzer(loader.getExecutionDataStore(), builder);
  analyzer.analyzeAll(classes);
  IBundleCoverage b = builder.getBundle(m[0]);
  group.visitBundle(b, new DirectorySourceFileLocator(new File(root + "/" + m[1] + "/src/main/java"), "utf-8", 4));
  var l = b.getLineCounter(); var br = b.getBranchCounter(); var me = b.getMethodCounter(); var cl = b.getClassCounter();
  summary.append(String.format(Locale.ROOT, "%s;%d;%d;%.1f;%d;%d;%.1f;%d;%d;%d;%d%n", m[0], l.getCoveredCount(), l.getTotalCount(), 100.0*l.getCoveredRatio(),
     br.getCoveredCount(), br.getTotalCount(), br.getTotalCount()==0?0:100.0*br.getCoveredRatio(), me.getCoveredCount(), me.getTotalCount(), cl.getCoveredCount(), cl.getTotalCount()));
}
visitor.visitEnd();
new File(out).mkdirs();
java.nio.file.Files.writeString(new File(out, "resumo.csv").toPath(), summary.toString());
System.out.println(summary);
/exit
