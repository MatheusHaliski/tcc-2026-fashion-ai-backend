#!/usr/bin/env node
/**
 * Codemod de i18n (RF23): extrai os textos embutidos em app/, components/ e lib/ para o catálogo pt-BR
 * (lib/i18n/messages/pt-BR.json) e troca cada um por t("chave") / tr("chave") / rich("chave", vars, tags).
 *
 *   node scripts/i18n/extract.js [--dry] [--wide] [--files a.tsx,b.tsx] [--verbose]
 *
 * Passo A — expressões: atributos JSX textuais, propriedades textuais de objetos (label:, hint:…), toast/confirm,
 *           literais, templates (`${x} peças` → "{x} peças") e concatenações; em nível de módulo a propriedade vira
 *           `get label() { return tr("chave"); }`.
 * Passo B — texto JSX: cada "corrida" de texto + expressões + elementos inline (<b>, <a>, <Link>, <br/>) vira UMA
 *           mensagem ICU ("Você tem {n} <0>peças</0>") renderizada por rich(); texto simples vira t("chave").
 * Passo C — injeta `const { t } = useI18n();` nos componentes/hooks, os imports e `t` nas dependências de
 *           useMemo/useCallback.
 * Chaves: <namespace do arquivo>.<slug do texto>; textos repetidos em 2+ arquivos sobem para common.<slug>.
 * --wide: também atributos/propriedades fora das listas e literais soltos dentro de componentes quando o texto é
 *         claramente linguagem natural (acento, frase, palavra capitalizada).
 */
