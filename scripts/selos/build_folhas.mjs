// RF25 — folhas de selo editáveis. Cada SVG de docs/novo-projeto/insumos/selos vira camadas:
//   public/selos/folha/<id>.webp          arte da folha SEM textos e SEM o emblema central (480×600)
//   public/selos/folha/<id>-emblema.webp  só o emblema central (sacola, camisa…), recortado, com fundo transparente
//   lib/seals/templates.json → "folha"    posição/estilo de cada texto (série, título, subtítulo, rótulo, legenda, ano,
//                                          texto do emblema) e a caixa do emblema — o criador escreve os textos do selo
//                                          e troca o emblema por uma imagem enviada ou um texto.
// As medidas vêm do próprio navegador (getCTM/getBBox), então posição, fonte e cor são as da arte original.
// Nas folhas de estudo de marcas e ícones, os textos padrão são neutros (sem nome, cidade ou ano de marca real).
// Uso: node scripts/selos/build_folhas.mjs   (Playwright: PLAYWRIGHT_MODULE=<caminho do index.mjs> se não for dependência)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "docs", "novo-projeto", "insumos", "selos");
const OUT = join(ROOT, "public", "selos", "folha");
const SETS = [["fashion-ai", "fai"], ["materiais", "mat"], ["marcas-e-icones", "col"], ["marcas-em-material", "cmat"]];
// textos padrão neutros nas folhas de estudo (o título vazio vira o nome do selo)
const NEUTRAL = { col: { title: "", style: "EDIÇÃO OFICIAL", year: "2026", emblem: "FAI" }, cmat: { title: "", year: "2026", emblem: "FAI" } };
const SUBTITLE_FIX = { "Música · Pleasing": "Música · Estilo" };

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) unlinkSync(join(OUT, f));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setContent("<div id=host></div><canvas id=c></canvas>");
const folha = [];
for (const [dir, prefix] of SETS) {
  for (const file of readdirSync(join(SRC, dir)).filter((n) => n.endsWith(".svg")).sort()) {
    const id = `${prefix}-${file.split("-")[0]}`;
    const svg = readFileSync(join(SRC, dir, file), "utf8");
    const r = await page.evaluate(async (src) => {
      const host = document.getElementById("host");
      host.innerHTML = src;
      const root = host.querySelector("svg");
      root.setAttribute("width", "240"); root.setAttribute("height", "300");
      const emblem = root.querySelector("#sacola") ?? root.querySelector("#camisa");
      const rootInv = root.getScreenCTM().inverse();
      const abs = (el) => rootInv.multiply(el.getScreenCTM());
      const inside = (el, anc) => !!anc && anc.contains(el);
      const slots = {};
      for (const t of [...root.querySelectorAll("text")]) {
        const m = abs(t); const cs = getComputedStyle(t);
        const x = Number(t.getAttribute("x") ?? 0), y = Number(t.getAttribute("y") ?? 0);
        const ay = m.b * x + m.d * y + m.f;                               // y absoluto (para classificar)
        const size = parseFloat(cs.fontSize);
        let slot;
        if (inside(t, emblem)) slot = "emblem";
        else if (t.closest("#denominacao")) slot = "year";
        else if (ay < 56) slot = "series";
        else if (ay < 120 && size * Math.abs(m.a) >= 15) slot = "title";
        else if (ay < 120 && cs.fontStyle === "italic") slot = "subtitle";
        else if (ay >= 250 && ay < 263) slot = "style";
        else if (ay >= 263) slot = "caption";
        else slot = "emblem";                                             // monograma no painel
        const bb = t.getBBox();
        const fill = cs.fill.startsWith("rgb") ? "#" + cs.fill.match(/\d+/g).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("").toUpperCase() : cs.fill;
        if (!slots[slot]) slots[slot] = {
          text: t.textContent, x, y, m: [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => Math.round(v * 1000) / 1000),
          size, weight: cs.fontWeight, family: t.getAttribute("font-family") ?? t.closest("[font-family]")?.getAttribute("font-family") ?? "sans-serif",
          italic: cs.fontStyle === "italic", ls: parseFloat(t.getAttribute("letter-spacing") ?? "0") || 0, anchor: cs.textAnchor, fill,
          opacity: Number(t.getAttribute("opacity") ?? 1), w: Math.round(bb.width * Math.abs(m.a) * 10) / 10,
        };
        t.remove();
      }
      let box = null;
      if (emblem) {
        const m = abs(emblem); const b = emblem.getBBox();
        const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        box = { x: Math.min(...xs) - 2, y: Math.min(...ys) - 2, w: Math.max(...xs) - Math.min(...xs) + 4, h: Math.max(...ys) - Math.min(...ys) + 4 };
      }
      const draw = async (svgText, sx, sy, sw, sh, W, H) => {
        const img = new Image(); img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgText))); await img.decode();
        const c = document.getElementById("c"); c.width = W; c.height = H; const g = c.getContext("2d"); g.clearRect(0, 0, W, H);
        g.drawImage(img, sx * 2, sy * 2, sw * 2, sh * 2, 0, 0, W, H);
        return c.toDataURL("image/webp", 0.86).split(",")[1];
      };
      // serializa já em 2× (480×600): os recortes abaixo trabalham em pixels 2×
      const ser = () => new XMLSerializer().serializeToString(root).replace('width="240" height="300"', 'width="480" height="600"');
      let emblemB64 = null;
      if (emblem) {
        root.setAttribute("visibility", "hidden"); emblem.setAttribute("visibility", "visible");
        emblemB64 = await draw(ser(), box.x, box.y, box.w, box.h, Math.round(box.w * 2), Math.round(box.h * 2));
        root.removeAttribute("visibility"); emblem.removeAttribute("visibility");
        emblem.setAttribute("display", "none");
      }
      const base = await draw(ser(), 0, 0, 240, 300, 480, 600);
      const ink = slots.title?.fill ?? slots.series?.fill ?? "#1C1A17";
      return { slots, box: box && Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 10) / 10])), base, emblemB64, ink };
    }, svg);
    writeFileSync(join(OUT, `${id}.webp`), Buffer.from(r.base, "base64"));
    if (r.emblemB64) writeFileSync(join(OUT, `${id}-emblema.webp`), Buffer.from(r.emblemB64, "base64"));
    const neutral = NEUTRAL[prefix] ?? { title: "" };
    for (const [k, v] of Object.entries(neutral)) if (r.slots[k]) r.slots[k].text = v;
    if (r.slots.subtitle && SUBTITLE_FIX[r.slots.subtitle.text]) r.slots.subtitle.text = SUBTITLE_FIX[r.slots.subtitle.text];
    folha.push({ id: `folha/${id}`, src: `/selos/folha/${id}.webp`, emblem: r.box && { src: `/selos/folha/${id}-emblema.webp`, ...r.box }, ink: r.ink, style: r.slots.style?.text ?? "", slots: r.slots });
    console.log(id, Object.keys(r.slots).join(","), r.box ? "emblema" : "sem emblema");
  }
}
await browser.close();
for (const path of [join(ROOT, "lib", "seals", "templates.json"), join(ROOT, "fai-application", "src", "main", "resources", "seals", "templates.json")]) {
  const cat = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  cat.folha = path.includes("fai-application") ? folha.map((t) => ({ id: t.id })) : folha;
  writeFileSync(path, JSON.stringify(cat, null, 1) + "\n");
}
console.log("folhas:", folha.length);
