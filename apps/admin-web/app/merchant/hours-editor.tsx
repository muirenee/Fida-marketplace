'use client';
type Window={open:string;close:string};
export function HoursEditor({value,onChange}:{value:any[];onChange:(v:Window[][])=>void}){
 const hours=Array.from({length:7},(_,i)=>Array.isArray(value[i])?value[i]:value[i]?[value[i]]:[]) as Window[][];
 const set=(i:number,windows:Window[])=>onChange(hours.map((v,d)=>d===i?windows:v));
 return <>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i)=><fieldset key={day}><legend>{day}</legend>{!hours[i].length&&<p>Closed</p>}{hours[i].map((w,j)=><div className="mp-form-grid" key={j}>{(['open','close'] as const).map(k=><label key={k}>{k}<input type="time" required value={w[k]} onChange={e=>set(i,hours[i].map((v,n)=>n===j?{...v,[k]:e.target.value}:v))}/></label>)}<button type="button" className="mp-secondary" onClick={()=>set(i,hours[i].filter((_,n)=>n!==j))}>Remove window</button></div>)}<button type="button" disabled={hours[i].length>=4} onClick={()=>set(i,[...hours[i],{open:'09:00',close:'18:00'}])}>Add opening window</button></fieldset>)}</>;
}
