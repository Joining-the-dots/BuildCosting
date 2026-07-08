import type { BuilderRate, ReworkCharge, Room, SelectedOption } from "../types";
import { groupCost } from "./pricingEngine";

/**
 * Rework engine.
 *
 * Jobs (room tasks) are mapped to the option groups they install and to the
 * "serviced" furniture kinds they plumb/wire in. Once a job is ticked
 * complete, changing the mapped spec — or moving a serviced fitting — means
 * undoing finished work, so a ReworkCharge is raised and priced live from
 * the rate library.
 */

/** Option group → the job that installs it. */
export const GROUP_TASK: Record<string, string> = {
  flooring: "Flooring",
  ufh: "Flooring",
  electrics: "First fix electrics",
  plumbing: "First fix plumbing",
  plastering: "Plastering",
  decoration: "Decoration",
  joinery: "Final fix",
};

/** Furniture kinds that are plumbed/wired in, and what moving them re-opens. */
export const SERVICE_ITEMS: Record<string, { taskName: string; points: number; label: string }> = {
  bath: { taskName: "First fix plumbing", points: 1, label: "Bath" },
  vanity: { taskName: "First fix plumbing", points: 1, label: "Vanity basin" },
  wc: { taskName: "First fix plumbing", points: 1, label: "WC" },
  shower: { taskName: "First fix plumbing", points: 1, label: "Shower" },
  kitchenRun: { taskName: "First fix plumbing", points: 3, label: "Kitchen run" },
  island: { taskName: "First fix electrics", points: 2, label: "Kitchen island" },
};

/** Is the named job ticked complete (or approved) in this room? */
export function taskDone(room: Room, taskName: string): boolean {
  const t = room.tasks.find((t) => t.name === taskName);
  return t?.status === "complete" || t?.status === "approved";
}

/** Live amount of a charge under current rates (waived charges cost nothing). */
export function reworkAmount(
  charge: ReworkCharge,
  rooms: Room[],
  baseline: Record<string, SelectedOption[]> | null,
  rates: BuilderRate[],
): number {
  if (charge.status === "waived") return 0;
  const rate = (id: string) => rates.find((r) => r.id === id)?.rate ?? 0;
  if (charge.source === "furniture-move") {
    return Math.round((charge.points ?? 1) * rate("rework_service_move"));
  }
  // option-change: undoing the work that was installed to the baseline spec
  const room = rooms.find((r) => r.id === charge.roomId);
  if (!room || !charge.groupId) return 0;
  const baseSels = baseline?.[charge.roomId] ?? [];
  const installed = groupCost(room, charge.groupId, baseSels, rates);
  return Math.round((installed * rate("rework_undo_pct")) / 100);
}

/** Total of all live (pending + accepted) rework charges. */
export function reworkTotal(
  charges: ReworkCharge[],
  rooms: Room[],
  baseline: Record<string, SelectedOption[]> | null,
  rates: BuilderRate[],
): number {
  return charges.reduce((s, c) => s + reworkAmount(c, rooms, baseline, rates), 0);
}

/** Preview the undo cost of changing a group whose job is already complete. */
export function undoCostForGroup(
  room: Room,
  groupId: string,
  baseline: Record<string, SelectedOption[]> | null,
  rates: BuilderRate[],
): number {
  const rate = rates.find((r) => r.id === "rework_undo_pct")?.rate ?? 0;
  const installed = groupCost(room, groupId, baseline?.[room.id] ?? [], rates);
  return Math.round((installed * rate) / 100);
}
