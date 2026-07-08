import type { Room } from "../types";
import { roomKind } from "../data/furnitureLayout";
import { marbleTexture } from "./textures";

/**
 * Furniture placeholders built from primitives. Every piece is a component
 * anchored at its own origin; `FurniturePiece` maps a FurnitureItem.kind to
 * the right piece, and DraggableFurniture positions it from the stored
 * room-local anchor — so every piece can be dragged freely (at no cost).
 * The look aims at premium property-marketing renders: walnut/oak timber,
 * cream textiles with olive accents, slatted wardrobe fronts, marble tops,
 * wall-hung TVs and warm pendant lights.
 */

const M = {
  walnut: "#6a4c34",
  walnutDark: "#523a27",
  oak: "#a97f52",
  fabric: "#ddd5c6",
  fabricDark: "#b8ad9a",
  olive: "#6d7a54",
  white: "#f7f4ee",
  offWhite: "#efe9de",
  charcoal: "#2b2926",
  screen: "#101113",
  metal: "#8d9196",
  brass: "#b08d57",
  ceramic: "#fbfaf7",
  glass: "#cfe0e6",
  leafA: "#5c7a4e",
  leafB: "#40593a",
  terracotta: "#9c6248",
  rug: "#e2dccd",
  rugAccent: "#b9ac93",
};

function Box({ p, s, c, ry = 0, rough = 0.85, metal = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; ry?: number; rough?: number; metal?: number }) {
  return (
    <mesh position={p} rotation-y={ry} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}

function Cyl({ p, r, h, c, rough = 0.8, r2 }: { p: [number, number, number]; r: number; h: number; c: string; rough?: number; r2?: number }) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, 20]} />
      <meshStandardMaterial color={c} roughness={rough} />
    </mesh>
  );
}

function MarbleTop({ p, s }: { p: [number, number, number]; s: [number, number, number] }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial map={marbleTexture()} color="#ffffff" roughness={0.18} />
    </mesh>
  );
}

function Rug({ p, w, d, ry = 0 }: { p: [number, number, number]; w: number; d: number; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={M.rug} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003}>
        <planeGeometry args={[w * 0.86, d * 0.82]} />
        <meshStandardMaterial color={M.rugAccent} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006}>
        <planeGeometry args={[w * 0.62, d * 0.55]} />
        <meshStandardMaterial color={M.rug} roughness={1} />
      </mesh>
    </group>
  );
}

function Plant({ p, big = false }: { p: [number, number, number]; big?: boolean }) {
  const k = big ? 1.4 : 1;
  return (
    <group position={p} scale={k}>
      <Cyl p={[0, 0.16, 0]} r={0.14} r2={0.11} h={0.32} c={M.terracotta} />
      <Cyl p={[0, 0.36, 0]} r={0.02} h={0.3} c={M.leafB} />
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color={M.leafA} roughness={1} />
      </mesh>
      <mesh position={[0.14, 0.72, 0.06]} castShadow>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color={M.leafB} roughness={1} />
      </mesh>
      <mesh position={[-0.13, 0.68, -0.05]} castShadow>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color={M.leafA} roughness={1} />
      </mesh>
    </group>
  );
}

function Pendant({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, -0.09, 0]} r={0.008} h={0.5} c={M.charcoal} />
      <mesh position={[0, -0.38, 0]} castShadow>
        <coneGeometry args={[0.16, 0.16, 20, 1, true]} />
        <meshStandardMaterial color={M.charcoal} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.44, 0]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffb554" emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}

function Lamp({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.05, 0]} r={0.05} h={0.1} c={M.brass} rough={0.4} />
      <Cyl p={[0, 0.16, 0]} r={0.012} h={0.14} c={M.brass} rough={0.4} />
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.05, 0.075, 0.09, 14, 1, true]} />
        <meshStandardMaterial color="#f3e4c2" emissive="#ffcf8a" emissiveIntensity={0.9} side={2} />
      </mesh>
    </group>
  );
}

