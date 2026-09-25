import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.*;

/**
 * Codemod de i18n do backend (RF23): extrai os textos de interface embutidos nos serviços Java para
 * fai-application/src/main/resources/i18n/messages.properties e troca cada um por Msg.t("chave", args…).
 *
 *   java scripts/i18n/JavaExtract.java [--dry] [--report out.json] <arquivos ou pastas .java>
 *
 * Regras: só literais dentro de corpos de método/lambda (nunca campos estáticos, enums, anotações, `case`), só texto em
 * linguagem natural (acento, frase com maiúscula/pontuação, 3+ palavras), nunca em log/audit/regex/formatos de data/
 * comparações/prompts (text blocks e métodos *prompt*). Concatenações viram um único padrão MessageFormat ({0}, {1}…).
 */
public class JavaExtract {
    static final Pattern NAT = Pattern.compile("[áéíóúãõçâêôÁÉÍÓÚÃÕÇÂÊÔ]");
    static final Pattern IGNORE = Pattern.compile("^(https?://|/|#|@|\\.|[A-Z0-9_\\-]+$|[a-z]+(-[a-z0-9]+)+$|[a-z]+[A-Z][A-Za-z0-9]*$|\\d)");
    static final Set<String> SKIP_METHODS = Set.of("info", "warn", "debug", "error", "trace", "ofPattern", "compile", "matches", "replaceAll", "replaceFirst", "split",
            "contains", "equals", "equalsIgnoreCase", "startsWith", "endsWith", "indexOf", "lastIndexOf", "getenv", "getProperty", "containsKey", "get", "remove",
            "header", "setHeader", "addHeader", "queryParam", "path", "uri", "url", "of", "forLanguageTag", "valueOf", "name", "getBundle", "log", "audit", "record",
            "hasText", "isBlank", "strip", "trim", "toLowerCase", "toUpperCase", "requireNonNull", "checkArgument", "state", "isTrue", "notNull", "assertEquals", "assertTrue");
    static final Set<String> SKIP_RECEIVERS = Set.of("log", "logger", "LOG", "audit", "Pattern", "DateTimeFormatter", "Map", "Set", "List", "System", "Objects", "Assert", "Files", "Paths", "Path", "URI", "UriComponentsBuilder", "MediaType", "HttpHeaders", "Locale", "String", "Optional", "Collectors", "Stream", "Instant", "LocalDate", "Duration", "UUID", "Base64", "Jsoup", "Json", "ObjectMapper");
    static final Set<String> ALLOW = Set.of("Fashion AI", "FashionAI", "FAI", "FLAIR", "Copilot", "Hype Score", "Smart Mirror", "Wikidata (Wikimedia)", "Simple Icons");

    record Edit(long start, long end, String text) {}
    record Found(String file, long line, String key, String text) {}

    static boolean dry; static final Map<String, String> catalog = new LinkedHashMap<>(); static final Map<String, String> byText = new HashMap<>();
    static final Map<String, Set<String>> usage = new HashMap<>(); static final List<Found> found = new ArrayList<>(); static final List<String> skipped = new ArrayList<>();
    static Path root, props;

