/* Production frontend smoke test with local fixtures only; never accesses a live API. */
const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript-ast');
const output = 'docs/refactoring/gof/evidence/browser';
const fixture = {};
new Function('exports', ts.transpileModule(fs.readFileSync('test-utils/glb-fixture.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(fixture);
const glb = Buffer.from(fixture.triangle());
const gender = { sources: [{id:'p',name:'Test garment',gender:'MEN',normalized:'MASCULINO'}],
  status:'READY',suggestion:'MASCULINO',hash:'local-fixture',options:[{id:'male',codigo:'MASCULINO',nome:'Masculino'}] };
const current = {id:'v1',sequence:1,assetId:'a1',author:'local-test',createdAt:'2026-10-30T00:00:00Z',
  document:{nodes:{},materials:{},vertices:{}},gender,confirmedTipoLookId:'male'};
const scene = {title:'Atelier — teste local',edit:true,export:true,manageGuests:false,
  asset:{id:'a1',filename:'triangle.glb',bytes:glb.length,sha256:'a'.repeat(64),inspection:{nodes:1,meshes:1,materials:1,
    vertices:3,skinned:false,morphs:false,animated:false,primitives:{'n0.p0':3},extensions:[]}},current,history:[current]};
const user = {id:'u1',username:'test',displayName:'Local test',profileType:'PESSOAL',verified:false,privateAccount:false};
(async () => {
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({executablePath:'/workspace/.tooling/browsers/chromium-1248/chrome-linux64/chrome',
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context = await browser.newContext({viewport:{width:1280,height:1000},locale:'pt-BR'});
    await context.addCookies([{name:'fai_rt_h',value:'1',url:'http://127.0.0.1:3122'}]);
    const saves=[],errors=[];
    await context.route(/\/(api|bff)\//,async route => {
      const request=route.request(),url=new URL(request.url()),p=url.pathname;let body=[];
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
      if(p==='/bff/auth/refresh')body={accessToken:'local-fixture'};
      else if(p==='/api/me')body={user,email:'test@example.invalid',emailVerified:true,status:'ACTIVE',role:'USER',twoFactorEnabled:false};
      else if(p.endsWith('/assets/a1'))return route.fulfill({status:200,body:glb,contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
      else if(p.endsWith('/gender-evidence'))body=gender;
      else if(p.endsWith('/versions')&&request.method()==='POST'){
        const command=request.postDataJSON();saves.push(command);body={...current,sequence:2,document:command.document};
      } else if(p==='/api/atelier/projects/project/scene')body=scene;
      else if(p.includes('unread'))body={count:0};
      else if(p.includes('notifications'))body={items:[],total:0};
      else if(p.includes('preferences'))body={};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3122/atelier/projects/project/editor',{waitUntil:'domcontentloaded'});
    const position=page.getByLabel('Posição — unidades do arquivo X',{exact:true});await position.waitFor();
    await page.getByRole('checkbox',{name:'Salvar automaticamente',exact:true}).uncheck();
    await position.fill('0.12');
    await page.getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal(await position.inputValue(),'0');
    await page.getByRole('button',{name:'Refazer',exact:true}).click();assert.equal(await position.inputValue(),'0.12');
    await page.getByLabel('Rotação — graus Y',{exact:true}).fill('180');
    await page.getByLabel('Cor',{exact:true}).fill('#2266aa');
    await page.getByLabel('Posição do vértice Z',{exact:true}).fill('0.2');
    await Promise.all([
      page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/versions')),
      page.getByRole('button',{name:'Salvar',exact:true}).click(),
    ]);
    await page.getByRole('status').filter({hasText:'Versão carregada'}).waitFor();
    assert.equal(saves.length,1);assert.deepEqual(saves[0].document.nodes.n0.position,[0.12,0,0]);
    assert.equal(saves[0].document.nodes.n0.rotation[1],Math.PI);
    assert.equal(saves[0].document.materials['n0.p0'].color,'#2266aa');
    assert.deepEqual(saves[0].document.vertices['n0.p0']['0'],[0,0,0.2]);
    await page.screenshot({path:output+'/desktop.png',fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:output+'/mobile.png',fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(output+'/result.json',JSON.stringify({status:'passed',scope:'Production frontend with mocked API and synthetic GLB; no real backend or DB',saves,errors},null,2));
    console.log('Browser editor smoke passed: undo/redo, transform/material/vertex save, desktop/mobile captures, no page errors.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
