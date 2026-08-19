import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run version:set -- 0.2.0");
  process.exit(1);
}

const packagePath = new URL("../package.json", import.meta.url);
const packageLockPath = new URL("../package-lock.json", import.meta.url);
const tauriPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const cargoPath = new URL("../src-tauri/Cargo.toml", import.meta.url);

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.version = version;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(await readFile(packageLockPath, "utf8"));
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;
await writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);

const tauriJson = JSON.parse(await readFile(tauriPath, "utf8"));
tauriJson.version = version;
await writeFile(tauriPath, `${JSON.stringify(tauriJson, null, 2)}\n`);

const cargo = await readFile(cargoPath, "utf8");
await writeFile(cargoPath, cargo.replace(/^version = "[^"]+"/m, `version = "${version}"`));

console.log(`E-task version set to ${version}`);
