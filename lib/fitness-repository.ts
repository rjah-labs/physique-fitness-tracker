export const measurementFields = [
  { key: "shoulders", label: "Shoulders", group: "Upper body" },
  { key: "chest", label: "Chest", group: "Upper body" },
  { key: "neck", label: "Neck", group: "Upper body" },
  { key: "leftUpperArm", label: "Left upper arm", group: "Upper body" },
  { key: "rightUpperArm", label: "Right upper arm", group: "Upper body" },
  { key: "leftForearm", label: "Left forearm", group: "Upper body" },
  { key: "rightForearm", label: "Right forearm", group: "Upper body" },
  { key: "waist", label: "Waist", group: "Core" },
  { key: "abdomen", label: "Abdomen", group: "Core" },
  { key: "hipsGlutes", label: "Hips / glutes", group: "Core" },
  { key: "leftThigh", label: "Left thigh", group: "Lower body" },
  { key: "rightThigh", label: "Right thigh", group: "Lower body" },
  { key: "leftCalf", label: "Left calf", group: "Lower body" },
  { key: "rightCalf", label: "Right calf", group: "Lower body" },
] as const;

export type MeasurementKey = typeof measurementFields[number]["key"];
export type Measurements = Record<MeasurementKey, number>;
export type PhotoAngle = "front" | "side" | "back";
export type ProgressPhoto = { angle: PhotoAngle; storagePath: string; status: "pending" | "uploaded" };

export type CheckIn = {
  id: string;
  date: string;
  weight: number;
  measurements: Measurements;
  notes: string;
  photos: ProgressPhoto[];
  createdAt: string;
};

export const baselineCheckIn: CheckIn = {
  id: "baseline-2026-08-25",
  date: "2026-08-25",
  weight: 97.5,
  measurements: {
    leftCalf: 41.5, rightCalf: 43, waist: 93.5, abdomen: 94, chest: 107,
    shoulders: 132.5, hipsGlutes: 103, neck: 42, leftThigh: 60.5,
    rightThigh: 60.5, leftUpperArm: 35, rightUpperArm: 35,
    leftForearm: 31.5, rightForearm: 31,
  },
  notes: "Complete baseline measurement.",
  photos: [],
  createdAt: "2026-08-25T00:00:00.000Z",
};

export interface FitnessRepository {
  list(): CheckIn[];
  save(entry: CheckIn): void;
  remove(id: string): void;
}

const storageKey = "physique.check-ins.v2";
const legacyKey = "physique.check-ins.v1";

class LocalFitnessRepository implements FitnessRepository {
  list() {
    if (typeof window === "undefined") return [baselineCheckIn];
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as CheckIn[] | null;
      if (stored?.length) return stored.sort((a, b) => a.date.localeCompare(b.date));
      const legacy = JSON.parse(localStorage.getItem(legacyKey) || "null") as Array<{id:string;date:string;weight:number;waist:number}> | null;
      const migrated = legacy?.filter(item => item.id !== baselineCheckIn.id).map(item => ({
        ...baselineCheckIn, ...item, measurements: { ...baselineCheckIn.measurements, waist: item.waist },
        notes: "Migrated from Physique v0.1", photos: [], createdAt: new Date().toISOString(),
      })) || [];
      const entries = [baselineCheckIn, ...migrated];
      localStorage.setItem(storageKey, JSON.stringify(entries));
      return entries;
    } catch { return [baselineCheckIn]; }
  }
  save(entry: CheckIn) {
    const entries = this.list();
    const index = entries.findIndex(item => item.id === entry.id);
    if (index >= 0) entries[index] = entry; else entries.push(entry);
    localStorage.setItem(storageKey, JSON.stringify(entries.sort((a,b) => a.date.localeCompare(b.date))));
  }
  remove(id: string) {
    if (id === baselineCheckIn.id) return;
    localStorage.setItem(storageKey, JSON.stringify(this.list().filter(item => item.id !== id)));
  }
}

// A future Supabase adapter will implement this interface and map photos to a private bucket.
export const fitnessRepository: FitnessRepository = new LocalFitnessRepository();
