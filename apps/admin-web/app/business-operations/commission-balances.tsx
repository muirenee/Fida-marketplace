'use client';
import {useEffect,useState} from 'react';
import {DocumentView} from '../merchant/document-view';
export function CommissionBalances(){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[document,setDocument]=useState<any>(null);
 useEffect(()=>{fetch('/api/admin/business/commission-balances').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||d.error);setRows(d);}).catch(e=>setError(String(e)));},[]);
 return <section><h2>Outstanding commission</h2><p>Merchant balances include commission charges, refund credits and recorded remittances. Remittances are recorded against a merchant balance, not allocated to individual invoices.</p>{error&&<p className="mp-error" role="alert">{error}</p>}{rows.map(row=><article className="mp-panel" key={row.id}><h3>{row.name}</h3><strong>{Number(row.outstanding).toLocaleString()} {row.currency} outstanding</strong>{row.documents.map((d:any)=><p key={d.id}><button className="mp-secondary" onClick={()=>setDocument(d)}>{d.number} · {d.payload.total} {row.currency}</button></p>)}</article>)}{document&&<DocumentView document={document} onClose={()=>setDocument(null)}/>}</section>;
}
