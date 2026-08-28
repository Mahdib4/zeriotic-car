/**
 * config.ts — Act 5 state.
 *
 * Paint, trim and package selections for every vehicle, in one external store
 * so the DOM controls and the WebGL canvas read the same values without
 * either owning the other. Selections persist as the visitor scrolls away and
 * back, which is what makes the configurator feel like showroom controls
 * rather than a form that resets.
 */

import { useSyncExternalStore } from "react";
import { vehicles, type CategoryId, type Vehicle } from "./content";

export interface VehicleConfig {
  paintId: string;
  trimId: string;
  packageIds: string[];
}

export type ConfigMap = Record<string, VehicleConfig>;

const initial: ConfigMap = Object.fromEntries(
  vehicles.map((v) => [
    v.id,
    { paintId: v.paints[0].id, trimId: v.trims[0].id, packageIds: [] as string[] },
  ]),
);

let state: ConfigMap = initial;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const getSnapshot = () => state;

export function useConfig(): ConfigMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getConfig(id: CategoryId): VehicleConfig {
  return state[id] ?? initial[id];
}

export function setPaint(id: CategoryId, paintId: string): void {
  state = { ...state, [id]: { ...getConfig(id), paintId } };
  emit();
}

export function setTrim(id: CategoryId, trimId: string): void {
  state = { ...state, [id]: { ...getConfig(id), trimId } };
  emit();
}

export function togglePackage(id: CategoryId, packageId: string): void {
  const cur = getConfig(id);
  const has = cur.packageIds.includes(packageId);
  state = {
    ...state,
    [id]: {
      ...cur,
      packageIds: has
        ? cur.packageIds.filter((x) => x !== packageId)
        : [...cur.packageIds, packageId],
    },
  };
  emit();
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export function resolvePaint(v: Vehicle, c: VehicleConfig) {
  return v.paints.find((x) => x.id === c.paintId) ?? v.paints[0];
}

export function resolveTrim(v: Vehicle, c: VehicleConfig) {
  return v.trims.find((x) => x.id === c.trimId) ?? v.trims[0];
}

export function configuredPrice(v: Vehicle, c: VehicleConfig): number {
  const paint = resolvePaint(v, c);
  const trim = resolveTrim(v, c);
  const packs = v.packages
    .filter((p) => c.packageIds.includes(p.id))
    .reduce((s, p) => s + p.price, 0);
  return v.startingPrice + paint.price + trim.price + packs;
}
