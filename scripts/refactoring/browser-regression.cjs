const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const path=require('path');const phase=process.argv[2]||'before';if(!['before','after'].includes(phase))throw Error('phase must be before or after');const out=path.resolve('docs/refactoring/evidence',phase);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/workspace/.tooling/browsers/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'pt-BR',reducedMotion:'reduce'});
 await context.addCookies([{name:'fai_rt_h',value:'1',url:'http://127.0.0.1:3120'}]);
 const owner={id:'u1',username:'ana',displayName:'Ana Souza',profileType:'PESSOAL',verified:true,privateAccount:false,country:'BR'};
 let piece={id:'p1',owner,name:'Camisa azul — teste de selo',category:'upper_piece',subcategory:'shirt',sex:'UNISSEX',color:'blue',colorHex:'#3268a4',material:'COTTON',size:'m',style:['basic'],occasion:['casual'],seals:[],price:100,defaultImage:true,imageUrl:null,visibility:'PRIVATE',disponivel:true,availabilityStatus:'AVAILABLE',condition:'GOOD',background:{auraHype:'COMMON_STATIC_HORIZONTAL'},favorite:false,forSale:false,wearCount:0,estadoConservacao:null,counters:{likes:0,comments:0,shares:0,remixes:0,views:0,saves:0,reactions:{}},viewer:{liked:false,reactions:[],saved:false,canEdit:true,following:false},createdAt:'2026-10-29T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z'};
 const options=['NOVA','EXCELENTE','BOA','DESGASTADA','DANIFICADA'].map((codigo,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,codigo,nome:['Nova','Excelente','Boa','Desgastada','Danificada'][i]}));
 let mode='ready';const requests=[]; const badge={tier:'PECA',owner:'marca-teste',premium:false,name:'Peça azul — selo de teste',linkedPieceIds:['p1'],design:{kind:'FASHIONAI',mode:'TEMPLATE',template:'fai/01'}};
 await context.route(/\/(api|bff)\//,async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;let result={};
  if(path==='/api/catalog/default-asset')return route.continue();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(path==='/bff/auth/refresh') result={accessToken:'test-token'};
  else if(path==='/api/me')result={user:owner,email:'ana@example.com',emailVerified:true,status:'ACTIVE',role:'USER',twoFactorEnabled:false};
  else if(path==='/api/opcoes/estados-conservacao')result=options;
  else if(path==='/api/me/closet')result={items:[piece],page:0,size:24,total:1,hasMore:false};
  else if(path==='/api/pieces/seals'){requests.push({method:request.method(),path:new URL(request.url()).pathname+new URL(request.url()).search});result={items:{p1:[badge]}};}
  else if(path==='/api/pieces/p1'&&request.method()==='PUT') {const body=request.postDataJSON(); requests.push({method:'PUT',path,body}); piece={...piece,estadoConservacao:options.find(o=>o.id===body.estadoConservacaoId)||null};result=piece;}
  else if(path==='/api/pieces/p1'){if(mode==='loading')return; if(mode==='error')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Falha local de teste',code:'TEST'}) ,headers:{'access-control-allow-origin':'*'}});result=mode==='empty'?{}:{piece};}
  else if(path==='/api/taxonomy')result={subcategories:{upper_piece:['shirt']},colors:{blue:'#3268a4'},materials:['COTTON'],sizes:['m'],sexes:['UNISSEX'],occasions:['casual'],styles:['basic'],allowedOccasionsByCategory:{}};
  else if(path==='/api/hype/summaries')result={type:'PIECE',items:{p1:{status:'AVAILABLE',score:72,level:'HOT',calculatedAt:'2026-10-29T12:00:00Z',dimensions:{POPULARITY:62,ENGAGEMENT:71,TREND:82,TREND_VELOCITY:44,ORIGINALITY:65,RARITY:32,LONGEVITY:52,NOVELTY:28}}}};
  else if(path.includes('preferences'))result={};
  else if(path.includes('unread'))result={count:0};
  else if(path.includes('notifications'))result={items:[],total:0};
  else result=[];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result),headers:{'access-control-allow-origin':'*'}});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const capture=async name=>{await page.addStyleTag({content:'nextjs-portal{display:none!important}'});await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});};
 for(const [label,viewport] of [['desktop',{width:1280,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);
  await page.goto('http://127.0.0.1:3120/closet',{waitUntil:'domcontentloaded',timeout:60000});
  const card=page.locator('article.piece-card').first();await card.waitFor({timeout:60000});
  await card.getByRole('link',{name:'Camisa azul — teste de selo',exact:true}).click();
  const modal=page.getByRole('dialog',{name:/detalhe da peça/i});await modal.waitFor();
  await modal.locator('.card-seals .seal-medallion').waitFor();
  await page.waitForFunction(()=>{const img=document.querySelector('.dialog-card .pd-media img');return img&&img.complete&&img.naturalWidth>0});
  const info=modal.getByRole('tab',{name:/info/i}),hype=modal.getByRole('tab',{name:'Hype',exact:true});
  await info.click();await capture(label+'-modal-info');
  await hype.click();await modal.locator('.fashion-hype-cell').first().waitFor();await capture(label+'-modal-hype');
  await hype.press('ArrowLeft');if(await info.getAttribute('aria-selected')!=='true')throw Error('keyboard selection lost');
  await modal.getByRole('button',{name:/Mais opções/}).click();await page.getByRole('menuitem',{name:'Editar dados',exact:true}).click();
  const edit=page.getByRole('dialog',{name:'Editar dados',exact:true});await edit.waitFor();
  await edit.getByLabel('Estado de conservação',{exact:true}).waitFor();await capture(label+'-edit-dialog');
  await edit.getByRole('button',{name:'Fechar',exact:true}).click();
  await modal.getByRole('button',{name:'Fechar',exact:true}).click();
 }
 await page.setViewportSize({width:1280,height:1000});
 for(const state of ['error','empty','loading']){
  mode=state;
  await page.goto('http://127.0.0.1:3120/pieces/p1',{waitUntil:'domcontentloaded'});
  if(state==='error')await page.getByText('Falha local de teste').waitFor();
  if(state==='empty')await page.getByText(/não está mais disponível|nao esta mais|não existe/i).first().waitFor();
  if(state==='loading')await page.locator('.skeleton').first().waitFor();
  await capture('desktop-'+state);
 }
 fs.writeFileSync(out+'/browser-evidence.json',JSON.stringify({scope:'Frontend real local; API simulada; nenhum serviço/banco/GPU remoto utilizado.',phase,requests,pageErrors:errors},null,2));
 console.log(JSON.stringify({status:'passed',phase,pageErrors:errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
