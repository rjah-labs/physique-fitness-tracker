export type CheckIn = { id: string; date: string; weight: number; waist: number };

export interface FitnessRepository {
  list(): CheckIn[];
  save(entry: CheckIn): void;
}

const baseline: CheckIn = { id: "baseline-2026-08-25", date: "2026-08-25", weight: 97.5, waist: 93.5 };
const storageKey = "physique.check-ins.v1";

class LocalFitnessRepository implements FitnessRepository {
  list() {
    if (typeof window === "undefined") return [baseline];
    try { return JSON.parse(localStorage.getItem(storageKey) || "null") || [baseline]; }
    catch { return [baseline]; }
  }
  save(entry: CheckIn) {
    localStorage.setItem(storageKey, JSON.stringify([...this.list(), entry]));
  }
}

// A future Supabase adapter only needs to implement this same interface.
export const fitnessRepository: FitnessRepository = new LocalFitnessRepository();