    public static void main(String[] argv) throws Exception {
        List<String> args = new ArrayList<>(List.of(argv)); dry = args.remove("--dry");
        String reportOut = null; int ri = args.indexOf("--report"); if (ri >= 0) { reportOut = args.get(ri + 1); args.remove(ri + 1); args.remove(ri); }
        root = Paths.get("").toAbsolutePath(); props = root.resolve("fai-application/src/main/resources/i18n/messages.properties");
        if (Files.exists(props)) loadProps();
        List<Path> files = new ArrayList<>();
        for (String a : args) { Path p = root.resolve(a); if (Files.isDirectory(p)) { try (Stream<Path> s = Files.walk(p)) { s.filter(f -> f.toString().endsWith(".java")).sorted().forEach(files::add); } } else files.add(p); }
        int edited = 0, edits = 0;
        for (Path f : files) { int n = process(f); if (n > 0) { edited++; edits += n; } }
        for (var e : new ArrayList<>(usage.entrySet())) {           // textos repetidos em 2+ arquivos → common.*
            if (e.getValue().size() < 2 || e.getKey().startsWith("common.")) continue;
            String slug = e.getKey().substring(e.getKey().lastIndexOf('.') + 1).replaceAll("_\\d+$", ""); String nk = "common." + slug; int i = 2;
            while (catalog.containsKey(nk) && !catalog.get(nk).equals(catalog.get(e.getKey()))) nk = "common." + slug + "_" + i++;
            if (nk.equals(e.getKey())) continue;
            catalog.put(nk, catalog.remove(e.getKey()));
            if (!dry) for (String file : e.getValue()) { Path p = root.resolve(file); String s = Files.readString(p); Files.writeString(p, s.replace("\"" + e.getKey() + "\"", "\"" + nk + "\"")); }
        }
        if (!dry) saveProps();
        if (reportOut != null) {
            StringBuilder sb = new StringBuilder("{\"found\":[");
            for (int i = 0; i < found.size(); i++) { Found x = found.get(i); sb.append(i > 0 ? "," : "").append("{\"file\":\"").append(x.file).append("\",\"line\":").append(x.line).append(",\"key\":\"").append(x.key).append("\",\"text\":\"").append(esc(x.text)).append("\"}"); }
            sb.append("],\"skipped\":[");
            for (int i = 0; i < skipped.size(); i++) sb.append(i > 0 ? "," : "").append("\"").append(esc(skipped.get(i))).append("\"");
            sb.append("]}");
            Files.writeString(root.resolve(reportOut), sb.toString());
        }
        System.out.println((dry ? "[dry] " : "") + edited + " arquivos, " + edits + " edições, " + found.size() + " textos, catálogo com " + catalog.size() + " chaves, " + skipped.size() + " ignorados");
    }
    static String esc(String s) { return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t"); }

    static void loadProps() throws IOException {
        for (String line : Files.readAllLines(props, StandardCharsets.UTF_8)) {
            if (line.isBlank() || line.startsWith("#")) continue; int i = line.indexOf('='); if (i < 0) continue;
            String k = line.substring(0, i).trim(); String v = unescapeProp(line.substring(i + 1)); catalog.put(k, v); byText.putIfAbsent(v, k);
        }
    }
    static void saveProps() throws IOException {
        StringBuilder sb = new StringBuilder("# Fashion AI — textos do backend (pt-BR, idioma-fonte). Gerado por scripts/i18n/JavaExtract.java; padrões MessageFormat.\n");
        catalog.keySet().stream().sorted().forEach(k -> sb.append(k).append("=").append(escapeProp(catalog.get(k))).append("\n"));
        Files.createDirectories(props.getParent()); Files.writeString(props, sb.toString(), StandardCharsets.UTF_8);
    }
    static String escapeProp(String v) { return v.replace("\\", "\\\\").replace("\n", "\\n").replace("\t", "\\t").replaceAll("^ ", "\\\\ "); }
    static String unescapeProp(String v) { StringBuilder b = new StringBuilder(); for (int i = 0; i < v.length(); i++) { char c = v.charAt(i); if (c == '\\' && i + 1 < v.length()) { char n = v.charAt(++i); b.append(n == 'n' ? '\n' : n == 't' ? '\t' : n); } else b.append(c); } return b.toString(); }

    static boolean natural(String s) {
        String c = s.replaceAll("\\s+", " ").trim();
        if (c.length() < 2 || !c.matches(".*[A-Za-zÀ-ÿ]{2,}.*") || IGNORE.matcher(c).find() || ALLOW.contains(c)) return false;
        if (c.matches("^[\\w.\\-]+/[\\w.\\-/]+$") || c.contains("{\"") || c.startsWith("SELECT") || c.startsWith("select ") || c.contains("%d") ) return false;
        if (c.matches(".*\\b(rgba?|hsla?|var|calc|url)\\(.*")) return false;
        if (c.matches("^[\\w:./?&=%+-]+$") && !NAT.matcher(c).find()) return false;     // identificadores, chaves, urls
        if (NAT.matcher(c).find()) return true;
        String[] w = c.split(" ");
        if (w.length == 1) return c.matches("^[A-Z][a-z]{2,}$");
        return Character.isUpperCase(c.charAt(0)) || c.matches(".*[.,:;!?…].*") || w.length >= 3;
    }
    static String slug(String text) {
        String s = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().replaceAll("\\{\\d+\\}", " ").replaceAll("[^a-z0-9]+", " ").trim();
        String[] w = s.isEmpty() ? new String[0] : s.split(" "); String out = String.join("_", Arrays.copyOf(w, Math.min(5, w.length)));
        if (out.length() > 40) out = out.substring(0, 40).replaceAll("_[^_]*$", "");
        if (out.isEmpty()) out = "txt_" + Integer.toHexString(text.hashCode());
        if (Character.isDigit(out.charAt(0))) out = "n" + out;
        return out;
    }
    static String keyFor(String text, String ns, String file) {
        String k = byText.get(text);
        if (k == null) { String base = ns + "." + slug(text); k = base; int i = 2; while (catalog.containsKey(k)) k = base + "_" + i++; catalog.put(k, text); byText.put(text, k); }
        usage.computeIfAbsent(k, x -> new LinkedHashSet<>()).add(file); return k;
    }
    static String mf(String s) { return s.replace("'", "''").replace("{", "'{'").replace("}", "'}'"); }

    static int process(Path file) throws Exception {
        String src = Files.readString(file); String rel = root.relativize(file).toString();
        JavaCompiler jc = ToolProvider.getSystemJavaCompiler();
        try (StandardJavaFileManager fm = jc.getStandardFileManager(null, null, StandardCharsets.UTF_8)) {
            JavacTask task = (JavacTask) jc.getTask(null, fm, null, List.of("-proc:none"), null, fm.getJavaFileObjects(file));
            CompilationUnitTree cu = task.parse().iterator().next();
            SourcePositions pos = Trees.instance(task).getSourcePositions(); LineMap lm = cu.getLineMap();
            String cls = file.getFileName().toString().replace(".java", ""); String ns = Character.toLowerCase(cls.charAt(0)) + cls.substring(1).replaceAll("(Service|Controller|Advisor|Engine|Pipeline)$", "");
            if (ns.isEmpty()) ns = cls.toLowerCase();
            List<Edit> edits = new ArrayList<>(); Set<Tree> consumed = new HashSet<>(); String nsF = ns;
            new TreePathScanner<Void, Void>() {
                boolean inMethod(TreePath p) {   // corpo de método/lambda/inicializador — nunca campo, enum, anotação
                    for (TreePath q = p.getParentPath(); q != null; q = q.getParentPath()) {
                        Tree t = q.getLeaf();
                        if (t instanceof AnnotationTree || t instanceof CaseTree) return false;
                        if (t instanceof MethodTree m) { String n = m.getName().toString().toLowerCase(); return !(n.contains("prompt") || n.contains("systemmessage") || n.contains("instruction")); }
                        if (t instanceof LambdaExpressionTree) return true;
                        if (t instanceof VariableTree v && q.getParentPath() != null && q.getParentPath().getLeaf() instanceof ClassTree) return false; // campo
                        if (t instanceof ClassTree) return false;
                    }
                    return false;
                }
                boolean skippedCall(TreePath p) {
                    for (TreePath q = p.getParentPath(); q != null; q = q.getParentPath()) {
                        Tree t = q.getLeaf();
                        if (t instanceof MethodInvocationTree mi) {
                            ExpressionTree sel = mi.getMethodSelect(); String name = sel instanceof MemberSelectTree ms ? ms.getIdentifier().toString() : sel.toString();
                            String recv = sel instanceof MemberSelectTree ms ? ms.getExpression().toString() : "";
                            if (SKIP_METHODS.contains(name) || SKIP_RECEIVERS.contains(recv) || recv.endsWith("log") || recv.startsWith("log.")) return true;
                            if (name.equals("put") || name.equals("putIfAbsent")) { if (mi.getArguments().size() >= 1 && p.getLeaf() == mi.getArguments().get(0)) return true; }
                        }
                        if (t instanceof BinaryTree b && b.getKind() != Tree.Kind.PLUS) return true;   // comparações
                        if (t instanceof MethodTree || t instanceof LambdaExpressionTree || t instanceof ClassTree) return false;
                    }
                    return false;
                }
                @Override public Void visitLiteral(LiteralTree lit, Void v) {
                    if (lit.getKind() != Tree.Kind.STRING_LITERAL || consumed.contains(lit)) return null;
                    TreePath p = getCurrentPath(); String text = (String) lit.getValue();
                    long s0 = pos.getStartPosition(cu, lit); if (src.startsWith("\"\"\"", (int) s0)) return null;   // text block = prompt
                    if (!inMethod(p) || skippedCall(p)) { if (natural(text)) skipped.add(rel + ":" + lm.getLineNumber(s0) + " " + text); return null; }
                    // sobe a cadeia de concatenação
                    TreePath top = p; while (top.getParentPath() != null && top.getParentPath().getLeaf() instanceof BinaryTree b && b.getKind() == Tree.Kind.PLUS) top = top.getParentPath();
                    if (top.getLeaf() != lit) {
                        List<ExpressionTree> ops = new ArrayList<>(); flatten((ExpressionTree) top.getLeaf(), ops);
                        for (ExpressionTree o : ops) consumed.add(o); consumed.add(top.getLeaf());
                        boolean any = false; for (ExpressionTree o : ops) if (o instanceof LiteralTree l && l.getKind() == Tree.Kind.STRING_LITERAL && natural((String) l.getValue())) any = true;
                        if (!any) return null;
                        int firstStr = -1; for (int i = 0; i < ops.size(); i++) if (ops.get(i) instanceof LiteralTree l && l.getKind() == Tree.Kind.STRING_LITERAL) { firstStr = i; break; }
                        StringBuilder pat = new StringBuilder(); List<String> args = new ArrayList<>();
                        if (firstStr > 0) { StringBuilder a = new StringBuilder("("); for (int i = 0; i < firstStr; i++) a.append(i > 0 ? " + " : "").append(text(ops.get(i))); a.append(")"); args.add(a.toString()); pat.append("{0}"); }
                        for (int i = Math.max(firstStr, 0); i < ops.size(); i++) {
                            ExpressionTree o = ops.get(i);
                            if (o instanceof LiteralTree l && l.getKind() == Tree.Kind.STRING_LITERAL) pat.append(mf((String) l.getValue()));
                            else if (o instanceof LiteralTree l && l.getKind() == Tree.Kind.CHAR_LITERAL) pat.append(mf(String.valueOf(l.getValue())));
                            else { pat.append("{").append(args.size()).append("}"); args.add(text(o)); }
                        }
                        String key = keyFor(pat.toString(), nsF, rel);
                        found.add(new Found(rel, lm.getLineNumber(s0), key, pat.toString()));
                        edits.add(new Edit(pos.getStartPosition(cu, top.getLeaf()), pos.getEndPosition(cu, top.getLeaf()), "Msg.t(\"" + key + "\"" + (args.isEmpty() ? "" : ", " + String.join(", ", args)) + ")"));
                        return null;
                    }
                    if (!natural(text)) return null;
                    String key = keyFor(mf(text), nsF, rel);
                    found.add(new Found(rel, lm.getLineNumber(s0), key, text));
                    edits.add(new Edit(s0, pos.getEndPosition(cu, lit), "Msg.t(\"" + key + "\")"));
                    return null;
                }
                void flatten(ExpressionTree e, List<ExpressionTree> out) { if (e instanceof BinaryTree b && b.getKind() == Tree.Kind.PLUS) { flatten(b.getLeftOperand(), out); flatten(b.getRightOperand(), out); } else out.add(e); }
                String text(Tree t) { return src.substring((int) pos.getStartPosition(cu, t), (int) pos.getEndPosition(cu, t)); }
            }.scan(cu, null);
            if (edits.isEmpty()) return 0;
            edits.sort((a, b) -> Long.compare(b.start, a.start));
            StringBuilder out = new StringBuilder(src); long limit = Long.MAX_VALUE; int n = 0;
            for (Edit e : edits) { if (e.end > limit) continue; out.replace((int) e.start, (int) e.end, e.text); limit = e.start; n++; }
            String result = out.toString();
            if (!result.contains("import br.com.fashionai.application.common.Msg;") && !cls.equals("Msg")) {
                int imp = result.indexOf("\nimport "); if (imp < 0) imp = result.indexOf(";\n") + 1;
                result = result.substring(0, imp + 1) + "import br.com.fashionai.application.common.Msg;\n" + result.substring(imp + 1);
            }
            if (!dry) Files.writeString(file, result, StandardCharsets.UTF_8);
            return n;
        }
    }
}
