import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStore } from "../store";
import type { FurnitureItem, Room } from "../types";

const MARGIN = 0.35; // keep anchors this far inside the room

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Makes a furniture piece draggable on its floor plane. Dragging is free —
 * it only updates the item's stored position, never the price. A click
 * without movement falls through to selecting the room, and while a drag is
 * active the camera controls are suspended (see CameraRig).
 */
export default function DraggableFurniture({
  item,
  room,
  yOffset,
  interactive,
  onRoomClick,
  children,
}: {
  item: FurnitureItem;
  room: Room;
  yOffset: number;
  interactive: boolean;
  onRoomClick: () => void;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const moveFurnitureItem = useStore((s) => s.moveFurnitureItem);
  const setDraggingFurniture = useStore((s) => s.setDraggingFurniture);
  const [drag, setDrag] = useState(false);
  const moved = useRef(false);
  const grab = useRef({ dx: 0, dz: 0 });
  const pos = useRef({ x: item.x, z: item.z });
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const { width: w, depth: d, x: rx, z: rz } = room.geometry;
  // clamp stored positions too — room may have been resized since placement
  const cx = clamp(item.x, MARGIN, w - MARGIN);
  const cz = clamp(item.z, MARGIN, d - MARGIN);

  useEffect(() => {
    pos.current = { x: cx, z: cz };
    groupRef.current?.position.set(cx, 0, cz);
  }, [cx, cz]);

  const intersect = (e: ThreeEvent<PointerEvent>) => {
    plane.constant = -yOffset; // floor plane of this storey, world space
    return e.ray.intersectPlane(plane, hit);
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (!intersect(e)) return;
    grab.current = { dx: pos.current.x - (hit.x - rx), dz: pos.current.z - (hit.z - rz) };
    moved.current = false;
    setDrag(true);
    setDraggingFurniture(true);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    if (!intersect(e)) return;
    const nx = clamp(hit.x - rx + grab.current.dx, MARGIN, w - MARGIN);
    const nz = clamp(hit.z - rz + grab.current.dz, MARGIN, d - MARGIN);
    if (Math.abs(nx - pos.current.x) + Math.abs(nz - pos.current.z) > 0.015) moved.current = true;
    pos.current = { x: nx, z: nz };
    groupRef.current?.position.set(nx, 0.04, nz); // slight lift while dragging
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDrag(false);
    setDraggingFurniture(false);
    groupRef.current?.position.set(pos.current.x, 0, pos.current.z);
    if (moved.current) {
      moveFurnitureItem(room.id, item.id, Math.round(pos.current.x * 100) / 100, Math.round(pos.current.z * 100) / 100);
    } else {
      onRoomClick();
    }
  };

  return (
    <group
      ref={groupRef}
      position={[cx, 0, cz]}
      onPointerDown={interactive ? onDown : undefined}
      onPointerMove={interactive ? onMove : undefined}
      onPointerUp={interactive ? onUp : undefined}
      onClick={
        interactive
          ? (e) => e.stopPropagation() // click handled on pointer-up
          : (e) => {
              e.stopPropagation();
              onRoomClick(); // structural mode: clicking furniture targets the room
            }
      }
      onPointerOver={
        interactive
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = drag ? "grabbing" : "grab";
            }
          : undefined
      }
      onPointerOut={interactive ? () => (document.body.style.cursor = "default") : undefined}
    >
      {children}
      {drag && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.42, 0.55, 28]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}
