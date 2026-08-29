import * as THREE from "three";

/**
 * Stylized dirt/grass ground. MeshStandardMaterial + onBeforeCompile so
 * weather can still tint `color`, shadows stay, no extra npm.
 */
export function makeTerrain(radius = 22) {
  const geo = new THREE.CircleGeometry(radius, 96);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x5a4630,
    roughness: 0.96,
    metalness: 0.02,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vTerWorld;
varying float vTerH;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vTerWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
float h = sin(vTerWorld.x * 0.31) * 0.07 + sin(vTerWorld.z * 0.27 + 1.7) * 0.05;
transformed.z += h;
vTerH = h;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vTerWorld;
varying float vTerH;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
float dirt = smoothstep(-0.02, 0.08, vTerH);
vec3 grass = vec3(0.28, 0.46, 0.18);
vec3 soil = diffuseColor.rgb;
float ring = fract(length(vTerWorld.xz) * 0.035);
float band = smoothstep(0.0, 0.12, ring) * smoothstep(0.55, 0.4, ring);
diffuseColor.rgb = mix(soil, grass, dirt * 0.72);
diffuseColor.rgb = mix(diffuseColor.rgb, soil * 0.82, band * 0.25);`,
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}
