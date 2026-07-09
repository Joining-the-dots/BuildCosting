import type { ThemeId } from "../types";

/** Visual config for the three selectable model themes. */
export interface ModelTheme {
  id: ThemeId;
  name: string;
  canvasBg: string;
  wallColor: string;
  wallTopColor: string;
  floorFallback: string; // used when no flooring option picked
  baseColor: string; // ground slab under the house
  showFurniture: boolean;
  showTextures: boolean;
  edgeGlow: boolean; // dark theme: glowing room outlines
  edgeColor: string;
  ambient: number;
  directional: number;
  labelClass: string; // tailwind classes for the floating room label pill
}

export const THEMES: Record<ThemeId, ModelTheme> = {
  dollhouse: {
    id: "dollhouse",
    name: "Premium Dollhouse",
    canvasBg: "#e7e1d5",
    wallColor: "#f4efe6",
    wallTopColor: "#8f8779", // contrasting cap on top of cutaway walls
    floorFallback: "#c9b697",
    baseColor: "#d5cebf",
    showFurniture: true,
    showTextures: true,
    edgeGlow: false,
    edgeColor: "#000000",
    ambient: 0.75,
    directional: 1.7,
    labelClass: "bg-white/90 text-stone-800 border border-stone-200 shadow-md",
  },
  architectural: {
    id: "architectural",
    name: "Clean Architectural",
    canvasBg: "#f4f5f7",
    wallColor: "#ffffff",
    wallTopColor: "#e2e5ea",
    floorFallback: "#eceef1",
    baseColor: "#e4e7ec",
    showFurniture: false,
    showTextures: false,
    edgeGlow: false,
    edgeColor: "#94a3b8",
    ambient: 1.0,
    directional: 1.2,
    labelClass: "bg-white text-slate-700 border border-slate-200 shadow-sm",
  },
};