/** Vertical-slat feature (wardrobe fronts / headboard panels). */
function Slats({ p, w, h, c = M.walnut, ry = 0 }: { p: [number, number, number]; w: number; h: number; c?: string; ry?: number }) {
  const n = Math.max(4, Math.round(w / 0.09));
  const slats = [];
  for (let i = 0; i < n; i++) {
    slats.push(
      <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / n), h / 2, 0]} castShadow>
        <boxGeometry args={[(w / n) * 0.62, h, 0.05]} />
        <meshStandardMaterial color={c} roughness={0.7} />
      </mesh>,
    );
  }
  return (
    <group position={p} rotation-y={ry}>
      <mesh position={[0, h / 2, -0.03]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshStandardMaterial color={M.charcoal} roughness={0.9} />
      </mesh>
      {slats}
    </group>
  );
}

function TV({ p, ry = 0, wall = false }: { p: [number, number, number]; ry?: number; wall?: boolean }) {
  return (
    <group position={p} rotation-y={ry}>
      {!wall && <Box p={[0, -0.35, 0]} s={[1.5, 0.36, 0.4]} c={M.oak} />}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.25, 0.72, 0.045]} />
        <meshStandardMaterial color={M.screen} roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0.026]}>
        <planeGeometry args={[1.15, 0.62]} />
        <meshStandardMaterial color="#1b2430" roughness={0.15} metalness={0.2} emissive="#26303c" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

// ---------- pieces (all anchored at their own origin) ----------

function BedP({ w, d }: { w: number; d: number }) {
  const bw = Math.min(1.6, Math.max(1.2, w - 1.4));
  const bl = Math.min(2.05, Math.max(1.6, d - 1.2));
  return (
    <group>
      {/* slatted headboard panel */}
      <Slats p={[0, 0, 0.02]} w={bw + 0.5} h={1.05} />
      {/* platform frame */}
      <Box p={[0, 0.14, bl / 2 + 0.1]} s={[bw + 0.12, 0.16, bl + 0.1]} c={M.walnut} />
      {/* mattress */}
      <Box p={[0, 0.3, bl / 2 + 0.1]} s={[bw, 0.18, bl]} c={M.white} rough={0.95} />
      {/* duvet over lower 2/3, slightly draped */}
      <Box p={[0, 0.4, bl * 0.62]} s={[bw + 0.06, 0.1, bl * 0.72]} c={M.fabric} rough={0.98} />
      {/* folded throw at the foot */}
      <Box p={[0, 0.46, bl * 0.88]} s={[bw + 0.06, 0.05, 0.42]} c={M.olive} rough={0.98} />
      {/* pillows */}
      <Box p={[-bw / 4, 0.44, 0.36]} s={[bw / 2.5, 0.11, 0.36]} c={M.white} ry={0.06} rough={0.98} />
      <Box p={[bw / 4, 0.44, 0.36]} s={[bw / 2.5, 0.11, 0.36]} c={M.white} ry={-0.05} rough={0.98} />
      <Box p={[0, 0.5, 0.42]} s={[bw / 2.6, 0.09, 0.24]} c={M.fabricDark} ry={0.02} rough={0.98} />
      {/* nightstands + lamps */}
      {w > bw + 1.0 && (
        <>
          <Box p={[-bw / 2 - 0.32, 0.22, 0.3]} s={[0.42, 0.44, 0.42]} c={M.walnutDark} />
          <Lamp p={[-bw / 2 - 0.32, 0.44, 0.3]} />
          <Box p={[bw / 2 + 0.32, 0.22, 0.3]} s={[0.42, 0.44, 0.42]} c={M.walnutDark} />
          <Lamp p={[bw / 2 + 0.32, 0.44, 0.3]} />
        </>
      )}
    </group>
  );
}

