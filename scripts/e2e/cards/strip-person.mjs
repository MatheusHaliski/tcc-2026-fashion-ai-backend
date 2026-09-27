import { readFileSync, writeFileSync } from "node:fs";
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [,, base, photo, out] = process.argv;
const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
await ctx.route("**/__fx/pessoa.jpg", (r) => r.fulfill({ body: readFileSync(photo), contentType: "image/jpeg" }));
await ctx.route("http://localhost:8080/**", (r) => r.fulfill({ json: {} }));
const p = await ctx.newPage(); const logs = []; p.on("console", (m) => logs.push(m.text().slice(0, 200)));
await p.goto(`${base}/lab/body`, { waitUntil: "networkidle", timeout: 180000 });
await p.waitForFunction(() => !!window.__bodyLab, null, { timeout: 60000 });
const res = {};
for (const keep of [undefined, "full"]) {
  const r = await p.evaluate(async ({ keep }) => {
    const x = await window.__bodyLab.stripPerson(`${location.origin}/__fx/pessoa.jpg`, keep);
    const blob = await (await fetch(x.outUrl)).blob(); const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { meta: { personFound: x.personFound, removedPct: x.removedPct, people: x.people, ms: x.ms, garments: x.garments, bytes: x.bytes }, b64: btoa(s) };
  }, { keep });
  writeFileSync(`${out}-${keep ?? "auto"}.png`, Buffer.from(r.b64, "base64")); res[keep ?? "auto"] = r.meta;
}
console.log(JSON.stringify(res, null, 1)); if (logs.some((l) => /error/i.test(l))) console.log(logs.filter((l) => /error/i.test(l)).slice(0, 5).join("\n"));
await b.close();
