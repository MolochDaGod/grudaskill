#!/usr/bin/env node
/**
 * Offline model pipeline. The lab never loads FBX at runtime.
 *
 *   fbx2gltf   FBX  → glTF 2.0 / GLB   (Y-up, +Z forward)
 *   glb2glb    GLB  → optimized GLB    (weld, prune, draco | meshopt)
 *   glb2gltf   GLB  → .gltf + .bin     (inspect / edit, not for CDN)
 *
 * Runtime: GLTFLoader + Draco + meshopt only. Convert here, upload GLB to R2.
 *
 * Usage:
 *   node scripts/gltf-convert.mjs fbx2gltf  in.fbx  out.glb
 *   node scripts/gltf-convert.mjs glb2glb   in.glb  out.glb
 *   node scripts/gltf-convert.mjs glb2gltf  in.glb  out.gltf
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const [cmd, input, output] = process.argv.slice(2);
if (!cmd || !input || !output) {
  console.error("usage: node scripts/gltf-convert.mjs <fbx2gltf|glb2glb|glb2gltf> <in> <out>");
  process.exit(1);
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${bin} ${code}`))));
  });
}

async function npx(pkg, args) {
  const local = path.join(process.cwd(), "node_modules", ".bin", "gltf-transform");
  await run(local, args);
}

await mkdir(path.dirname(path.resolve(output)), { recursive: true });

if (cmd === "fbx2gltf") {
  // facebookincubator/FBX2glTF — binary GLB + optional Draco.
  // Fallback: Blender --background --python if the binary is missing.
  try {
    await run("FBX2glTF", ["--binary", "--draco", "-i", input, "-o", output]);
  } catch {
    console.error("FBX2glTF not on PATH. Install https://github.com/facebookincubator/FBX2glTF");
    console.error("or export from Blender: File → Export → glTF 2.0 (.glb), Y-up, +Z forward.");
    process.exit(1);
  }
} else if (cmd === "glb2glb") {
  await npx("@gltf-transform/cli", [
    "optimize",
    input,
    output,
    "--compress",
    "draco",
    "--texture-compress",
    "webp",
  ]);
} else if (cmd === "glb2gltf") {
  await npx("@gltf-transform/cli", ["copy", input, output]);
} else {
  console.error("unknown command", cmd);
  process.exit(1);
}
