'use client';
import {useEffect,useState} from 'react';
export function PaymentRouting(){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const r=await fetch('/api/admin/business/payment-routing');const d=await r.json();if(!r.ok)throw Error(d.message||d.error);setRows(d);};
 useEffect(()=>{load().catch(e=>setError(String(e)));},[]);
 return <section><h2>Merchant payment destinations</h2><p>Enter each merchant’s verified Flutterwave subaccount. New online payments go to that merchant, less provider fees, with zero commission deducted by Fida at checkout. Commission is invoiced separately. Clearing a destination disables new online checkouts.</p>{error&&<p className="mp-error" role="alert">{error}</p>}{rows.map(row=><form className="mp-panel" key={row.id} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{const r=await fetch(`/api/admin/business/tenants/${row.id}/payment-routing`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({paymentSubaccount:String(f.get('subaccount')||'').trim()||null})});const d=await r.json();if(!r.ok)throw Error(d.message||d.error);await load();}catch(e){setError(String(e));}finally{setBusy(false);}}}><h3>{row.name}</h3><label>Verified merchant subaccount<input name="subaccount" defaultValue={row.paymentSubaccount||''} pattern="RS_[A-Za-z0-9]{5,100}"/></label><button disabled={busy}>Save payment destination</button></form>)}</section>;
}
