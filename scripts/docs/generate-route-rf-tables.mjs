import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = process.cwd();
const diagramsRoot = path.join(repositoryRoot, "docs", "diagramas");
const outputRoot = path.join(repositoryRoot, "docs", "tabelas_estudo");
const header = [
  "Tela (rota frontend)",
  "Endpoint chamado pelo frontend",
  "Endpoint do backend",
  "Função Controller",
  "Função Service",
];

function csvValue(value) {
  const normalized = value.replaceAll("\n", " ").replaceAll(";", ",").trim();
  return /[",\r\n]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}

function displayName(relativeDirectory) {
  return relativeDirectory
    .toLowerCase()
    .replaceAll("/", "-")
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replaceAll(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function directoriesWithSequenceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = [];
  const sequenceFiles = entries.filter(
    (entry) => entry.isFile() && /sequencia.*\.puml$/i.test(entry.name),
  );

  if (sequenceFiles.length > 0) {
    directories.push({ directory, sequenceFiles: sequenceFiles.map((entry) => entry.name) });
  }

  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    directories.push(...(await directoriesWithSequenceFiles(path.join(directory, entry.name))));
  }

  return directories;
}

function participants(source) {
  const names = new Map();
  for (const match of source.matchAll(/^(?:boundary|control|participant)\s+"([^"]+)"\s+as\s+(\w+)/gm)) {
    names.set(match[2], match[1].replaceAll("\\n", " "));
  }
  return names;
}

function routeRows(source) {
  const names = participants(source);
  const lines = source.split("\n");
  const rows = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const endpoint = lines[index].match(
      /^\s*(\w+)\s+->\s+(\w+)\s*:\s*((?:GET|POST|PUT|PATCH|DELETE)\s+\/(?:api|bff)\/[^\s\\]+)/,
    );
    if (!endpoint) {
      continue;
    }

    const [, caller, controllerAlias, request] = endpoint;
    const [method, backendEndpoint] = request.split(/\s+/, 2);
    const key = `${method} ${backendEndpoint}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    let service = "Não identificado no diagrama";
    for (let nextIndex = index + 1; nextIndex < Math.min(index + 6, lines.length); nextIndex += 1) {
      const serviceCall = lines[nextIndex].match(
        new RegExp(`^\\s*${controllerAlias}\\s+->\\s+(\\w+)\\s*:\\s*([^\\s]+\\(\\))`),
      );
      if (serviceCall) {
        const serviceName = names.get(serviceCall[1]) ?? serviceCall[1];
        service = `${serviceName}.${serviceCall[2]}`;
        break;
      }
    }

    const frontendSource = names.get(caller) ?? caller;
    const controller = names.get(controllerAlias) ?? controllerAlias;
    const frontendEndpoint = backendEndpoint.startsWith("/api/auth/") &&
      ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"].includes(backendEndpoint)
      ? `${method} ${backendEndpoint.replace("/api/", "/bff/")}`
      : `${method} ${backendEndpoint} (direto)`;

    rows.push([
      frontendSource,
      frontendEndpoint,
      `${method} ${backendEndpoint}`,
      controller.includes("Controller") ? controller : "Não identificado no diagrama",
      service,
    ]);
  }

  return rows;
}

await mkdir(outputRoot, { recursive: true });
const diagramDirectories = await directoriesWithSequenceFiles(diagramsRoot);
let generated = 0;

for (const { directory, sequenceFiles } of diagramDirectories) {
  const relativeDirectory = path.relative(diagramsRoot, directory);
  if (!relativeDirectory.startsWith("RF")) {
    continue;
  }
  if (["RF1", "RF2"].includes(relativeDirectory)) {
    continue;
  }

  const rows = [];
  const seen = new Set();
  for (const sequenceFile of sequenceFiles) {
    const source = await readFile(path.join(directory, sequenceFile), "utf8");
    for (const row of routeRows(source)) {
      const key = row[2];
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row);
      }
    }
  }

  if (rows.length === 0) {
    rows.push([
      `Diagrama(s): ${sequenceFiles.join(", ")}`,
      "Não há chamada HTTP no diagrama",
      "Não há endpoint de backend",
      "Não se aplica",
      "Não se aplica",
    ]);
  }

  const output = [header, ...rows]
    .map((row) => row.map(csvValue).join(";"))
    .join("\n") + "\n";
  await writeFile(path.join(outputRoot, `rotas-${displayName(relativeDirectory)}.csv`), output, "utf8");
  generated += 1;
}

console.log(`Generated ${generated} route-to-RF mapping tables in ${outputRoot}`);