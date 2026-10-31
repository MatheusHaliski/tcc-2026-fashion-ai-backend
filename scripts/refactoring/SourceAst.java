import com.github.javaparser.*;
import com.github.javaparser.ast.*;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import java.nio.file.*;
import java.util.*;

/** Syntax-only inventory. Does not compile, instantiate beans or access application configuration. */
public class SourceAst {
    static Object value(Expression e) {
        if (e.isStringLiteralExpr()) return e.asStringLiteralExpr().asString();
        if (e.isArrayInitializerExpr()) return e.asArrayInitializerExpr().getValues().stream().map(SourceAst::value).toList();
        return e.toString();
    }
    static Map<String,Object> annotations(NodeList<AnnotationExpr> list) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (var a : list) {
            Map<String,Object> args = new LinkedHashMap<>();
            if (a.isSingleMemberAnnotationExpr()) args.put("value", value(a.asSingleMemberAnnotationExpr().getMemberValue()));
            if (a.isNormalAnnotationExpr()) for (var pair : a.asNormalAnnotationExpr().getPairs()) args.put(pair.getNameAsString(), value(pair.getValue()));
            result.put(a.getName().getIdentifier(), args);
        }
        return result;
    }
    static int line(Node n) { return n.getBegin().map(p -> p.line).orElse(0); }
    static String json(Object v) {
        if (v == null) return "null";
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        if (v instanceof Map<?,?> m) return "{" + String.join(",", m.entrySet().stream().map(e -> json(e.getKey().toString())+":"+json(e.getValue())).toList()) + "}";
        if (v instanceof Collection<?> c) return "[" + String.join(",", c.stream().map(SourceAst::json).toList()) + "]";
        String s = v.toString(); StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) switch(c) {
            case '"': b.append("\\\""); break; case '\\': b.append("\\\\"); break;
            case '\n': b.append("\\n"); break; case '\r': b.append("\\r"); break; case '\t': b.append("\\t"); break;
            default: if(c < 32) b.append(String.format("\\u%04x",(int)c)); else b.append(c);
        }
        return b.append('"').toString();
    }
    public static void main(String[] args) throws Exception {
        var parser = new JavaParser(new ParserConfiguration().setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21));
        for (String file : Files.readAllLines(Path.of(args[0]))) {
            Map<String,Object> row = new LinkedHashMap<>(); row.put("path",file);
            try {
                var parsed = parser.parse(Path.of(file));
                row.put("diagnostics", parsed.getProblems().stream().map(Object::toString).toList());
                if (!parsed.isSuccessful()) { row.put("status","parse_error"); System.out.println(json(row)); continue; }
                var cu = parsed.getResult().orElseThrow(); row.put("status","parsed");
                row.put("package", cu.getPackageDeclaration().map(p -> p.getNameAsString()).orElse(""));
                row.put("imports",cu.getImports().stream().map(i -> i.getNameAsString()+(i.isAsterisk()?".*":"")).toList());
                List<Object> types = new ArrayList<>();
                for (TypeDeclaration<?> type : cu.findAll(TypeDeclaration.class)) {
                    Map<String,Object> t = new LinkedHashMap<>(); t.put("name",type.getNameAsString()); t.put("line",line(type));
                    t.put("annotations",annotations(type.getAnnotations()));
                    if (type instanceof ClassOrInterfaceDeclaration c) {
                        t.put("extends",c.getExtendedTypes().stream().map(Object::toString).toList());
                        t.put("implements",c.getImplementedTypes().stream().map(Object::toString).toList());
                        t.put("interface",c.isInterface());
                    }
                    List<Object> fields = new ArrayList<>();
                    for (var field : type.getFields()) for(var variable:field.getVariables()) fields.add(Map.of("name",variable.getNameAsString(),"type",variable.getType().toString(),"annotations",annotations(field.getAnnotations())));
                    t.put("fields",fields);
                    List<Object> methods = new ArrayList<>();
                    for (var m : type.getMethods()) {
                        Map<String,Object> method = new LinkedHashMap<>(); method.put("name",m.getNameAsString()); method.put("line",line(m));
                        method.put("annotations",annotations(m.getAnnotations())); method.put("returnType",m.getType().toString());
                        method.put("parameters",m.getParameters().stream().map(p -> Map.of("name",p.getNameAsString(),"type",p.getType().toString(),"annotations",annotations(p.getAnnotations()))).toList());
                        method.put("calls",m.findAll(MethodCallExpr.class).stream().map(c -> c.getScope().map(s -> s.toString()+".").orElse("")+c.getNameAsString()).distinct().toList());
                        methods.add(method);
                    }
                    t.put("methods",methods); types.add(t);
                }
                row.put("types",types);
            } catch (Exception ex) { row.put("status","parse_error"); row.put("error",ex.getClass().getSimpleName()); }
            System.out.println(json(row));
        }
    }
}