function SofaP({ w }: { w: number }) {
  const sw = Math.min(2.4, Math.max(1.6, w - 1.2));
  return (
    <group>
      {/* base + legs */}
      <Box p={[0, 0.1, 0]} s={[sw, 0.08, 0.9]} c={M.walnutDark} />
      <Box p={[0, 0.26, 0]} s={[sw, 0.24, 0.9]} c={M.fabric} rough={0.98} />
      {/* seat cushions */}
      <Box p={[-sw / 4 + 0.02, 0.42, 0.06]} s={[sw / 2 - 0.1, 0.12, 0.72]} c={M.offWhite} rough={0.98} />
      <Box p={[sw / 4 - 0.02, 0.42, 0.06]} s={[sw / 2 - 0.1, 0.12, 0.72]} c={M.offWhite} rough={0.98} />
      {/* back + cushions */}
      <Box p={[0, 0.52, 0.38]} s={[sw, 0.44, 0.16]} c={M.fabric} rough={0.98} />
      <Box p={[-sw / 4, 0.56, 0.3]} s={[sw / 2 - 0.14, 0.3, 0.12]} c={M.offWhite} ry={0.03} rough={0.98} />
      <Box p={[sw / 4, 0.56, 0.3]} s={[sw / 2 - 0.14, 0.3, 0.12]} c={M.offWhite} ry={-0.03} rough={0.98} />
      {/* accent cushions */}
      <Box p={[-sw / 3, 0.52, 0.22]} s={[0.3, 0.26, 0.1]} c={M.olive} ry={0.2} rough={0.98} />
      <Box p={[sw / 3, 0.52, 0.22]} s={[0.3, 0.26, 0.1]} c={M.terracotta} ry={-0.15} rough={0.98} />
      {/* arms */}
      <Box p={[-sw / 2 + 0.1, 0.4, 0]} s={[0.2, 0.36, 0.9]} c={M.fabric} rough={0.98} />
      <Box p={[sw / 2 - 0.1, 0.4, 0]} s={[0.2, 0.36, 0.9]} c={M.fabric} rough={0.98} />
    </group>
  );
}

function CoffeeTableP() {
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} r={0.36} h={0.035} c={M.walnut} rough={0.4} />
      <Cyl p={[0, 0.15, 0]} r={0.045} h={0.3} c={M.charcoal} />
      <Cyl p={[0, 0.02, 0]} r={0.2} h={0.03} c={M.charcoal} />
      {/* decor */}
      <Cyl p={[0.1, 0.36, 0.06]} r={0.045} h={0.09} c={M.ceramic} />
      <Box p={[-0.11, 0.34, -0.04]} s={[0.16, 0.025, 0.12]} c={M.olive} />
    </group>
  );
}

function DiningSetP({ w }: { w: number }) {
  const tl = Math.min(1.9, Math.max(1.4, w - 1.6));
  const chair = (x: number, z: number, back: 1 | -1) => (
    <group key={`${x}${z}`} position={[x, 0, z]}>
      <Box p={[0, 0.24, 0]} s={[0.4, 0.05, 0.4]} c={M.fabricDark} rough={0.95} />
      <Box p={[0, 0.12, 0]} s={[0.36, 0.2, 0.36]} c={M.walnutDark} />
      <Box p={[0, 0.5, back * 0.17]} s={[0.4, 0.44, 0.05]} c={M.walnutDark} />
    </group>
  );
  const chairs: React.ReactNode[] = [];
  const n = tl > 1.6 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = -tl / 2 + ((i + 0.5) * tl) / n;
    chairs.push(chair(x, -0.55, -1), chair(x, 0.55, 1));
  }
  return (
    <group>
      <Box p={[0, 0.4, 0]} s={[tl, 0.05, 0.95]} c={M.walnut} rough={0.45} />
      <Box p={[-tl / 2 + 0.12, 0.2, 0]} s={[0.07, 0.4, 0.8]} c={M.walnutDark} />
      <Box p={[tl / 2 - 0.12, 0.2, 0]} s={[0.07, 0.4, 0.8]} c={M.walnutDark} />
      {chairs}
      {/* table decor + pendants above */}
      <Cyl p={[0, 0.47, 0]} r={0.09} h={0.1} c={M.ceramic} />
      <Pendant p={[-tl / 5, 2.05, 0]} />
      <Pendant p={[tl / 5, 2.05, 0]} />
    </group>
  );
}

