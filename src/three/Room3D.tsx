import { useMemo, useState } from "react";
import { Edges, Html } from "@react-three/drei";
import type { Edge, Room } from "../types";
import type { ModelTheme } from "./themes";
import type { RoomStructuralView } from "../lib/structural";
import { solidSegments } from "../lib/structural";
import { GARDEN_DOOR_SPECS, DOOR_HEIGHT_M } from "../data/pricing";
import { floorMaterial } from "./textures";
import { FurniturePiece } from "./Furniture";
import DraggableFurniture from "./DraggableFurniture";
import { useStore } from "../store";

const WALL_T = 0.14; // wall thickness
const CUT = 1.35; // dollhouse cutaway wall height
const SLAB = 0.14; // floor slab thickness
const CAP_H = 0.055; // contrasting cap on top of cut walls

interface Props {
  room: Room;
  theme: ModelTheme;
  yOffset: number;
  selected: boolean;
  hovered: boolean;
  ghosted: boolean;
  subtotal: number;
  structural: RoomStructuralView;
  structuralMode: boolean;
  structTargetEdge: Edge | null; // highlighted wall (action card open)
  structTargetRoom: boolean; // whole room targeted
  onClick: () => void;
  onHover: (over: boolean) => void;
  onWallClick: (edge: Edge) => void;
}

interface Seg {
  edge: Edge;
  p: [number, number, number];
  s: [number, number, number];
}

/** Box position/size for a span [start,len] along an edge. */
function segBox(edge: Edge, start: number, len: number, w: number, d: number, h: number, y0: number): Seg {
  const y = y0 + h / 2;
  switch (edge) {
    case "N":
      return { edge, p: [start + len / 2, y, d - WALL_T / 2], s: [len, h, WALL_T] };
    case "S":
      return { edge, p: [start + len / 2, y, WALL_T / 2], s: [len, h, WALL_T] };
    case "W":
      return { edge, p: [WALL_T / 2, y, start + len / 2], s: [WALL_T, h, len] };
    case "E":
      return { edge, p: [w - WALL_T / 2, y, start + len / 2], s: [WALL_T, h, len] };
  }
}

/** Glazed garden doors (Crittall grid / alu sliders / uPVC French). */
function GardenDoors({
  edge,
  start,
  length,
  specId,
  w,
  d,
  opacity,
}: {
  edge: Edge;
  start: number;
  length: number;
  specId: string;
  w: number;
  d: number;
  opacity: number;
}) {
  const spec = GARDEN_DOOR_SPECS.find((s) => s.id === specId) ?? GARDEN_DOOR_SPECS[0];
  const h = Math.min(DOOR_HEIGHT_M, CUT + 0.7); // rises above the cutaway — reads as full-height glazing
  const along = edge === "N" || edge === "S" ? "x" : "z";
  const centre = start + length / 2;

  const group = (children: React.ReactNode) => {
    // position the door assembly on the correct edge
    const pos: [number, number, number] =
      edge === "N" ? [centre, 0, d - WALL_T / 2] :
      edge === "S" ? [centre, 0, WALL_T / 2] :
      edge === "W" ? [WALL_T / 2, 0, centre] : [w - WALL_T / 2, 0, centre];
    const rotY = along === "x" ? 0 : Math.PI / 2;
    return (
      <group position={pos} rotation-y={rotY}>
        {children}
      </group>
    );
  };

  const FR = 0.06; // frame member thickness
  const leaves = spec.id === "upvc" ? 2 : spec.id === "alu" ? 3 : 4;
  const bars: React.ReactNode[] = [];
  // vertical dividers between leaves
  for (let i = 1; i < leaves; i++) {
    bars.push(
      <mesh key={`v${i}`} position={[-length / 2 + (length / leaves) * i, h / 2, 0]}>
        <boxGeometry args={[spec.glazingBars ? 0.045 : 0.07, h, 0.07]} />
        <meshStandardMaterial color={spec.frameColor} roughness={0.5} metalness={0.4} transparent={opacity < 1} opacity={opacity} />
      </mesh>,
    );
  }
  // Crittall horizontal glazing bars
  if (spec.glazingBars) {
    for (let j = 1; j <= 3; j++) {
      bars.push(
        <mesh key={`h${j}`} position={[0, (h / 4) * j, 0]}>
          <boxGeometry args={[length - FR, 0.035, 0.06]} />
          <meshStandardMaterial color={spec.frameColor} roughness={0.5} metalness={0.4} transparent={opacity < 1} opacity={opacity} />
        </mesh>,
      );
    }
  }

  return group(
    <>
      {/* glass */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[length - FR, h - FR, 0.035]} />
        <meshPhysicalMaterial
          color="#cfe4ec"
          roughness={0.08}
          metalness={0}
          transparent
          opacity={Math.min(opacity, 0.34)}
        />
      </mesh>
      {/* outer frame: top, bottom sill, jambs */}
      {[
        { p: [0, h - FR / 2, 0] as [number, number, number], s: [length, FR, 0.09] as [number, number, number] },
        { p: [0, FR / 2, 0] as [number, number, number], s: [length, FR, 0.11] as [number, number, number] },
        { p: [-length / 2 + FR / 2, h / 2, 0] as [number, number, number], s: [FR, h, 0.09] as [number, number, number] },
        { p: [length / 2 - FR / 2, h / 2, 0] as [number, number, number], s: [FR, h, 0.09] as [number, number, number] },
      ].map((f, i) => (
        <mesh key={i} position={f.p}>
          <boxGeometry args={f.s} />
          <meshStandardMaterial color={spec.frameColor} roughness={0.5} metalness={0.35} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      ))}
      {bars}
    </>,
  );
}

