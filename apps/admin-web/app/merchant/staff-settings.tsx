'use client';
import {useEffect,useState} from 'react';
type Row=Record<string,any>;
export function StaffSettings({call,branches,owner=true}:{call:(p:string,m?:string,b?:unknown)=>Promise<any>;branches:Row[];owner?:boolean}){
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=()=>call('staff').then(setRows);
 useEffect(()=>{void load().catch(e=>setError(String(e)));},[call]);
 const mutate=async(path:string,method:string,body?:unknown)=>{setBusy(true);setError('');try{await call(path,method,body);await load();}catch(e){setError(String(e));}finally{setBusy(false);}};
 const roles=owner?['STAFF','KITCHEN_CREW','MANAGER']:['STAFF','KITCHEN_CREW'];
 return <section className="mp-panel"><h2>Staff accounts</h2>{error&&<p className="mp-error" role="alert">{error}</p>}
  <form onSubmit={e=>{e.preventDefault();void mutate('staff','POST',Object.fromEntries(new FormData(e.currentTarget)));}}><div className="mp-form-grid">
   <label>Name<input name="firstName" required maxLength={80}/></label><label>Email<input name="email" type="email" required/></label><label>Initial password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
   <label>Role<select name="role">{roles.map(r=><option key={r}>{r}</option>)}</select></label><label>Branch<select name="branchId"><option value="">All permitted branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
  </div><button disabled={busy}>Create staff account</button></form>
  {rows.map(r=><article key={r.id} className="mp-panel"><h3>{r.user.firstName||r.user.email}</h3><p>{r.user.email} · {r.role} · {r.isActive?'Active':'Suspended'}</p>{roles.includes(r.role)&&<>
   <form onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));void mutate(`staff/${r.id}`,'PATCH',{...values,...(owner?{branchId:values.branchId||null}:{})});}}><div className="mp-form-grid">
    <label>First name<input name="firstName" maxLength={80} defaultValue={r.user.firstName||''}/></label><label>Last name<input name="lastName" maxLength={80} defaultValue={r.user.lastName||''}/></label>
    <label>Role<select name="role" defaultValue={r.role}>{roles.map(v=><option key={v}>{v}</option>)}</select></label>
    {owner&&<label>Branch assignment<select name="branchId" defaultValue={r.branchId||''}><option value="">All branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
   </div><button disabled={busy}>Save staff details</button></form>
   <div className="mp-actions"><button disabled={busy} onClick={()=>void mutate(`staff/${r.id}`,'PATCH',{isActive:!r.isActive})}>{r.isActive?'Suspend':'Activate'}</button><button className="mp-danger" disabled={busy} onClick={()=>{if(window.confirm('Permanently remove this store membership?'))void mutate(`staff/${r.id}`,'DELETE');}}>Delete membership</button></div>
  </>}</article>)}
 </section>;
}