const ts = require("typescript"); const fs = require("fs"); const path = require("path");
const R = require("./rules");
const ROOT = path.resolve(__dirname, "..", "..");
const CATALOG = path.join(ROOT, "lib/i18n/messages/pt-BR.json");
const REPORT = path.join(ROOT, "scripts/i18n/extract-report.json");
const args = process.argv.slice(2);
const argVal = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const opt = { dry: args.includes("--dry"), wide: args.includes("--wide"), verbose: args.includes("--verbose"), files: argVal("--files") ? argVal("--files").split(",") : null };
const DIRS = ["app", "components", "lib"].map((d) => path.join(ROOT, d));
const SKIP = [/\/lib\/i18n\//, /\/lib\/api\/labels-/, /\/lib\/api\/client\.ts$/, /\/lib\/api\/types\.ts$/, /\.d\.ts$/, /\/app\/layout\.tsx$/];
const INLINE = new Set(["b", "strong", "i", "em", "span", "a", "code", "small", "u", "s", "kbd", "sup", "sub", "mark", "abbr", "br", "wbr", "Link", "time", "q", "cite", "del", "ins"]);
const SKIP_CALLEES = R.SKIP_CALLEES;

// ---------------------------------------------------------------- catálogo e chaves
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const byText = new Map(); for (const [k, v] of Object.entries(catalog)) if (!byText.has(v)) byText.set(v, k);
const newKeys = new Set(); const usage = new Map(); const report = { files: {}, skipped: [], stats: { edits: 0, keys: 0, files: 0 } };
const use = (key, file) => { if (!usage.has(key)) usage.set(key, new Set()); usage.get(key).add(file); };
function nsOf(file) {
  let parts = path.relative(ROOT, file).replace(/\\/g, "/").replace(/\.(tsx|ts)$/, "").split("/").filter((p) => !/^\(.*\)$/.test(p));
  if (parts[0] === "app") { parts.shift(); if (parts[parts.length - 1] === "page") parts.pop(); if (!parts.length) parts = ["home"]; }
  else if (parts[0] === "components") parts.shift();
  return parts.map((p) => p.replace(/^\[\.{0,3}(.+?)\]$/, "$1").replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase())).join(".");
}
function slugOf(message) {
  const words = message.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\{[^}]*\}/g, " ").replace(/<\/?[a-z0-9_]+\/?>/g, " ").replace(/''/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  let s = words.slice(0, 5).join("_"); if (s.length > 40) s = s.slice(0, 40).replace(/_[^_]*$/, "") || s.slice(0, 40);
  if (!s) { let h = 0; for (const ch of message) h = (h * 31 + ch.charCodeAt(0)) >>> 0; s = "txt_" + h.toString(36); }
  if (/^\d/.test(s)) s = "n" + s;
  return s;
}
function keyFor(message, file) {
  if (byText.has(message)) { const k = byText.get(message); use(k, file); return k; }
  const ns = nsOf(file); const slug = slugOf(message); let key = `${ns}.${slug}`; let n = 2;
  while (catalog[key] !== undefined) key = `${ns}.${slug}_${n++}`;
  catalog[key] = message; byText.set(message, key); newKeys.add(key); use(key, file); return key;
}
// ---------------------------------------------------------------- texto
const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", hellip: "…", mdash: "—", ndash: "–", times: "×", middot: "·", bull: "•", laquo: "«", raquo: "»", copy: "©", reg: "®", deg: "°", euro: "€", rarr: "→", larr: "←", uarr: "↑", darr: "↓", check: "✓", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", trade: "™", ensp: " ", emsp: " ", thinsp: " ", shy: "­", hearts: "♥", star: "☆", starf: "★" };
const decode = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m));
const esc = (s) => s.replace(/'/g, "''").replace(/[{}]/g, (m) => `'${m}'`).replace(/<(?=\/?[A-Za-z0-9_]+\s*\/?>)/g, "'<'");
const hasLetters = (s) => R.HAS_LETTERS.test(s);
/** Mesma regra do JSX: apara as linhas, remove linhas vazias e junta com um espaço (porta de fixupWhitespaceAndDecodeEntities do TypeScript). */
function fixupJsxText(text) {
  let acc; let first = 0; let last = -1;
  const add = (line) => { const d = decode(line); acc = acc === undefined ? d : acc + " " + d; };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13) { if (first !== -1 && last !== -1) add(text.substr(first, last - first + 1)); first = -1; }
    else if (c !== 32 && c !== 9 && c !== 11 && c !== 12 && c !== 0xa0 && c !== 0xfeff) { last = i; if (first === -1) first = i; }
  }
  if (first !== -1) add(text.substr(first));
  return acc;
}
const isIdent = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
function nameFor(expr, used) {
  let n = "value";
  const e = ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) ? expr.expression : expr;
  if (ts.isIdentifier(e)) n = e.text;
  else if (ts.isPropertyAccessExpression(e)) { n = e.name.text; if (n === "length") n = (ts.isIdentifier(e.expression) ? e.expression.text : ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text : "item") + "Count"; }
  else if (ts.isElementAccessExpression(e)) n = ts.isIdentifier(e.expression) ? e.expression.text : "item";
  else if (ts.isCallExpression(e)) {
    const c = e.expression;
    if (ts.isIdentifier(c)) n = c.text === "t" || c.text === "tr" ? "txt" : c.text === "label" ? "label" : c.text;
    else if (ts.isPropertyAccessExpression(c)) n = ts.isIdentifier(c.expression) ? c.expression.text : c.name.text;
  } else if (ts.isConditionalExpression(e) || ts.isBinaryExpression(e)) n = "value";
  else if (ts.isNumericLiteral(e)) n = "n";
  else if (ts.isTemplateExpression(e)) n = "text";
  if (!isIdent(n) || n === "t" || n === "tr" || n === "rich") n = "value";
  n = n.replace(/^(fmt|format)([A-Z])/, (_, __, c) => c.toLowerCase());
  let out = n; let i = 2; while (used.has(out)) out = n + i++;
  used.add(out); return out;
}
const varsCode = (vars) => (vars.length ? `{ ${vars.map(([n, s]) => (n === s ? n : `${n}: ${s}`)).join(", ")} }` : "");
// ---------------------------------------------------------------- AST helpers
const sfOf = (file, src) => ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n);
function fnName(fn) {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  let p = fn.parent;
  while (p && (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p))) p = p.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isExportAssignment(p)) return "Default";
  return null;
}
const isComponentName = (n) => !!n && (/^[A-Z]/.test(n) || /^use[A-Z]/.test(n));
function componentOf(node) { let p = node.parent; while (p) { if (isFnLike(p) && isComponentName(fnName(p))) return p; p = p.parent; } return null; }
function inAnyFunction(node) { let p = node.parent; while (p) { if (isFnLike(p)) return true; p = p.parent; } return false; }
function bindsName(bn, name) {
  if (!bn) return false;
  if (ts.isIdentifier(bn)) return bn.text === name;
  if (ts.isObjectBindingPattern(bn) || ts.isArrayBindingPattern(bn)) return bn.elements.some((e) => !ts.isOmittedExpression(e) && bindsName(e.name, name));
  return false;
}
const isUseI18nCall = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "useI18n";
function shadowed(node, name, stopAt) {
  let p = node.parent;
  while (p && p !== (stopAt ? stopAt.parent : null)) {
    if (isFnLike(p) && p.parameters.some((pr) => bindsName(pr.name, name))) return true;
    if (ts.isBlock(p) || ts.isSourceFile(p)) for (const st of p.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (bindsName(d.name, name) && !(d.initializer && isUseI18nCall(d.initializer))) return true;
    if ((ts.isForOfStatement(p) || ts.isForInStatement(p)) && ts.isVariableDeclarationList(p.initializer)) for (const d of p.initializer.declarations) if (bindsName(d.name, name)) return true;
    if (ts.isCatchClause(p) && p.variableDeclaration && bindsName(p.variableDeclaration.name, name)) return true;
    p = p.parent;
  }
  return false;
}
function inParameter(node, comp) { let p = node.parent; while (p && p !== comp) { if (ts.isParameter(p)) return true; p = p.parent; } return false; }
function translatorFor(node) {
  const comp = componentOf(node);
  if (comp && !shadowed(node, "t", comp) && !inParameter(node, comp)) return { fn: "t", rich: "rich", comp };
  return { fn: "tr", rich: "trRich", comp: null };
}
function applyEdits(src, edits) {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let limit = Infinity; const kept = [];
  for (const e of edits) { if (e.end > limit) { if (opt.verbose) console.log("  (edição sobreposta ignorada)", e.text.slice(0, 60)); continue; } kept.push(e); limit = e.start; }
  for (const e of kept) src = src.slice(0, e.start) + e.text + src.slice(e.end);
  report.stats.edits += kept.length;
  return src;
}
const within = (node, ranges) => ranges.some(([s, e]) => node.getStart() >= s && node.end <= e);
// ---------------------------------------------------------------- passo A
function passA(src, file) {
  const sf = sfOf(file, src); const edits = []; const consumed = []; let touched = 0;
  const wide = opt.wide;
  const emit = (node, text) => { edits.push({ start: node.getStart(sf), end: node.end, text }); consumed.push([node.getStart(sf), node.end]); touched++; };
  /** Troca as folhas textuais de `e`; `test` decide o que é texto; `fn` é t ou tr. Devolve true se trocou algo. */
  function transformExpr(e, test, fn, target = edits) {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      const raw = ts.isStringLiteral(e) && e.parent && ts.isJsxAttribute(e.parent) ? decode(e.text) : e.text;
      if (!test(raw)) return false;
      const key = keyFor(R.clean(raw), file);
      const text = `${fn}("${key}")`;
      if (target === edits) emit(e, text); else target.push({ start: e.getStart(sf), end: e.end, text });
      return true;
    }
    if (ts.isTemplateExpression(e)) {
      const parts = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)];
      if (!parts.some((p) => hasLetters(p) && test(R.clean(p)))) return false;
      const used = new Set(); const vars = []; let msg = esc(e.head.text);
      for (const s of e.templateSpans) { const n = nameFor(s.expression, used); vars.push([n, s.expression.getText(sf)]); msg += `{${n}}` + esc(s.literal.text); }
      const key = keyFor(msg.replace(/\s+/g, " "), file);
      const text = `${fn}("${key}", ${varsCode(vars)})`;
      if (target === edits) emit(e, text); else target.push({ start: e.getStart(sf), end: e.end, text });
      return true;
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const ops = []; const flat = (x) => { if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(x.left); flat(x.right); } else ops.push(x); };
      flat(e);
      const strs = ops.filter((o) => ts.isStringLiteral(o) || ts.isNoSubstitutionTemplateLiteral(o));
      if (!strs.length || !strs.some((s) => hasLetters(s.text) && test(s.text))) return false;
      if (ops.some((o) => ts.isNumericLiteral(o))) return false;
      const used = new Set(); const vars = []; let msg = "";
      for (const o of ops) { if (ts.isStringLiteral(o) || ts.isNoSubstitutionTemplateLiteral(o)) msg += esc(o.text); else if (ts.isTemplateExpression(o)) { msg += esc(o.head.text); for (const s of o.templateSpans) { const n = nameFor(s.expression, used); vars.push([n, s.expression.getText(sf)]); msg += `{${n}}` + esc(s.literal.text); } } else { const n = nameFor(o, used); vars.push([n, o.getText(sf)]); msg += `{${n}}`; } }
      const key = keyFor(msg.replace(/\s+/g, " "), file);
      const text = `${fn}("${key}", ${varsCode(vars)})`;
      if (target === edits) emit(e, text); else target.push({ start: e.getStart(sf), end: e.end, text });
      return true;
    }
    if (ts.isConditionalExpression(e)) { const a = transformExpr(e.whenTrue, test, fn, target); const b = transformExpr(e.whenFalse, test, fn, target); return a || b; }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) { const a = transformExpr(e.left, test, fn, target); const b = transformExpr(e.right, test, fn, target); return a || b; }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e)) return transformExpr(e.expression, test, fn, target);
    return false;
  }
  function handleProperty(node, test) {
    const nameText = node.name.getText(sf);
    if (!inAnyFunction(node)) {                                  // nível de módulo: getter preguiçoso com tr()
      const sub = []; if (!transformExpr(node.initializer, test, "tr", sub)) return;
      const base = node.initializer.getStart(sf); let init = node.initializer.getText(sf);
      sub.sort((a, b) => b.start - a.start).forEach((e) => { init = init.slice(0, e.start - base) + e.text + init.slice(e.end - base); });
      emit(node, `get ${nameText}() { return ${init}; }`);
      return;
    }
    transformExpr(node.initializer, test, translatorFor(node).fn);
  }
  const visit = (node) => {
    if (consumed.length && within(node, consumed)) return;
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf); const init = node.initializer;
      const known = R.TEXT_ATTRS.has(name); const ok = known || (wide && !R.ATTR_BLOCKLIST.has(name) && !/^(data-|aria-(hidden|expanded|selected|checked|pressed|current|disabled|live|atomic|busy|controls|describedby|labelledby|owns|haspopup|modal|sort|level|setsize|posinset|valuemin|valuemax|valuenow|orientation|multiline|multiselectable|readonly|required|invalid|autocomplete|activedescendant|colcount|colindex|rowcount|rowindex|flowto|keyshortcuts|relevant|dropeffect|grabbed))/.test(name));
      if (ok) {
        const test = known ? R.isText : R.isNatural;
        if (ts.isStringLiteral(init)) { const raw = decode(init.text); if (test(raw)) { const key = keyFor(R.clean(raw), file); emit(init, `{${translatorFor(node).fn}("${key}")}`); } }
        else if (ts.isJsxExpression(init) && init.expression) transformExpr(init.expression, test, translatorFor(node).fn);
      }
      ts.forEachChild(node, visit); return;
    }
    if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      transformExpr(node.expression, R.isText, translatorFor(node).fn); ts.forEachChild(node, visit); return;
    }
    if (ts.isPropertyAssignment(node) && !ts.isComputedPropertyName(node.name)) {
      const name = node.name.getText(sf).replace(/["']/g, "");
      if (R.TEXT_PROPS.has(name)) handleProperty(node, inAnyFunction(node) && !/^(name|body|error|status|unit)$/.test(name) ? R.isText : R.isNatural);
      else if (wide && !R.PROP_BLOCKLIST.has(name)) handleProperty(node, R.isNatural);
      ts.forEachChild(node, visit); return;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      if (R.TEXT_CALLS.has(callee)) node.arguments.forEach((a) => transformExpr(a, R.isText, translatorFor(node).fn));
      ts.forEachChild(node, visit); return;
    }
    if (wide && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && inAnyFunction(node)) {
      const p = node.parent;
      let attrAnc = p; while (attrAnc && !ts.isJsxAttribute(attrAnc) && !ts.isJsxElement(attrAnc) && !ts.isBlock(attrAnc) && !isFnLike(attrAnc)) attrAnc = attrAnc.parent;
      const inBlockedAttr = attrAnc && ts.isJsxAttribute(attrAnc) && (R.ATTR_BLOCKLIST.has(attrAnc.name.getText(sf)) || /^(data-|aria-)/.test(attrAnc.name.getText(sf)));
      const skip = inBlockedAttr || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isPropertyAssignment(p) || (ts.isArrayLiteralExpression(p) && !inAnyFunction(p)) || ts.isComputedPropertyName(p) || ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p)
        || ts.isCaseClause(p) || ts.isJsxAttribute(p) || ts.isTemplateSpan(p) || ts.isExpressionStatement(p) || ts.isTypeAssertionExpression(p) || ts.isEnumMember(p) || ts.isModuleDeclaration(p)
        || (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind))
        || (ts.isCallExpression(p) && SKIP_CALLEES.test(p.expression.getText(sf))) || (ts.isNewExpression(p)) || (ts.isPropertyAccessExpression(p))
        || (ts.isVariableDeclaration(p) && /^(id|key|code|slug|url|href|path|route|src|type|kind|className|cls|style|hex|color|sku|storageKey|endpoint|query|selector|pattern|regex|fmt)$/i.test(p.name.getText(sf)))
        ;
      if (!skip) { let target = node; while (ts.isBinaryExpression(target.parent) && target.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) target = target.parent; if (transformExpr(target, R.isNatural, translatorFor(node).fn)) return; }
      ts.forEachChild(node, visit); return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { src: applyEdits(src, edits), touched };
}
// ---------------------------------------------------------------- passo B
function passB(src, file) {
  const sf = sfOf(file, src); const edits = []; const consumed = []; let touched = 0;
  const tagOf = (el) => (ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName).getText(sf);
  const containsJsxOrFn = (e) => { let f = false; const w = (n) => { if (f) return; if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n) || isFnLike(n)) { f = true; return; } ts.forEachChild(n, w); }; w(e); return f; };
  const isBreaker = (c) => {
    if (ts.isJsxText(c)) return false;
    if (ts.isJsxExpression(c)) return !c.expression || !!c.dotDotDotToken || containsJsxOrFn(c.expression);
    if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) return !inlineable(c);
    return true;
  };
  const inlineable = (el) => INLINE.has(tagOf(el)) && (ts.isJsxSelfClosingElement(el) || el.children.every((ch) => !isBreaker(ch)));
  function build(items, used, vars, tags) {
    let msg = "";
    for (const it of items) {
      if (ts.isJsxText(it)) { const f = fixupJsxText(it.text); if (f !== undefined) msg += esc(f); }
      else if (ts.isJsxExpression(it)) {
        const e = it.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) { msg += esc(e.text); continue; }
        const n = nameFor(e, used); vars.push([n, e.getText(sf)]); msg += `{${n}}`;
      } else if (ts.isJsxSelfClosingElement(it)) { const i = tags.length; tags.push(`${i}: () => ${it.getText(sf)}`); msg += `<${i}/>`; }
      else if (ts.isJsxElement(it)) { const i = tags.length; tags.push(null); const inner = build(it.children, used, vars, tags); tags[i] = `${i}: ($c) => ${it.openingElement.getText(sf)}{$c}${it.closingElement.getText(sf)}`; msg += `<${i}>${inner}</${i}>`; }
    }
    return msg;
  }
  function handleRun(run, parent) {
    const topText = run.some((c) => ts.isJsxText(c) && hasLetters(fixupJsxText(c.text) ?? ""));
    if (!topText) { run.forEach((c) => { if (ts.isJsxElement(c)) processChildren(c.children, c); }); return; }
    const used = new Set(); const vars = []; const tags = [];
    let msg = build(run, used, vars, tags);
    const idx = parent.children.indexOf(run[0]); const idxEnd = parent.children.indexOf(run[run.length - 1]);
    const lead = /^[ \t]/.test(msg) && idx > 0; const trail = /[ \t]$/.test(msg) && idxEnd < parent.children.length - 1;
    msg = msg.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[ \t]{2,}/g, " ");
    const textOnly = R.clean(msg.replace(/\{[^}]*\}/g, " ").replace(/<\/?\d+\/?>/g, " "));
    if (!hasLetters(textOnly) || R.ALLOW.has(textOnly) || /^[A-Z0-9_\-\s·]+$/.test(textOnly) || /[{}`]/.test(textOnly)) return;
    const tl = translatorFor(parent); const key = keyFor(msg, file);
    const code = tags.length ? `${tl.rich}("${key}", ${vars.length ? varsCode(vars) : "undefined"}, { ${tags.join(", ")} })` : vars.length ? `${tl.fn}("${key}", ${varsCode(vars)})` : `${tl.fn}("${key}")`;
    const first = run[0]; const last = run[run.length - 1];
    const start = ts.isJsxText(first) ? first.pos : first.getStart(sf); const end = last.end;
    edits.push({ start, end, text: `${lead ? '{" "}' : ""}{${code}}${trail ? '{" "}' : ""}` });
    consumed.push([start, end]); touched++;
  }
  const done = new Set();
  function processChildren(children, parent) {
    if (done.has(parent)) return; done.add(parent);
    let run = []; const runs = [];
    for (const c of children) { if (isBreaker(c)) { if (run.length) runs.push(run); run = []; } else run.push(c); }
    if (run.length) runs.push(run);
    runs.forEach((r) => handleRun(r, parent));
  }
  const visit = (node) => {
    if (consumed.length && within(node, consumed)) return;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) processChildren(node.children, node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { src: applyEdits(src, edits), touched };
}
// ---------------------------------------------------------------- passo C
function passC(src, file) {
  const sf = sfOf(file, src); const edits = [];
  const needs = new Map();   // componente → Set(t|rich)
  const usedFns = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const n = node.expression.text;
      if (n === "t" || n === "rich") { const comp = componentOf(node); if (comp && !shadowed(node, n, comp)) { if (!needs.has(comp)) needs.set(comp, new Set()); needs.get(comp).add(n); } }
      if (n === "tr" || n === "trRich") usedFns.add(n);
      if ((n === "useMemo" || n === "useCallback") && node.arguments.length >= 2 && isFnLike(node.arguments[0]) && ts.isArrayLiteralExpression(node.arguments[1])) {
        const inner = new Set(); const w = (x) => { if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && (x.expression.text === "t" || x.expression.text === "rich") && componentOf(x) === componentOf(node)) inner.add(x.expression.text); ts.forEachChild(x, w); };
        w(node.arguments[0]);
        const deps = node.arguments[1]; const have = new Set(deps.elements.filter(ts.isIdentifier).map((e) => e.text));
        const add = [...inner].filter((x) => !have.has(x));
        if (add.length) edits.push({ start: deps.end - 1, end: deps.end - 1, text: (deps.elements.length ? ", " : "") + add.join(", ") });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  let needHook = false;
  for (const [comp, names] of needs) {
    const body = comp.body; if (!body) continue;
    let decl = null;
    if (ts.isBlock(body)) for (const st of body.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.initializer && isUseI18nCall(d.initializer) && ts.isObjectBindingPattern(d.name)) decl = d;
    if (decl) {
      const have = new Set(decl.name.elements.map((e) => e.name.getText(sf)));
      const add = [...names].filter((x) => !have.has(x));
      if (add.length) { const st = decl.name.getStart(sf); const ins = st + src.slice(st, decl.name.end - 1).replace(/\s+$/, "").length; edits.push({ start: ins, end: ins, text: `, ${add.join(", ")}` }); needHook = true; }
      continue;
    }
    const line = `const { ${[...names].sort().join(", ")} } = useI18n();`; needHook = true;
    if (ts.isBlock(body)) edits.push({ start: body.getStart(sf) + 1, end: body.getStart(sf) + 1, text: `\n  ${line}` });
    else edits.push({ start: body.getStart(sf), end: body.end, text: `{ ${line} return (${body.getText(sf)}); }` });
  }
  src = applyEdits(src, edits);
  // imports
  const wanted = new Set(usedFns); if (needHook || /\buseI18n\(/.test(src)) wanted.add("useI18n");
  if (!wanted.size) return src;
  const sf2 = sfOf(file, src); let importDecl = null; let lastImport = null;
  for (const st of sf2.statements) { if (ts.isImportDeclaration(st)) { lastImport = st; if (st.moduleSpecifier.text === "@/lib/i18n/i18n" && st.importClause && st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) importDecl = st; } }
  if (importDecl) {
    const have = new Set(importDecl.importClause.namedBindings.elements.map((e) => e.name.text));
    const add = [...wanted].filter((x) => !have.has(x));
    if (add.length) { const nb = importDecl.importClause.namedBindings; const st = nb.getStart(sf2); const ins = st + src.slice(st, nb.end - 1).replace(/\s+$/, "").length; src = src.slice(0, ins) + `, ${add.join(", ")}` + src.slice(ins); }
  } else {
    const line = `import { ${[...wanted].sort().join(", ")} } from "@/lib/i18n/i18n";\n`;
    let pos = 0;
    if (lastImport) pos = lastImport.end + 1;
    else { const first = sf2.statements[0]; if (first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression)) pos = first.end + 1; }
    src = src.slice(0, pos) + line + src.slice(pos);
  }
  return src;
}
// ---------------------------------------------------------------- execução
function listFiles() {
  const out = [];
  const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!/node_modules|\.next/.test(f)) walk(p); } else if (/\.(tsx|ts)$/.test(f) && !SKIP.some((re) => re.test(p))) out.push(p); } };
  DIRS.forEach((d) => fs.existsSync(d) && walk(d));
  return out;
}
const files = opt.files ? opt.files.map((f) => path.resolve(ROOT, f)) : listFiles();
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const isServer = /\/app\//.test(file) && !/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(original) && /<[A-Za-z]/.test(original);
  if (isServer) { report.skipped.push({ file: path.relative(ROOT, file), reason: "server component (tratar manualmente com translate(locale, …))" }); continue; }
  let src = original;
  const a = passA(src, file); src = a.src;
  const b = passB(src, file); src = b.src;
  if (a.touched || b.touched || /\b(t|rich|tr|trRich)\(/.test(src)) src = passC(src, file);
  if (src !== original) {
    report.files[path.relative(ROOT, file)] = { a: a.touched, b: b.touched }; report.stats.files++;
    if (!opt.dry) fs.writeFileSync(file, src);
    if (opt.verbose) console.log(`${path.relative(ROOT, file)}: A=${a.touched} B=${b.touched}`);
  }
}
// promoção para common.* dos textos usados em 2+ arquivos
const renames = new Map();
for (const key of newKeys) {
  const files = usage.get(key); if (!files || files.size < 2 || key.startsWith("common.")) continue;
  const slug = key.slice(key.lastIndexOf(".") + 1).replace(/_\d+$/, ""); let nk = `common.${slug}`; let n = 2;
  while (catalog[nk] !== undefined && catalog[nk] !== catalog[key]) nk = `common.${slug}_${n++}`;
  if (nk === key) continue;
  catalog[nk] = catalog[key]; delete catalog[key]; renames.set(key, nk);
}
if (renames.size && !opt.dry) {
  const touched = new Set(); for (const [k] of renames) for (const f of usage.get(k)) touched.add(f);
  for (const f of touched) { let s = fs.readFileSync(f, "utf8"); for (const [k, nk] of renames) s = s.split(`"${k}"`).join(`"${nk}"`); fs.writeFileSync(f, s); }
}
report.stats.keys = newKeys.size; report.renamed = renames.size;
if (!opt.dry) {
  const ordered = {}; Object.keys(catalog).sort((x, y) => x.localeCompare(y)).forEach((k) => { ordered[k] = catalog[k]; });
  fs.writeFileSync(CATALOG, JSON.stringify(ordered, null, 2) + "\n");
}
fs.writeFileSync(REPORT, JSON.stringify({ ...report, newKeys: [...newKeys].map((k) => renames.get(k) ?? k) }, null, 1));
console.log(`${opt.dry ? "[dry] " : ""}${report.stats.files} arquivos, ${report.stats.edits} edições, ${report.stats.keys} chaves novas (${renames.size} promovidas a common.*), ${report.skipped.length} ignorados`);
