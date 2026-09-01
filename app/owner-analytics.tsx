"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Analytics={registered_users:number;tracked_users:number;active_7d:number;active_30d:number;installed_users:number;total_launches:number;body_check_ins:number;completed_workouts:number;generated_at:string};

export function OwnerAnalytics({userId,onNotice}:{userId:string;onNotice:(message:string)=>void}){
  const [owner,setOwner]=useState(false);const [data,setData]=useState<Analytics|null>(null);const [loading,setLoading]=useState(true);
  async function load(){setLoading(true);const {data:access,error:accessError}=await supabase.from("app_admins").select("user_id").eq("user_id",userId).maybeSingle();if(accessError){setLoading(false);return}if(!access){setOwner(false);setLoading(false);return}setOwner(true);const {data:result,error}=await supabase.rpc("get_owner_analytics");setLoading(false);if(error){onNotice(error.message);return}setData(result as Analytics)}
  useEffect(()=>{load()},[userId]);
  if(loading)return null;if(!owner)return null;
  return <section className="settings-section owner-analytics"><header><div><p className="eyebrow">OWNER ANALYTICS · PRIVATE</p><h3>Physique usage</h3><p>Aggregate app activity only. Personal measurements, photos and workout details are not shown here.</p></div><button type="button" onClick={load} aria-label="Refresh owner analytics">↻</button></header>{data?<><div className="owner-metrics"><span><strong>{data.registered_users}</strong><small>registered accounts</small></span><span><strong>{data.active_7d}</strong><small>active · 7 days</small></span><span><strong>{data.active_30d}</strong><small>active · 30 days</small></span><span><strong>{data.installed_users}</strong><small>installed-mode users</small></span></div><div className="owner-secondary"><span><b>{data.total_launches}</b> recorded launches</span><span><b>{data.body_check_ins}</b> check-ins</span><span><b>{data.completed_workouts}</b> workouts</span></div><small className="owner-note">Installed-mode users are counted after Physique is opened from a home-screen installation. Historical usage before this release is not included.</small></>:<p className="owner-empty">Analytics will appear after the first recorded app launch.</p>}</section>
}
