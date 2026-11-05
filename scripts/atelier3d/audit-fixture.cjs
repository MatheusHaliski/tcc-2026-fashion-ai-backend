/** Isolated browser API fixture. No database, user account, brand asset or external inference. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
function inspection(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw Error("Not GLB");
  const root = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString().trim());
  const primitives = {};
  root.nodes.forEach((node, n) => {
    if (node.mesh === undefined) return;
    root.meshes[node.mesh].primitives.forEach((p, i) => {
      primitives[`n${n}.p${i}`] = root.accessors[p.attributes.POSITION].count;
    });
  });
  return { nodes: root.nodes.length, meshes: root.meshes.length, materials: root.materials.length,
    vertices: Object.values(primitives).reduce((a, b) => a + b, 0), primitives,
    skinned: false, morphs: false, animated: false, extensions: root.extensionsUsed ?? [] };
}
function auditFixture(output) {
  fs.mkdirSync(output, { recursive: true });
  const gender = { sources: [], status: "INCOMPLETE", suggestion: null, hash: "synthetic-no-products",
    options: [{ id: "unisex", codigo: "UNISEX", nome: "Unissex" }] };
  const state = { asset: null, current: null, history: [], assets: new Map(), versions: new Map(), revoked: false, conflict: false, uploads: 0, saves: [] };
  async function route(requestRoute) {
    const req = requestRoute.request(), url = new URL(req.url()), p = url.pathname;
    if (!p.startsWith("/api/") && !p.startsWith("/bff/")) return requestRoute.continue();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
    const reply = (json, status = 200) => requestRoute.fulfill({ status, json, headers });
    if (req.method() === "OPTIONS") return requestRoute.fulfill({ status: 204, headers });
    if (!p.startsWith("/api/atelier/guest/")) {
      if (p.endsWith("/refresh")) return reply({}, 401);
      return reply(p === "/api/client/config" ? {} : { items: [], count: 0 });
    }
    if (state.revoked) return reply({ code: "ATELIER_GUEST", message: "Convite revogado" }, 401);
    const viewer = p.includes("/viewer/");
    if (p.endsWith("/scene")) return reply({ title: "Auditoria local — bases de vestuário", edit: !viewer,
      export: !viewer, manageGuests: false, asset: state.asset, current: state.current, history: state.history });
    if (p.endsWith("/gender-evidence")) return reply(gender);
    if (p.endsWith("/assets") && req.method() === "POST") {
      if (viewer) return reply({}, 403);
      const form = await new Response(req.postDataBuffer(), { headers: { "content-type": req.headers()["content-type"] } }).formData();
      const file = form.get("file"), bytes = Buffer.from(await file.arrayBuffer()), id = "asset" + (++state.uploads);
      const asset = { id, filename: file.name, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), inspection: inspection(bytes) };
      state.assets.set(id, { asset, bytes }); state.asset = asset;
      fs.writeFileSync(path.join(output, file.name), bytes);
      return reply(asset);
    }
    const assetMatch = p.match(/\/assets\/([^/]+)(\/metadata)?$/);
    if (assetMatch) {
      const entry = state.assets.get(assetMatch[1]);
      if (!entry) return reply({}, 404);
      if (assetMatch[2]) return reply(entry.asset);
      return requestRoute.fulfill({ body: entry.bytes, contentType: "model/gltf-binary", headers });
    }
    if (p.endsWith("/versions") && req.method() === "POST") {
      if (viewer) return reply({}, 403);
      const cmd = req.postDataJSON();
      if (state.conflict || cmd.expectedSequence !== (state.current?.sequence ?? 0))
        return reply({ code: "ATELIER_3D_CONFLICT", message: "Outra edição foi salva" }, 409);
      const sequence = cmd.expectedSequence + 1;
      state.current = { id: "v" + sequence, sequence, assetId: cmd.assetId, author: "fixture:editor",
        createdAt: "2026-11-05T20:00:00Z", document: cmd.document, gender, confirmedTipoLookId: cmd.confirmedTipoLookId };
      state.history.unshift(state.current); state.versions.set(state.current.id, state.current); state.saves.push(cmd);
      return reply(state.current);
    }
    const version = p.match(/\/versions\/([^/]+)$/);
    if (version) return reply(state.versions.get(version[1]));
    return reply({ code: "UNMOCKED", message: p }, 404);
  }
  return { state, route };
}
module.exports = { auditFixture, inspection };
