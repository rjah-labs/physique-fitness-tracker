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

import { supabase } from "./supabase";

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

type CheckInRow = {
  id: string; measured_on: string; weight_kg: number; notes: string | null; created_at: string;
  shoulders_cm:number; chest_cm:number; neck_cm:number; left_upper_arm_cm:number;
  right_upper_arm_cm:number; left_forearm_cm:number; right_forearm_cm:number;
  waist_cm:number; abdomen_cm:number; hips_glutes_cm:number; left_thigh_cm:number;
  right_thigh_cm:number; left_calf_cm:number; right_calf_cm:number;
  progress_photos?: Array<{angle:PhotoAngle;storage_path:string}>;
};

function fromRow(row: CheckInRow): CheckIn {
  return { id: row.id, date: row.measured_on, weight: Number(row.weight_kg), notes: row.notes || "", createdAt: row.created_at,
    measurements: { shoulders:Number(row.shoulders_cm), chest:Number(row.chest_cm), neck:Number(row.neck_cm),
      leftUpperArm:Number(row.left_upper_arm_cm), rightUpperArm:Number(row.right_upper_arm_cm),
      leftForearm:Number(row.left_forearm_cm), rightForearm:Number(row.right_forearm_cm), waist:Number(row.waist_cm),
      abdomen:Number(row.abdomen_cm), hipsGlutes:Number(row.hips_glutes_cm), leftThigh:Number(row.left_thigh_cm),
      rightThigh:Number(row.right_thigh_cm), leftCalf:Number(row.left_calf_cm), rightCalf:Number(row.right_calf_cm) },
    photos: (row.progress_photos || []).map(photo => ({angle:photo.angle,storagePath:photo.storage_path,status:"uploaded"})) };
}

function toRow(entry: CheckIn, userId: string) {
  const m=entry.measurements;
  return { id:entry.id, user_id:userId, measured_on:entry.date, weight_kg:entry.weight, notes:entry.notes,
    shoulders_cm:m.shoulders, chest_cm:m.chest, neck_cm:m.neck, left_upper_arm_cm:m.leftUpperArm,
    right_upper_arm_cm:m.rightUpperArm, left_forearm_cm:m.leftForearm, right_forearm_cm:m.rightForearm,
    waist_cm:m.waist, abdomen_cm:m.abdomen, hips_glutes_cm:m.hipsGlutes, left_thigh_cm:m.leftThigh,
    right_thigh_cm:m.rightThigh, left_calf_cm:m.leftCalf, right_calf_cm:m.rightCalf, updated_at:new Date().toISOString() };
}

export const cloudFitnessRepository = {
  async list(): Promise<CheckIn[]> {
    const {data,error}=await supabase.from("body_check_ins").select("*, progress_photos(angle, storage_path)").order("measured_on");
    if(error) throw error; return (data as CheckInRow[]).map(fromRow);
  },
  async save(entry:CheckIn,userId:string) {
    const {error}=await supabase.from("body_check_ins").upsert(toRow(entry,userId),{onConflict:"id"}); if(error) throw error;
  },
  async remove(entry:CheckIn) {
    for(const photo of entry.photos) await supabase.storage.from("progress-photos").remove([photo.storagePath]);
    const {error}=await supabase.from("body_check_ins").delete().eq("id",entry.id); if(error) throw error;
  },
  async importLocal(userId:string) {
    const existing=await this.list(); if(existing.length) return existing;
    const local=fitnessRepository.list();
    for(const entry of local) await this.save({...entry,id:entry.id.startsWith("baseline-")?crypto.randomUUID():entry.id},userId);
    return this.list();
  },
  async uploadPhoto(entry:CheckIn,userId:string,angle:PhotoAngle,file:File) {
    const extension=file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path=`${userId}/${entry.id}/${angle}.${extension}`;
    const {error:uploadError}=await supabase.storage.from("progress-photos").upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError) throw uploadError;
    const {error}=await supabase.from("progress_photos").upsert({user_id:userId,check_in_id:entry.id,angle,storage_path:path},{onConflict:"check_in_id,angle"});
    if(error) throw error;
  },
  async photoUrl(path:string) {
    const {data,error}=await supabase.storage.from("progress-photos").createSignedUrl(path,3600); if(error) throw error; return data.signedUrl;
  }
};
