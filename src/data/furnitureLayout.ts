import type { FurnitureItem, RoomGeometry } from "../types";
import { nextId } from "../lib/extraction";

/**
 * Default furniture layout per room type. Runs once when a room enters the
 * live project (or when an older save without furniture is rehydrated);
 * afterwards the user can drag every piece freely — positions live on the
 * Room record and moving them costs nothing.
 */

export function roomKind(name: string): string {
  const n = name.toLowerCase();
  if (/kitchen/.test(n)) return "kitchen";
  if (/bath|shower|ensuite|wc|cloak/.test(n)) return "bathroom";
  if (/bedroom/.test(n)) return "bedroom";
  if (/sitting|living|lounge|reception/.test(n)) return "living";
  if (/dining/.test(n)) return "dining";
  if (/hall|landing|entrance/.test(n)) return "hall";
  return "generic";
}

export function defaultFurniture(room: { name: string; geometry: RoomGeometry }): FurnitureItem[] {
  const { width: w, depth: d } = room.geometry;
  const mk = (kind: string, x: number, z: number): FurnitureItem => ({ id: nextId("f"), kind, x, z });
  const items: FurnitureItem[] = [];

  // A merged open-plan name like "Kitchen + Dining Area" gets BOTH sets.
  const kinds = room.name.split("+").map((part) => roomKind(part));
  const kindSet = kinds.includes("generic") && kinds.length === 1 ? [roomKind(room.name)] : [...new Set(kinds)];

  for (const kind of kindSet) {
    switch (kind) {
      case "kitchen":
        items.push(mk("kitchenRun", 0, 0));
        if (w > 2.7) items.push(mk("island", Math.min(w - 1.0, w / 2 + 0.5), Math.min(d / 2, 3.2)));
        break;
      case "bathroom":
        items.push(mk("bath", w / 2, d - 0.48), mk("vanity", 0.42, 0.55), mk("wc", w - 0.42, 0.5));
        if (w > 1.9 && d > 2.0) items.push(mk("shower", w - 0.55, d - 0.55));
        break;
      case "bedroom":
        items.push(mk("bed", w / 2, 0.16));
        if (w > 2.6 && d > 2.8) items.push(mk("wardrobe", w - 0.34, d / 2));
        items.push(mk("rug", w / 2, Math.min(d - 0.8, d * 0.72)));
        if (w > 2) items.push(mk("plant", 0.35, d - 0.4));
        break;
      case "living":
        items.push(
          mk("sofa", w / 2, d - 0.6),
          mk("coffeeTable", w / 2, d / 2 + 0.15),
          mk("tv", w / 2, 0.3),
          mk("rug", w / 2, d / 2 + 0.25),
          mk("plantBig", 0.4, 0.4),
        );
        break;
      case "dining":
        items.push(mk("diningSet", w / 2, d / 2), mk("rug", w / 2, d / 2), mk("plant", w - 0.4, d - 0.4));
        break;
      case "hall":
        items.push(mk("rugRunner", w / 2, d / 2));
        if (w > 1.1) items.push(mk("console", w - 0.28, d * 0.25));
        break;
      default:
        items.push(mk("plant", 0.4, 0.4));
    }
  }

  // De-clash naively when two sets landed on the same anchor (merged rooms).
  const seen = new Set<string>();
  for (const it of items) {
    let key = `${it.x.toFixed(1)}:${it.z.toFixed(1)}`;
    while (seen.has(key)) {
      it.x = Math.min(w - 0.4, it.x + 0.8);
      key = `${it.x.toFixed(1)}:${it.z.toFixed(1)}`;
    }
    seen.add(key);
  }
  return items;
}