/** Fitted kitchen run (anchored at the room's front-left corner by default). */
function KitchenRunP({ d }: { d: number }) {
  const run = Math.min(Math.max(d - 0.5, 1.8), 4.6);
  return (
    <group>
      {/* base run along the west wall — walnut fronts, marble top */}
      <Box p={[0.32, 0.42, run / 2 + 0.2]} s={[0.62, 0.84, run]} c={M.walnut} rough={0.55} />
      <MarbleTop p={[0.33, 0.87, run / 2 + 0.2]} s={[0.68, 0.05, run + 0.05]} />
      {/* unit shadow gaps */}
      {Array.from({ length: Math.floor(run / 0.6) }).map((_, i) => (
        <Box key={i} p={[0.62, 0.42, 0.55 + i * 0.6]} s={[0.015, 0.78, 0.02]} c={M.walnutDark} />
      ))}
      {/* sink + hob */}
      <Box p={[0.33, 0.9, run * 0.3]} s={[0.44, 0.02, 0.5]} c="#b9bdc1" rough={0.3} metal={0.6} />
      <Box p={[0.33, 0.905, run * 0.72]} s={[0.5, 0.015, 0.55]} c={M.screen} rough={0.25} />
      {[0, 1].map((i) =>
        [0, 1].map((j) => (
          <Cyl key={`${i}${j}`} p={[0.24 + i * 0.18, 0.92, run * 0.72 - 0.12 + j * 0.24]} r={0.055} h={0.01} c="#3a3e44" />
        )),
      )}
      {/* wall cabinets + tall fridge column */}
      <Box p={[0.26, 1.62, run / 2 + 0.2]} s={[0.4, 0.62, run * 0.72]} c={M.offWhite} rough={0.6} />
      <Box p={[0.4, 1.05, Math.min(run + 0.51, d - 0.42)]} s={[0.65, 2.1, 0.62]} c={M.charcoal} rough={0.5} />
    </group>
  );
}

/** Kitchen island with marble waterfall top + bar stools. */
function IslandP() {
  return (
    <group>
      <Box p={[0, 0.42, 0]} s={[0.85, 0.84, 1.7]} c={M.offWhite} rough={0.5} />
      <MarbleTop p={[0, 0.87, 0]} s={[0.95, 0.06, 1.8]} />
      <MarbleTop p={[0.45, 0.45, 0]} s={[0.05, 0.9, 1.8]} />
      {[-0.5, 0, 0.5].map((z, i) => (
        <group key={i} position={[0.75, 0, z]}>
          <Cyl p={[0, 0.32, 0]} r={0.03} h={0.64} c={M.charcoal} />
          <Cyl p={[0, 0.66, 0]} r={0.17} h={0.05} c={M.walnut} rough={0.5} />
        </group>
      ))}
      <Plant p={[0, 0.9, -0.6]} />
      <Cyl p={[0.05, 0.95, 0.3]} r={0.05} h={0.16} c="#4a5d43" />
    </group>
  );
}

function BathP({ w }: { w: number }) {
  const bw = Math.min(1.7, Math.max(1.2, w - 0.5));
  return (
    <group>
      <Box p={[0, 0.26, 0]} s={[bw, 0.52, 0.78]} c={M.ceramic} rough={0.35} />
      <Box p={[0, 0.42, 0]} s={[bw - 0.2, 0.24, 0.58]} c="#e3edf0" rough={0.2} />
      <Cyl p={[bw / 2 - 0.18, 0.62, 0]} r={0.02} h={0.24} c={M.metal} rough={0.25} />
    </group>
  );
}

/** Vanity: walnut unit, marble top, basin, round mirror. */
function VanityP() {
  return (
    <group>
      <Box p={[0, 0.36, 0]} s={[0.75, 0.6, 0.5]} c={M.walnut} rough={0.5} />
      <MarbleTop p={[0, 0.69, 0]} s={[0.8, 0.05, 0.55]} />
      <Cyl p={[0, 0.76, 0]} r={0.16} h={0.1} c={M.ceramic} rough={0.25} />
      <mesh position={[0, 1.35, -0.22]} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[0.26, 0.015, 10, 40]} />
        <meshStandardMaterial color={M.charcoal} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.35, -0.215]}>
        <circleGeometry args={[0.25, 32]} />
        <meshStandardMaterial color="#c9d6da" roughness={0.05} metalness={0.6} />
      </mesh>
    </group>
  );
}

function WCP() {
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.38, 0.4, 0.46]} c={M.ceramic} rough={0.3} />
      <Box p={[0, 0.52, -0.16]} s={[0.38, 0.36, 0.14]} c={M.ceramic} rough={0.3} />
      <Box p={[0, 0.41, 0.03]} s={[0.34, 0.04, 0.4]} c={M.white} rough={0.3} />
    </group>
  );
}

