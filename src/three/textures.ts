import * as THREE from "three";

/**
 * Procedural material textures drawn on 2D canvases — keeps the app fully
 * self-contained (no image assets, no network) while giving the dollhouse
 * theme believable wood / stone / carpet floors and marble worktops.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// deterministic pseudo-random so textures are stable between renders
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Warm honey-oak planks with per-plank tone variation, grain and joints. */
export function woodTexture(): THREE.CanvasTexture {
  if (cache.has("wood")) return cache.get("wood")!;
  const tex = makeCanvas(512, (ctx, s) => {
    const rand = rng(42);
    const planks = 9;
    const ph = s / planks;
    for (let i = 0; i < planks; i++) {
      // base tone per plank — honey oak range
      const t = 0.85 + rand() * 0.25;
      const r = Math.round(186 * t);
      const g = Math.round(146 * t);
      const b = Math.round(102 * t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, i * ph, s, ph - 1.2);
      // long grain strokes
      for (let k = 0; k < 14; k++) {
        const y = i * ph + rand() * ph;
        ctx.strokeStyle = `rgba(${r - 46},${g - 40},${b - 34},${0.12 + rand() * 0.16})`;
        ctx.lineWidth = 0.7 + rand() * 1.1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + rand() * 4 - 2, s * 0.7, y + rand() * 4 - 2, s, y + rand() * 3 - 1.5);
        ctx.stroke();
      }
      // occasional knot
      if (rand() > 0.6) {
        const kx = rand() * s;
        const ky = i * ph + ph * (0.3 + rand() * 0.4);
        ctx.fillStyle = `rgba(${r - 60},${g - 52},${b - 42},0.5)`;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 3 + rand() * 4, 1.6 + rand() * 2, rand(), 0, Math.PI * 2);
        ctx.fill();
      }
      // staggered butt joint
      ctx.fillStyle = "rgba(70,50,32,0.55)";
      ctx.fillRect((i * 197 + 60) % s, i * ph, 2, ph - 1.2);
      // plank shadow line
      ctx.fillStyle = "rgba(70,50,32,0.35)";
      ctx.fillRect(0, (i + 1) * ph - 1.4, s, 1.4);
    }
  });
  tex.repeat.set(1.1, 1.1);
  cache.set("wood", tex);
  return tex;
}

/** Large-format warm porcelain tiles with thin grout. */
export function tileTexture(): THREE.CanvasTexture {
  if (cache.has("tile")) return cache.get("tile")!;
  const tex = makeCanvas(512, (ctx, s) => {
    const rand = rng(7);
    ctx.fillStyle = "#b6b0a6"; // grout
    ctx.fillRect(0, 0, s, s);
    const n = 3;
    const t = s / n;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        const shade = 0.95 + rand() * 0.07;
        ctx.fillStyle = `rgb(${Math.round(224 * shade)},${Math.round(219 * shade)},${Math.round(209 * shade)})`;
        ctx.fillRect(x * t + 1.5, y * t + 1.5, t - 3, t - 3);
        // faint stone mottling
        for (let k = 0; k < 26; k++) {
          ctx.fillStyle = `rgba(150,144,132,${0.04 + rand() * 0.05})`;
          ctx.beginPath();
          ctx.ellipse(x * t + rand() * t, y * t + rand() * t, 2 + rand() * 9, 1 + rand() * 5, rand() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  });
  tex.repeat.set(1.6, 1.6);
  cache.set("tile", tex);
  return tex;
}

/** Soft warm-grey loop carpet. */
export function carpetTexture(): THREE.CanvasTexture {
  if (cache.has("carpet")) return cache.get("carpet")!;
  const tex = makeCanvas(256, (ctx, s) => {
    const rand = rng(99);
    ctx.fillStyle = "#a9a294";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const l = 150 + Math.floor(rand() * 50);
      ctx.fillStyle = `rgba(${l},${l - 4},${l - 14},0.5)`;
      ctx.fillRect(rand() * s, rand() * s, 1.6, 1.6);
    }
  });
  tex.repeat.set(3, 3);
  cache.set("carpet", tex);
  return tex;
}

/** White marble with soft grey veining — worktops & vanities. */
export function marbleTexture(): THREE.CanvasTexture {
  if (cache.has("marble")) return cache.get("marble")!;
  const tex = makeCanvas(256, (ctx, s) => {
    const rand = rng(31);
    ctx.fillStyle = "#f4f2ee";
    ctx.fillRect(0, 0, s, s);
    for (let v = 0; v < 7; v++) {
      ctx.strokeStyle = `rgba(140,142,150,${0.12 + rand() * 0.15})`;
      ctx.lineWidth = 0.8 + rand() * 1.6;
      ctx.beginPath();
      let x = rand() * s;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        x += (rand() - 0.5) * 46;
        y += 12 + rand() * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  tex.repeat.set(1, 1);
  cache.set("marble", tex);
  return tex;
}

export function microcementColor(): string {
  return "#b9b6b0";
}

/** Map a flooring optionId to floor material props. */
export function floorMaterial(optionId: string | undefined, textured: boolean): {
  color: string;
  map?: THREE.CanvasTexture;
  roughness: number;
} {
  switch (optionId) {
    case "wood":
      return textured ? { color: "#ffffff", map: woodTexture(), roughness: 0.5 } : { color: "#c8a878", roughness: 0.6 };
    case "tiles":
      return textured ? { color: "#ffffff", map: tileTexture(), roughness: 0.32 } : { color: "#dedbd4", roughness: 0.35 };
    case "carpet":
      return textured ? { color: "#ffffff", map: carpetTexture(), roughness: 0.98 } : { color: "#a9a294", roughness: 0.95 };
    case "micro":
      return { color: microcementColor(), roughness: 0.38 };
    default:
      return { color: "", roughness: 0.7 }; // caller substitutes theme fallback
  }
}