/** Amber ghost wall shown while the user positions an "add wall" action. */
function WallDraftPreview({ roomId, w, d, h }: { roomId: string; w: number; d: number; h: number }) {
  const draft = useStore((s) => s.wallDraft);
  if (!draft || draft.roomId !== roomId) return null;
  const isX = draft.dir === "x"; // wall at x=pos, running front–back
  const pos = Math.min(Math.max(draft.pos, 0.3), (isX ? w : d) - 0.3);
  return (
    <mesh position={isX ? [pos, h / 2, d / 2] : [w / 2, h / 2, pos]}>
      <boxGeometry args={isX ? [0.1, h + 0.15, d - 0.1] : [w - 0.1, h + 0.15, 0.1]} />
      <meshStandardMaterial color="#34d399" transparent opacity={0.45} emissive="#34d399" emissiveIntensity={0.25} />
    </mesh>
  );
}

/** Diagonal-hatch overlay marking a demolished room. */
function DemolitionHatch({ w, d }: { w: number; d: number }) {
  const lines = useMemo(() => {
    const out: Array<{ p: [number, number, number]; len: number }> = [];
    const diag = Math.hypot(w, d);
    for (let t = -diag; t < diag; t += 0.55) {
      out.push({ p: [w / 2 + t / 2, 0.02, d / 2 + t / 2], len: diag });
    }
    return out;
  }, [w, d]);
  return (
    <group>
      <mesh position={[w / 2, 0.012, d / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w - 0.1, d - 0.1]} />
        <meshBasicMaterial color="#3f3a34" transparent opacity={0.18} />
      </mesh>
      {lines.map((l, i) => (
        <mesh key={i} position={l.p} rotation-x={-Math.PI / 2} rotation-z={Math.PI / 4}>
          <planeGeometry args={[0.03, l.len]} />
          <meshBasicMaterial color="#8a4b3a" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export default function Room3D({
  room,
  theme,
  yOffset,
  selected,
  hovered,
  ghosted,
  subtotal,
  structural,
  structuralMode,
  structTargetEdge,
  structTargetRoom,
  onClick,
  onHover,
  onWallClick,
}: Props) {
  const { x, z, width: w, depth: d } = room.geometry;
  const demolished = structural.demolished;
  const opacity = ghosted ? 0.08 : demolished ? 0.45 : 1;
  const [hoverEdge, setHoverEdge] = useState<Edge | null>(null);

  const flooringSel = room.selections.find((s) => s.groupId === "flooring")?.optionId;
  const floorMat = floorMaterial(flooringSel, theme.showTextures);
  const floorColor = floorMat.color || theme.floorFallback;

  const h = Math.min(CUT, room.geometry.height);
  const doorW = 0.94;

  // Build wall segments per edge, subtracting the interior door gap and any
  // structural openings (removed walls / garden doors).
  const segments = useMemo(() => {
    const segs: Seg[] = [];
    (["N", "S", "E", "W"] as Edge[]).forEach((edge) => {
      const L = edge === "N" || edge === "S" ? w : d;
      const cuts = [...(structural.openings[edge] ?? [])];
      // legacy interior door gap on the front wall
      if (edge === "S" && room.doors > 0 && w > doorW + 0.8 && !structural.doors.S) {
        cuts.push({ start: (w - doorW) / 2, length: doorW });
      }
      // inset E/W walls so corners don't z-fight with N/S walls
      const inset = edge === "E" || edge === "W" ? WALL_T : 0;
      for (const span of solidSegments(L, cuts)) {
        const s0 = Math.max(span.start, inset);
        const s1 = Math.min(span.start + span.length, L - inset);
        if (s1 - s0 > 0.05) segs.push(segBox(edge, s0, s1 - s0, w, d, h, 0));
      }
    });
    return segs;
  }, [w, d, h, room.doors, structural]);

  const wallBase = theme.edgeGlow ? theme.wallColor : selected ? "#f3e3c4" : hovered ? "#f0ebdf" : theme.wallColor;

  const wallInteract = structuralMode && !ghosted;

  return (
    <group position={[x, yOffset, z]}>
      {/* floor slab — material follows the selected flooring */}
      <mesh
        position={[w / 2, -SLAB / 2, d / 2]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
      >
        <boxGeometry args={[w, SLAB, d]} />
        <meshStandardMaterial
          color={theme.edgeGlow ? theme.floorFallback : demolished ? "#9d968b" : floorColor}
          map={theme.edgeGlow || demolished ? undefined : floorMat.map}
          roughness={floorMat.roughness}
          transparent={opacity < 1}
          opacity={ghosted ? opacity : 1}
        />
        {theme.edgeGlow && <Edges color={selected ? "#7dd3fc" : theme.edgeColor} lineWidth={selected ? 2.5 : 1} />}
      </mesh>

      {/* selection / hover / structural-target halo */}
      {(selected || hovered || structTargetRoom) && !ghosted && (
        <mesh position={[w / 2, 0.015, d / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[w - 0.15, d - 0.15]} />
          <meshBasicMaterial
            color={structTargetRoom ? "#f43f5e" : selected ? "#f59e0b" : "#fbbf24"}
            transparent
            opacity={structTargetRoom ? 0.18 : selected ? 0.22 : 0.12}
          />
        </mesh>
      )}

      {demolished && !ghosted && <DemolitionHatch w={w} d={d} />}

      {/* walls */}
      {segments.map((seg, i) => {
        const isTarget = structTargetEdge === seg.edge;
        const isHover = wallInteract && hoverEdge === seg.edge;
        const color = theme.edgeGlow ? theme.wallColor : isTarget ? "#e8b04b" : isHover ? "#ecc987" : wallBase;
        return (
          <group key={i}>
            <mesh
              position={seg.p}
              castShadow
              receiveShadow
              onClick={
                wallInteract
                  ? (e) => {
                      e.stopPropagation();
                      onWallClick(seg.edge);
                    }
                  : undefined
              }
              onPointerOver={
                wallInteract
                  ? (e) => {
                      e.stopPropagation();
                      setHoverEdge(seg.edge);
                      document.body.style.cursor = "pointer";
                    }
                  : undefined
              }
              onPointerOut={
                wallInteract
                  ? () => {
                      setHoverEdge(null);
                      document.body.style.cursor = "default";
                    }
                  : undefined
              }
            >
              <boxGeometry args={seg.s} />
              <meshStandardMaterial
                color={color}
                roughness={0.92}
                transparent={opacity < 1}
                opacity={demolished ? 0.4 : opacity}
              />
              {theme.edgeGlow && (
                <Edges
                  color={isTarget ? "#fbbf24" : selected ? "#7dd3fc" : isHover ? "#67e8f9" : theme.edgeColor}
                  lineWidth={selected || isTarget ? 2 : 1}
                />
              )}
            </mesh>
            {/* contrasting cap strip on top of the cutaway wall */}
            {!theme.edgeGlow && !demolished && (
              <mesh position={[seg.p[0], h + CAP_H / 2, seg.p[2]]} castShadow>
                <boxGeometry args={[seg.s[0] + (seg.edge === "N" || seg.edge === "S" ? 0.02 : 0.03), CAP_H, seg.s[2] + (seg.edge === "E" || seg.edge === "W" ? 0.02 : 0.03)]} />
                <meshStandardMaterial
                  color={isTarget ? "#d19a33" : isHover ? "#c8a86a" : theme.wallTopColor}
                  roughness={0.75}
                  transparent={opacity < 1}
                  opacity={opacity}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* garden doors */}
      {!ghosted &&
        (Object.entries(structural.doors) as Array<[Edge, { start: number; length: number; specId: string }]>).map(
          ([edge, placement]) => (
            <GardenDoors
              key={edge}
              edge={edge}
              start={placement.start}
              length={placement.length}
              specId={placement.specId}
              w={w}
              d={d}
              opacity={opacity}
            />
          ),
        )}

      {/* window hints on the rear wall (suppressed if doors were fitted there) */}
      {room.windows > 0 && !structural.doors.N && !demolished && !theme.edgeGlow &&
        Array.from({ length: Math.min(room.windows, 3) }).map((_, i) => (
          <group key={`win${i}`} position={[((i + 1) * w) / (Math.min(room.windows, 3) + 1), 0, d - WALL_T / 2]}>
            <mesh position={[0, h * 0.62, 0]}>
              <boxGeometry args={[Math.min(1.0, w / 3), h * 0.52, WALL_T + 0.02]} />
              <meshPhysicalMaterial color="#bcd8e4" roughness={0.1} transparent opacity={Math.min(opacity, 0.55)} />
            </mesh>
            <mesh position={[0, h * 0.62, 0]}>
              <boxGeometry args={[Math.min(1.0, w / 3) + 0.06, h * 0.52 + 0.06, WALL_T - 0.02]} />
              <meshStandardMaterial color="#6d675d" roughness={0.6} transparent={opacity < 1} opacity={opacity} />
            </mesh>
          </group>
        ))}

      {/* furniture: draggable placeholders (dollhouse theme, not demolished) */}
      {theme.showFurniture && !ghosted && !demolished &&
        (room.furniture ?? []).map((item) => (
          <DraggableFurniture
            key={item.id}
            item={item}
            room={room}
            yOffset={yOffset}
            interactive={!structuralMode}
            onRoomClick={onClick}
          >
            <FurniturePiece kind={item.kind} room={room} />
          </DraggableFurniture>
        ))}

      {/* translucent preview of a wall being placed ("add wall") */}
      {structuralMode && <WallDraftPreview roomId={room.id} w={w} d={d} h={h} />}

      {/* floating label pill */}
      {!ghosted && (
        <Html
          position={[w / 2, h + 0.7, d / 2]}
          center
          distanceFactor={11}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap tracking-wide ${theme.labelClass} ${
              selected ? "ring-2 ring-amber-400" : structTargetRoom ? "ring-2 ring-rose-400" : ""
            }`}
          >
            {demolished && <span className="text-rose-500 mr-1">⌫</span>}
            {room.name}
            {(selected || hovered) && <span className="ml-1.5 opacity-60">£{subtotal.toLocaleString("en-GB")}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