/** Corner shower: tray + two glass screens. */
function ShowerP() {
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[1.0, 0.06, 1.0]} c="#d7d3ca" rough={0.4} />
      <mesh position={[-0.5, 0.95, 0]}>
        <boxGeometry args={[0.02, 1.8, 1.0]} />
        <meshPhysicalMaterial color={M.glass} transparent opacity={0.22} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.95, -0.5]}>
        <boxGeometry args={[1.0, 1.8, 0.02]} />
        <meshPhysicalMaterial color={M.glass} transparent opacity={0.22} roughness={0.05} />
      </mesh>
      <Cyl p={[0.3, 1.6, 0.3]} r={0.012} h={0.5} c={M.metal} rough={0.25} />
    </group>
  );
}

function WardrobeP({ d }: { d: number }) {
  const len = Math.min(2.2, Math.max(1.2, d - 1.0));
  return (
    <group>
      <Box p={[0, 0.95, 0]} s={[0.6, 1.9, len]} c={M.charcoal} rough={0.7} />
      <Slats p={[-0.31, 0, 0]} w={len} h={1.9} ry={-Math.PI / 2} />
    </group>
  );
}

/** Wall-hung TV + media unit. */
function TVP({ w }: { w: number }) {
  return (
    <group>
      <TV p={[0, 0.95, -0.08]} wall />
      <Box p={[0, 0.24, 0.05]} s={[Math.min(1.8, Math.max(1.2, w - 1)), 0.36, 0.42]} c={M.oak} />
    </group>
  );
}

/** Slim hall console table with a plant. */
function ConsoleP() {
  return (
    <group>
      <Box p={[0, 0.4, 0]} s={[0.28, 0.06, 0.8]} c={M.walnut} />
      <Box p={[0, 0.2, -0.3]} s={[0.05, 0.4, 0.05]} c={M.charcoal} />
      <Box p={[0, 0.2, 0.3]} s={[0.05, 0.4, 0.05]} c={M.charcoal} />
      <Plant p={[0, 0.43, 0.15]} />
    </group>
  );
}

/** Rug sized to suit the room it lives in. */
function RugP({ room }: { room: Room }) {
  const { width: w, depth: d } = room.geometry;
  const kind = roomKind(room.name);
  const [rw, rd] =
    kind === "bedroom" ? [Math.min(2.2, Math.max(1.2, w * 0.6)), 1.1] :
    kind === "living" ? [Math.min(2.8, Math.max(1.4, w - 0.7)), Math.min(2.0, Math.max(1.2, d - 1.3))] :
    kind === "dining" ? [Math.min(2.6, Math.max(1.4, w - 0.5)), Math.min(1.8, Math.max(1.2, d - 0.5))] :
    [1.8, 1.2];
  return <Rug p={[0, 0.005, 0]} w={rw} d={rd} />;
}

function RugRunnerP({ room }: { room: Room }) {
  const { width: w, depth: d } = room.geometry;
  return <Rug p={[0, 0.005, 0]} w={Math.max(0.6, w - 0.6)} d={Math.min(2.4, d * 0.7)} />;
}

/**
 * Registry: FurnitureItem.kind → piece. Each piece renders around its own
 * origin; DraggableFurniture supplies the position from the stored item.
 */
export function FurniturePiece({ kind, room }: { kind: string; room: Room }) {
  const { width: w, depth: d } = room.geometry;
  if (w < 1 || d < 1) return null;
  switch (kind) {
    case "bed":
      return <BedP w={w} d={d} />;
    case "wardrobe":
      return <WardrobeP d={d} />;
    case "sofa":
      return <SofaP w={w} />;
    case "coffeeTable":
      return <CoffeeTableP />;
    case "tv":
      return <TVP w={w} />;
    case "diningSet":
      return <DiningSetP w={w} />;
    case "kitchenRun":
      return <KitchenRunP d={d} />;
    case "island":
      return <IslandP />;
    case "bath":
      return <BathP w={w} />;
    case "vanity":
      return <VanityP />;
    case "wc":
      return <WCP />;
    case "shower":
      return <ShowerP />;
    case "console":
      return <ConsoleP />;
    case "rug":
      return <RugP room={room} />;
    case "rugRunner":
      return <RugRunnerP room={room} />;
    case "plantBig":
      return <Plant p={[0, 0, 0]} big />;
    case "plant":
    default:
      return <Plant p={[0, 0, 0]} />;
  }
}
