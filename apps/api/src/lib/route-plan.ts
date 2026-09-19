import { haversineKm } from './delivery-pricing.js';
export type Stop={deliveryId:string;kind:'PICKUP'|'DROPOFF';address:string;latitude:number|null;longitude:number|null;orderNumber:string};
// Nearest eligible stop; a delivery's pickup always precedes its drop-off.
// This is a distance heuristic, not traffic-aware road optimization.
export function planStops(stops:Stop[],latitude:number|null,longitude:number|null):Stop[]{
 const remaining=[...stops],result:Stop[]=[];
 while(remaining.length){
  const eligible=remaining.filter(s=>s.kind==='PICKUP'||!remaining.some(p=>p.deliveryId===s.deliveryId&&p.kind==='PICKUP'));
  eligible.sort((a,b)=>{
   const distance=(s:Stop)=>latitude===null||longitude===null||s.latitude===null||s.longitude===null?Infinity:haversineKm(latitude,longitude,s.latitude,s.longitude);
   return distance(a)-distance(b);
  });
  const next=eligible[0]!;result.push(next);remaining.splice(remaining.indexOf(next),1);
  if(next.latitude!==null&&next.longitude!==null){latitude=next.latitude;longitude=next.longitude;}
 }
 return result;
}
