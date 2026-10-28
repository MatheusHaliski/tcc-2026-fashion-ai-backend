// T06 — estresse: quadros, tempo de quadro e chamadas de desenho WebGL por quadro nas cenas do v1 (laboratório).
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const INIT = () => {
  const stats = { calls: 0, tris: 0 }; window.__draw = stats;
  const wrap = (proto) => {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = proto[name]; if (!f) continue;
      proto[name] = function (mode, a, b, c, d) { stats.calls++; const count = name.startsWith('drawElements') ? a : b; const inst = name.endsWith('Instanced') ? (name === 'drawElementsInstanced' ? d : c) : 1; if (mode === 4) stats.tris += (count / 3) * (inst || 1); return f.apply(this, arguments); };
    }
  };
  if (window.WebGL2RenderingContext) wrap(WebGL2RenderingContext.prototype); wrap(WebGLRenderingContext.prototype);
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = [];
  for (const [k, z] of [['heist-neutro', 4.2], ['heist-gala', 2.2], ['heist-gala', -2.5]]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.addInitScript(INIT);
    await p.goto(`http://localhost:3123/lab/scenes?s=${k}&z=${z}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await p.waitForSelector('#scene-viewer canvas', { timeout: 300000 }); await p.waitForTimeout(16000);
    const m = await p.evaluate(() => new Promise((done) => {
      const times = []; let last = performance.now(); const d0 = { ...window.__draw }; const t0 = last;
      const step = (t) => { times.push(t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(step); else {
        const s = times.slice(1).sort((a, c) => a - c), n = s.length; const d = window.__draw;
        done({ frames: n, avgMs: s.reduce((a, c) => a + c, 0) / n, p95Ms: s[Math.floor(n * 0.95)], callsPerFrame: (d.calls - d0.calls) / n, trisPerFrame: (d.tris - d0.tris) / n, heapMb: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null });
      } };
      requestAnimationFrame(step);
    }));
    await p.locator('#scene-viewer').screenshot({ path: `${out}/lab-${k}-${z}.png` });
    res.push({ scene: k, z, ...Object.fromEntries(Object.entries(m).map(([a, v]) => [a, typeof v === 'number' ? Math.round(v * 10) / 10 : v])) });
    console.log(JSON.stringify(res[res.length - 1]));
    await p.close();
  }
  fs.writeFileSync(`${out}/perf.json`, JSON.stringify({ renderer: 'Chromium headless + SwiftShader (CPU), 1280x720, sem GPU', results: res }, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
