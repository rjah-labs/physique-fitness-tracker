/** Calendar dates, not UTC timestamps: starting midweek never creates missed sessions. */
export function calendarDate(date:Date,timeZone?:string):string{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  return ["year","month","day"].map(type=>parts.find(part=>part.type===type)!.value).join("-");
}
export function nextScheduledDate(startDate:string,weekdays:number[],completed:number):string{
  const days=[...new Set(weekdays)].filter(day=>Number.isInteger(day)&&day>=0&&day<=6);
  if(!days.length||!Number.isInteger(completed)||completed<0)throw new Error("Invalid program schedule");
  const date=new Date(startDate+"T12:00:00Z");
  if(!Number.isFinite(date.getTime()))throw new Error("Invalid program start date");
  let remaining=completed;
  for(;;date.setUTCDate(date.getUTCDate()+1)){
    if(days.includes(date.getUTCDay())){if(remaining===0)return date.toISOString().slice(0,10);remaining--;}
  }
}
export function weekBounds(today:string){
  const start=new Date(today+"T12:00:00Z");start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+7);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
