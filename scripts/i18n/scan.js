// Auditoria de i18n: encontra texto embutido (hardcoded) em app/, components/ e lib/ usando a AST do TypeScript.
// Uso: node scripts/i18n/scan.js [--wide] [--json out.json] [--fail]
//   padrão: texto JSX, atributos textuais, propriedades textuais (label:, hint:…), toast/confirm/alert
//   --wide : além disso, QUALQUER literal em linguagem natural (acento, frase, palavra capitalizada) em qualquer posição
const ts = require("typescript"); const fs = require("fs"); const path = require("path");
const R = require("./rules");
const ROOT = path.resolve(__dirname, "..", "..");
const DIRS = ["app", "components", "lib"].map((d) => path.join(ROOT, d));
const SKIP = [/\/lib\/i18n\//, /\/lib\/api\/labels-/, /\.d\.ts$/, /\/lib\/assets\//, /\/lib\/icons\//, /\/app\/gate\// /* gate: tela neutra, sem os catálogos do app de propósito */];
const args = process.argv.slice(2); const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null; const fail = args.includes("--fail"); const wide = args.includes("--wide");
const found = [];
function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!/node_modules|\.next/.test(f)) walk(p); } else if (/\.(tsx|ts)$/.test(f) && !SKIP.some((re) => re.test(p))) scan(p); } }
function report(file, node, sf, text, kind) { const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf)); found.push({ file: path.relative(ROOT, file), line: line + 1, text: R.clean(text), kind }); }
function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const seen = new Set();
  const checkExpr = (e, kind, test) => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) { if (test(e.text)) { seen.add(e); report(file, e, sf, e.text, kind); } }
    else if (ts.isTemplateExpression(e)) { const parts = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)]; if (parts.some((p) => test(p))) { seen.add(e); report(file, e, sf, parts.join("…"), kind + ":template"); } }
    else if (ts.isConditionalExpression(e)) { checkExpr(e.whenTrue, kind, test); checkExpr(e.whenFalse, kind, test); }
    else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken].includes(e.operatorToken.kind)) { checkExpr(e.left, kind, test); checkExpr(e.right, kind, test); }
    else if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) checkExpr(e.expression, kind, test);
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) { if (R.isText(node.text)) report(file, node, sf, node.text, "jsx-text"); }
    else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf); const init = node.initializer;
      const known = R.TEXT_ATTRS.has(name); const test = known ? R.isText : R.isNatural;
      if (known || (!R.ATTR_BLOCKLIST.has(name) && !/^(data-|aria-)/.test(name))) {
        if (ts.isStringLiteral(init)) { if (test(init.text)) { seen.add(init); report(file, init, sf, init.text, "attr:" + name); } }
        else if (ts.isJsxExpression(init) && init.expression) checkExpr(init.expression, "attr:" + name, test);
      }
    } else if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) checkExpr(node.expression, "jsx-expr", R.isText);
    else if (ts.isPropertyAssignment(node) && !ts.isComputedPropertyName(node.name)) {
      const name = node.name.getText(sf).replace(/["']/g, "");
      if (R.TEXT_PROPS.has(name)) checkExpr(node.initializer, "prop:" + name, R.isNatural);
      else if (wide && !R.PROP_BLOCKLIST.has(name)) checkExpr(node.initializer, "prop?:" + name, R.isNatural);
    } else if (ts.isCallExpression(node)) { const callee = node.expression.getText(sf); if (R.TEXT_CALLS.has(callee)) node.arguments.forEach((a) => checkExpr(a, "call:" + callee, R.isText)); }
    else if (wide && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && !seen.has(node)) {
      const p = node.parent;
      let attrAnc = p; while (attrAnc && !ts.isJsxAttribute(attrAnc) && !ts.isJsxElement(attrAnc) && !ts.isBlock(attrAnc)) attrAnc = attrAnc.parent;
      const inBlockedAttr = attrAnc && ts.isJsxAttribute(attrAnc) && (R.ATTR_BLOCKLIST.has(attrAnc.name.getText(sf)) || /^(data-|aria-)/.test(attrAnc.name.getText(sf)));
      const skip = inBlockedAttr || (ts.isCallExpression(p) && R.SKIP_CALLEES.test(p.expression.getText(sf))) || ts.isNewExpression(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || (ts.isPropertyAssignment(p) && p.name === node) || ts.isComputedPropertyName(p) || ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isJsxAttribute(p) || ts.isExpressionStatement(p) || ts.isEnumMember(p) || ts.isTemplateSpan(p)
        || (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind));
      if (!skip) { const parts = ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map((s) => s.literal.text)] : [node.text]; if (parts.some((x) => R.isNatural(x))) report(file, node, sf, parts.join("…"), "literal:" + ts.SyntaxKind[p.kind]); }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
DIRS.forEach((d) => fs.existsSync(d) && walk(d));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(found, null, 1));
const byFile = {}; found.forEach((f) => { byFile[f.file] = (byFile[f.file] || 0) + 1; });
console.log(`${found.length} textos embutidos em ${Object.keys(byFile).length} arquivos${wide ? " (modo amplo)" : ""}`);
if (!jsonOut) found.slice(0, 60).forEach((f) => console.log(`${f.file}:${f.line} [${f.kind}] ${JSON.stringify(f.text.slice(0, 90))}`));
if (fail && found.length) process.exit(1);
