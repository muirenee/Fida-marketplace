'use client';
import {useEffect,useState} from 'react';
type Row=Record<string,any>;
export function DriverSettlements({call}:{call:(p:string,m?:string,b?:unknown)=>Promise<any>}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>call('driver-settlements').then(setRows);
 useEffect(()=>{load().catch(e=>setError(String(e)));},[call]);
 return <section><h2>Driver settlement records</h2><p>Record actual payments made by your business. Historical deliveries without a saved estimate require reconciliation against your payment records.</p>{error&&<p className="mp-error" role="alert">{error}</p>}{rows.map(r=><article className="mp-panel" key={r.id}><h3>{r.order.orderNumber}</h3><p>{r.driver?.displayName||r.driver?.user?.firstName} · {new Date(r.deliveredAt).toLocaleString()}</p><p>Agreed estimate: {r.estimatedPayout===null?'No historical estimate':`${r.estimatedPayout} ${r.payoutCurrency||r.order.tenant.currency}`}</p>{r.settledAt?<p>Recorded paid: {r.settledPayout} {r.payoutCurrency} · {r.settlementReference}</p>:<form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await call(`driver-settlements/${r.id}`,'POST',{amount:Number(f.get('amount')),reference:f.get('reference')});await load();}catch(e){setError(String(e));}finally{setBusy(false);}}}><div className="mp-form-grid"><label>Actual amount paid ({r.payoutCurrency||r.order.tenant.currency})<input type="number" min="0" step="0.01" required name="amount"/></label><label>Payment receipt reference<input required minLength={3} maxLength={120} name="reference"/></label></div><button disabled={busy}>Record verified payment</button></form>}</article>)}</section>;
}
