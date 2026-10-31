/* Syntax inventory only: no application modules are imported or executed. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript-ast');
const files = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const options = {baseUrl:process.cwd(),paths:{'@/*':['./*']},moduleResolution:ts.ModuleResolutionKind.Bundler,allowJs:true};
for(const file of files){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const imports=[],definitions=[],calls=[];let branches=0;
 const line=n=>source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
 function dependency(text,kind,typeOnly=false){
  const resolved=ts.resolveModuleName(text,file,options,ts.sys).resolvedModule;
  const target=resolved?.resolvedFileName;
  imports.push({specifier:text,kind,typeOnly,target:target&&!target.includes('node_modules/')?path.relative(process.cwd(),path.resolve(target)).replaceAll('\\','/'):null});
 }
 function visit(n){
  if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier))dependency(n.moduleSpecifier.text,'import',!!n.importClause?.isTypeOnly);
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))dependency(n.moduleSpecifier.text,'export',!!n.isTypeOnly);
  if(ts.isFunctionDeclaration(n)||ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isMethodDeclaration(n)){
   const name=n.name?.getText(source)||(ts.isVariableDeclaration(n.parent)?n.parent.name.getText(source):'<anonymous>');
   definitions.push({name,line:line(n),kind:/^use[A-Z]/.test(name)?'hook':/^[A-Z]/.test(name)&&/\.[jt]sx$/.test(file)?'component':'function'});
  }
  if(ts.isIfStatement(n)||ts.isConditionalExpression(n)||ts.isCaseClause(n)||ts.isCatchClause(n)||ts.isForStatement(n)||ts.isForOfStatement(n)||ts.isForInStatement(n)||ts.isWhileStatement(n))branches++;
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind))branches++;
  if(ts.isCallExpression(n)){
   const callee=n.expression.getText(source);
   if((n.expression.kind===ts.SyntaxKind.ImportKeyword||callee==='require')&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))dependency(n.arguments[0].text,'dynamic');
   const method=callee.split('.').at(-1).toUpperCase();
   if((['GET','POST','PUT','PATCH','DELETE'].includes(method)||callee==='fetch')&&n.arguments[0]){
    const arg=n.arguments[0];let route=null;
    if(ts.isStringLiteralLike(arg))route=arg.text;
    else if(ts.isTemplateExpression(arg))route=arg.getText(source).slice(1,-1).replace(/\$\{[^}]+\}/g,'{dynamic}');
    let verb=method;
    if(callee==='fetch') {
     const settings=n.arguments[1]; verb=settings?'UNRESOLVED_FETCH_METHOD':'GET';
     if(settings&&ts.isObjectLiteralExpression(settings)) {
      const declared=settings.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(source).replace(/['"]/g,'')==='method');
      if(declared&&ts.isStringLiteralLike(declared.initializer))verb=declared.initializer.text.toUpperCase();
      else if(!declared&&!settings.properties.some(ts.isSpreadAssignment))verb='GET';
     }
    }
    calls.push({method:verb,route:route||'UNRESOLVED_EXPRESSION',line:line(n),callee});
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(source);
 console.log(JSON.stringify({path:file,status:source.parseDiagnostics.length?'parse_error':'parsed',diagnostics:source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),imports,definitions,branches,calls}));
}
