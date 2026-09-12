import assert from "node:assert/strict";
import test from "node:test";
import { isSupplementDue } from "../lib/supplement-schedule.ts";

const date=(value:string)=>new Date(`${value}T12:00:00`);

test("fortnightly schedules repeat every fourteen days from their anchor",()=>{
  const item={schedule_frequency:"fortnightly" as const,schedule_anchor_date:"2026-09-01",scheduled_weekdays:[2]};
  assert.equal(isSupplementDue(item,date("2026-09-01")),true);
  assert.equal(isSupplementDue(item,date("2026-09-08")),false);
  assert.equal(isSupplementDue(item,date("2026-09-15")),true);
});

test("monthly schedules use the final day of shorter months",()=>{
  const item={schedule_frequency:"monthly" as const,schedule_anchor_date:"2026-01-31",scheduled_weekdays:[6]};
  assert.equal(isSupplementDue(item,date("2026-02-28")),true);
  assert.equal(isSupplementDue(item,date("2026-03-30")),false);
  assert.equal(isSupplementDue(item,date("2026-03-31")),true);
});

test("weekly schedules preserve selected weekday behaviour",()=>{
  const item={schedule_frequency:"weekly" as const,schedule_anchor_date:null,scheduled_weekdays:[1,3,5]};
  assert.equal(isSupplementDue(item,date("2026-09-07")),true);
  assert.equal(isSupplementDue(item,date("2026-09-08")),false);
});
