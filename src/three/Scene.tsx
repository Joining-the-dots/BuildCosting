import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, ContactShadows, SoftShadows } from "@react-three/drei";
import { useStore } from "../store";
import { THEMES } from "./themes";
import Room3D from "./Room3D";
import { roomSubtotal } from "../lib/pricingEngine";
import { structuralView } from "../lib/structural";
import type { Room } from "../types";

const FLOOR_GAP = 1.6; // exploded-dollhouse vertical gap between storeys

function floorY(floor: Room["floor"], groundHeight: number, filter: string): number {
  if (floor === "ground") return 0;
  return filter === "all" ? groundHeight + FLOOR_GAP : 0;
}

/** Bounding box of a set of rooms (plan coords). */
function bounds(rooms: Room[]) {
  if (!rooms.length) return { cx: 4, cz: 5, size: 10 };
  const minX = Math.min(...rooms.map((r) => r.geometry.x));
  const minZ = Math.min(...rooms.map((r) => r.geometry.z));
  const maxX = Math.max(...rooms.map((r) => r.geometry.x + r.geometry.width));
  const maxZ = Math.max(...rooms.map((r) => r.geometry.z + r.geometry.depth));
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ) };
}

function CameraRig() {
  const controls = useRef<CameraControls>(null);
  const rooms = useStore((s) => s.rooms);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const cameraMode = useStore((s) => s.cameraMode);
  const floorFilter = useStore((s) => s.floorFilter);
  // freeze orbit/pan while a furniture piece is being dragged
  const dragging = useStore((s) => s.draggingFurniture);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const groundH = rooms.find((r) => r.floor === "ground")?.geometry.height ?? 2.4;
    const selected = rooms.find((r) => r.id === selectedRoomId);

    if (selected) {
      const y = floorY(selected.floor, groundH, floorFilter);
      const cx = selected.geometry.x + selected.geometry.width / 2;
      const cz = selected.geometry.z + selected.geometry.depth / 2;
      const r = Math.max(selected.geometry.width, selected.geometry.depth);
      if (cameraMode === "top") {
        c.setLookAt(cx, y + r * 2.2 + 6, cz + 0.01, cx, y, cz, true);
      } else {
        c.setLookAt(cx + r * 1.4 + 2, y + r * 1.2 + 3, cz + r * 1.4 + 2, cx, y + 0.4, cz, true);
      }
      return;
    }

    const visible = floorFilter === "all" ? rooms : rooms.filter((r) => r.floor === floorFilter);
    const { cx, cz, size } = bounds(visible.length ? visible : rooms);
    const midY = floorFilter === "all" ? (groundH + FLOOR_GAP) / 2 : 0;
    if (cameraMode === "top") {
      c.setLookAt(cx, size * 1.9 + 8, cz + 0.01, cx, midY, cz, true);
    } else {
      c.setLookAt(cx + size * 1.05 + 3, size * 0.95 + 5, cz + size * 1.05 + 3, cx, midY, cz, true);
    }
  }, [rooms, selectedRoomId, cameraMode, floorFilter]);

  return <CameraControls ref={controls} makeDefault smoothTime={0.35} enabled={!dragging} />;
}

export default function Scene() {
  const rooms = useStore((s) => s.rooms);
  const themeId = useStore((s) => s.theme);
  const floorFilter = useStore((s) => s.floorFilter);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const hoveredRoomId = useStore((s) => s.hoveredRoomId);
  const selectRoom = useStore((s) => s.selectRoom);
  const hoverRoom = useStore((s) => s.hoverRoom);
  const rates = useStore((s) => s.rates);
  const modelMode = useStore((s) => s.modelMode);
  const structTarget = useStore((s) => s.structTarget);
  const setStructTarget = useStore((s) => s.setStructTarget);
  const structuralWorks = useStore((s) => s.structuralWorks);

  const theme = THEMES[themeId];
  const structuralMode = modelMode === "structural";
  const groundH = rooms.find((r) => r.floor === "ground")?.geometry.height ?? 2.4;

  const visibleRooms = useMemo(
    () => (floorFilter === "all" ? rooms : rooms.filter((r) => r.floor === floorFilter)),
    [rooms, floorFilter],
  );
  const { cx, cz, size } = bounds(visibleRooms.length ? visibleRooms : rooms);

  return (
    <Canvas
      shadows
      camera={{ position: [14, 12, 14], fov: 35 }}
      // touchAction none stops the browser hijacking touch drags for scrolling
      style={{ background: theme.canvasBg, touchAction: "none" }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={() => (structuralMode ? setStructTarget(null) : selectRoom(null))}
    >
      <SoftShadows size={16} samples={14} />
      {/* warm three-point-ish daylight */}
      <hemisphereLight args={["#fff6e8", "#c4b6a0", theme.ambient * 0.75]} />
      <ambientLight intensity={theme.ambient * 0.35} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={theme.directional}
        color="#fff2df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      >
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 0.5, 50]} />
      </directionalLight>
      <directionalLight position={[-9, 11, -7]} intensity={theme.directional * 0.3} color="#dfe8f2" />

      {/* ground slab under the model */}
      <mesh position={[cx, -0.38, cz]} receiveShadow>
        <boxGeometry args={[size + 4.5, 0.3, size + 4.5]} />
        <meshStandardMaterial color={theme.baseColor} roughness={1} />
      </mesh>
      <ContactShadows position={[cx, -0.22, cz]} opacity={theme.edgeGlow ? 0.5 : 0.4} scale={size + 9} blur={2.4} far={7} />

      <Suspense fallback={null}>
        {visibleRooms.map((room) => {
          const ghosted = !structuralMode && selectedRoomId != null && selectedRoomId !== room.id;
          const isStructRoomTarget = structuralMode && structTarget?.roomId === room.id && !structTarget.edge;
          const structEdge =
            structuralMode && structTarget?.roomId === room.id && structTarget.edge ? structTarget.edge : null;
          return (
            <Room3D
              key={room.id}
              room={room}
              theme={theme}
              yOffset={floorY(room.floor, groundH, floorFilter)}
              selected={!structuralMode && room.id === selectedRoomId}
              hovered={!structuralMode && room.id === hoveredRoomId}
              ghosted={ghosted}
              subtotal={roomSubtotal(room, rates)}
              structural={structuralView(room, rooms, structuralWorks)}
              structuralMode={structuralMode}
              structTargetEdge={structEdge}
              structTargetRoom={isStructRoomTarget}
              onClick={() =>
                structuralMode
                  ? setStructTarget({ roomId: room.id })
                  : selectRoom(room.id === selectedRoomId ? null : room.id)
              }
              onHover={(over) => hoverRoom(over ? room.id : null)}
              onWallClick={(edge) => setStructTarget({ roomId: room.id, edge })}
            />
          );
        })}
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
