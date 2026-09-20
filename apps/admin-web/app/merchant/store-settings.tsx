'use client';
import {useEffect,useState} from 'react';
type Row=Record<string,any>;
export function StoreSettings({call}:{call:(p:string,m?:string,b?:unknown)=>Promise<any>}){
 const [store,setStore]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{call('store').then(setStore).catch(e=>setError(String(e)));},[call]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}};
 if(!store)return <p>{error||'Loading store details…'}</p>;
 return <section className="mp-panel"><h2>Store identity and branches</h2>{error&&<p className="mp-error" role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();const {branches,currency,slug,...fields}=store;void run(async()=>{await call('store','PATCH',fields);setStore(await call('store'));});}}><div className="mp-form-grid">
  {['name','legalName','taxId','timezone'].map(key=><label key={key}>{({name:'Store name',legalName:'Legal entity',taxId:'Tax ID',timezone:'Time zone'} as Row)[key]}<input required value={store[key]||''} onChange={e=>setStore({...store,[key]:e.target.value})}/></label>)}
  <label>Business type<select value={store.merchantType} onChange={e=>setStore({...store,merchantType:e.target.value})}>{['RESTAURANT','SUPERMARKET','PHARMACY','RETAIL','OTHER'].map(t=><option key={t}>{t}</option>)}</select></label>
  <label>Cuisine/category tags<input required value={store.cuisineTags.join(', ')} onChange={e=>setStore({...store,cuisineTags:e.target.value.split(',').map(v=>v.trim())})}/></label>
  {['logoUrl','coverUrl'].map(key=><label key={key}>{key==='logoUrl'?'Logo':'Cover photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{if(file.size>5242880)throw Error('Maximum image size is 5 MB.');const response=await fetch('/api/merchant/branding',{method:'POST',headers:{'content-type':file.type},body:file});const result=await response.json();if(!response.ok)throw Error(result.message||result.error);setStore({...store,[key]:result.url});});}}/>{store[key]&&<img className="mp-preview" src={store[key]} alt={key}/>}</label>)}
 </div><p>Public store URL: {store.slug}</p><button disabled={busy}>Save store metadata</button></form>
 {store.branches.map((branch:Row)=><form className="mp-panel" key={branch.id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await call(`store/branches/${branch.id}`,'PATCH',{name:f.get('name'),addressLine:f.get('addressLine'),city:f.get('city'),latitude:Number(f.get('latitude')),longitude:Number(f.get('longitude')),isActive:f.get('isActive')==='on'});setStore(await call('store'));});}}><h3>{branch.name}</h3><div className="mp-form-grid">{['name','addressLine','city','latitude','longitude'].map(key=><label key={key}>{key}<input name={key} required type={['latitude','longitude'].includes(key)?'number':'text'} step="any" defaultValue={branch[key]??''}/></label>)}</div><label><input name="isActive" type="checkbox" defaultChecked={branch.isActive}/>Branch active</label><button disabled={busy}>Save branch</button></form>)}
 </section>;
}
