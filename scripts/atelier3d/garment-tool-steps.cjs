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

exports.run = async function run({ page, out, state }) {
  const h = helpers(page, out);
  await page.getByLabel("Salvar automaticamente").uncheck();
  await h.view("Frente");
  await h.press("Enquadrar (F)");
  await h.shot("00-camiseta-base");
  const results = {};
  const only = (process.env.STEPS || "material,paint,print,shape,extras,export").split(",");
  const all = { material, paint };
  for (const [name, step] of Object.entries(all)) if (only.includes(name)) results[name] = await step(h, page, state);
  fs.writeFileSync(path.join(out, "last-document.json"), JSON.stringify(state.saves.at(-1)?.document ?? null).slice(0, 2000));
  return results;
};
