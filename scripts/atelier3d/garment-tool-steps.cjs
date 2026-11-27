/** Passos da evidência das ferramentas de roupa (material → pintura → estampa → modelagem → acabamentos). */
const fs = require("node:fs");
const path = require("node:path");

function helpers(page, out) {
  const canvas = () => page.locator("canvas").first();
  return {
    settle: (ms = 1500) => page.waitForTimeout(ms),
    async shot(name) {
      await page.waitForTimeout(1200);
      await canvas().screenshot({ path: path.join(out, name + ".png") });
    },
    async full(name) {
      await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
    },
    async view(label) {
      await page.getByRole("button", { name: /Vista da câmera/ }).click();
      await page.getByRole("option", { name: label, exact: true }).click();
    },
    part: (label) => page.getByRole("button", { name: label, exact: true }).first().click(),
    tab: (label) => page.getByRole("tab", { name: label, exact: true }).click(),
    press: (label) => page.getByRole("button", { name: label, exact: true }).click(),
    async drag(points) {
      await canvas().scrollIntoViewIfNeeded();
      const box = await canvas().boundingBox();
      const at = ([x, y]) => [box.x + box.width * x, box.y + box.height * y];
      await page.mouse.move(...at(points[0]));
      await page.mouse.down();
      for (const point of points.slice(1)) await page.mouse.move(...at(point), { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    },
    async click(point) {
      await canvas().scrollIntoViewIfNeeded();
      const box = await canvas().boundingBox();
      await page.mouse.click(box.x + box.width * point[0], box.y + box.height * point[1]);
      await page.waitForTimeout(400);
    },
    async slider(name, value) {
      const input = page.getByRole("slider", { name }).last();
      await input.fill(String(value));
      await input.blur();
    },
  };
}

async function material(h, page) {
  await h.tab("Material");
  await h.press("Jeans");
  await h.shot("01-material-jeans");
  await h.press("Veludo");
  await h.shot("02-material-veludo");
  await h.press("Couro");
  await h.press("Sintético esportivo");
  await h.press("Metálico e lantejoula");
  await h.shot("03-material-lantejoula");
  await h.press("Algodão");
  await h.full("04-painel-material");
  const pressed = await page.getByRole("button", { name: "Algodão", exact: true }).getAttribute("aria-pressed");
  if (pressed !== "true") throw Error("preset não ficou marcado");
  return { presets: 6 };
}

async function paint(h, page) {
  await h.tab("Pintura");
  await h.part("Corpo");
  await h.press("Pintar na peça");
  await page.getByLabel("Cor da tinta").fill("#c8423b");
  await h.slider(/Tamanho do pincel/, 60);
  await h.drag([[0.42, 0.45], [0.5, 0.5], [0.58, 0.45], [0.6, 0.6]]);
  await page.getByLabel("Cor da tinta").fill("#f2c14e");
  await h.drag([[0.4, 0.62], [0.6, 0.66]]);
  await h.shot("05-pintura-tracos");
  await h.press("Desfazer");
  await h.shot("06-pintura-desfeita");
  await h.press("Refazer");
  await h.press("Borracha");
  await h.drag([[0.5, 0.4], [0.5, 0.7]]);
  await h.shot("07-pintura-borracha");
  await h.press("Pincel");
  await h.press("Nova camada");
  await page.getByLabel("Cor da tinta").fill("#1f3a5f");
  await h.press("Preencher a parte inteira");
  await h.slider(/Opacidade da camada/, 0.35);
  await h.shot("07b-pintura-camada-preenchida");
  await h.press("Parar de pintar");
  await h.full("08-painel-pintura");
  return { strokes: 3, layers: 2 };
}

const STAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="92" fill="#f2c14e" stroke="#1f3a5f" stroke-width="10"/><polygon points="100,30 117,80 170,80 127,112 143,165 100,133 57,165 73,112 30,80 83,80" fill="#c8423b"/></svg>';
const LEAF_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#f4f1ea"/><path d="M60 15 C95 35 95 85 60 105 C25 85 25 35 60 15Z" fill="#2f6b4f"/></svg>';
function image(envName, fallbackName, svg) {
  const file = process.env[envName];
  if (file) return { name: path.basename(file), mimeType: file.endsWith(".png") ? "image/png" : "image/jpeg", buffer: fs.readFileSync(file) };
  return { name: fallbackName, mimeType: "image/svg+xml", buffer: Buffer.from(svg) };
}

async function print(h, page) {
  await h.tab("Estampa");
  await h.press("Listras");
  await h.shot("09-estampa-listras");
  await h.press("Xadrez");
  await h.slider(/^Repetições/, 10);
  await h.shot("10-estampa-xadrez");
  await h.press("Poá");
  await h.press("Camuflagem");
  await h.shot("11-estampa-camuflagem");
  await h.press("Remover padrão");
  await h.part("Corpo");
  await page.getByLabel("Escolher imagem").setInputFiles(image("DECAL_PNG", "estrela.svg", STAR_SVG));
  await page.getByRole("img", { name: "Estampa enviada" }).waitFor();
  await h.press("Aplicar estampa na peça");
  await h.click([0.5, 0.45]);
  await h.shot("12-decalque-aplicado");
  await h.slider(/Tamanho da estampa/, 0.4);
  await h.slider(/Rotação da estampa/, 30);
  await h.click([0.42, 0.58]);
  await h.shot("13-decalque-recolocado-girado");
  await h.press("Concluir posicionamento");
  await page.getByLabel("Escolher imagem").setInputFiles(image("TILE_PNG", "folha.svg", LEAF_SVG));
  await h.part("Manga esquerda");
  await h.press("Parte selecionada");
  await h.press("Usar como padrão repetido");
  await h.shot("14-padrao-imagem-manga");
  await h.press("Peça inteira");
  await h.full("15-painel-estampa");
  return { patterns: 4, decals: 1, imageTile: 1 };
}

async function shape(h, page) {
  await h.tab("Modelagem");
  await h.part("Corpo");
  await h.press("Parte selecionada");
  await h.view("Lado esquerdo");
  await h.shot("16-forma-base-lateral");
  await h.view("Frente");
  await h.slider(/Comprimento da barra/, 25);
  await h.shot("17-forma-barra-alongada");
  await h.slider(/Profundidade do decote/, 30);
  await h.slider(/Largura e folga/, 12);
  await h.shot("18-forma-decote-folga");
  await h.press("Esculpir com pincel");
  await h.slider(/Raio do pincel/, 0.18);
  await h.slider(/^Força/, 0.5);
  for (let i = 0; i < 2; i++) await h.drag([[0.36, 0.5], [0.4, 0.55], [0.36, 0.6]]);
  await h.press("Inflar");
  await h.drag([[0.5, 0.62], [0.52, 0.66]]);
  await h.press("Parar de esculpir");
  await h.view("Perspectiva");
  await h.shot("19-forma-esculpida-simetria");
  await h.press("Desfazer");
  await h.shot("20-forma-desfazer-inflar");
  await h.press("Peça inteira");
  await h.view("Frente");
  await h.full("21-painel-modelagem");
  return { fit: 3, sculptStrokes: 4 };
}

exports.run = async function run({ page, out, state }) {
  const h = helpers(page, out);
  await page.getByLabel("Salvar automaticamente").uncheck();
  await h.view("Frente");
  await h.press("Enquadrar (F)");
  await h.shot("00-camiseta-base");
  const results = {};
  const only = (process.env.STEPS || "material,paint,print,shape,extras,export").split(",");
  const all = { material, paint, print, shape };
  for (const [name, step] of Object.entries(all)) if (only.includes(name)) results[name] = await step(h, page, state);
  fs.writeFileSync(path.join(out, "last-document.json"), JSON.stringify(state.saves.at(-1)?.document ?? null).slice(0, 2000));
  return results;
};
