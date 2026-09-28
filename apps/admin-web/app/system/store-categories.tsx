'use client';
import {useEffect,useState} from 'react';
type Row={code:string;name:string;icon:string;isActive:boolean;sortOrder:number;_count?:{stores:number}};
type Call=(p:string,m?:string,b?:unknown)=>Promise<any>;
const empty:Row={code:'',name:'',icon:'🛍️',isActive:true,sortOrder:0};
export function StoreCategories({call}:{call:Call}){
 const [rows,setRows]=useState<Row[]>([]),[edit,setEdit]=useState<Row>({...empty}),[existing,setExisting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>setRows(await call('store-categories'));
 useEffect(()=>{load().catch(e=>setError(String(e)));},[call]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();await load();}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <section className="mp-panel"><h2>Store categories</h2><p>Customer discovery and merchant registration categories. Merchants manage their menu categories separately.</p>{error&&<p role="alert" className="mp-error">{error}</p>}
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{await call(existing?`store-categories/${edit.code}`:'store-categories',existing?'PATCH':'POST',edit);setEdit({...empty});setExisting(false);});}}><div className="mp-form-grid">
 <label>Code<input required disabled={existing} pattern="[A-Za-z][A-Za-z0-9_]{1,49}" value={edit.code} onChange={e=>setEdit({...edit,code:e.target.value.toUpperCase()})}/></label>
 <label>Name<input required maxLength={80} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></label>
 <label>Icon<input required value={edit.icon} onChange={e=>setEdit({...edit,icon:e.target.value})}/></label>
 <label>Sort order<input required type="number" min="0" max="10000" value={edit.sortOrder} onChange={e=>setEdit({...edit,sortOrder:e.target.valueAsNumber})}/></label>
 <label><input type="checkbox" checked={edit.isActive} onChange={e=>setEdit({...edit,isActive:e.target.checked})}/>Visible</label></div>
 <button disabled={busy}>{existing?'Save category':'Add category'}</button>{existing&&<button type="button" onClick={()=>{setEdit({...empty});setExisting(false);}}>Cancel edit</button>}</form>
 <div className="table-wrap"><table className="control-table"><thead><tr><th>Category</th><th>Stores</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.code}><td>{row.icon} {row.name}<br/><small>{row.code}</small></td><td>{row._count?.stores??0}</td><td>{row.isActive?'Visible':'Hidden'}</td><td><button disabled={busy} onClick={()=>{setEdit(row);setExisting(true);}}>Edit</button><button className="mp-danger" disabled={busy} onClick={()=>{if(window.confirm(`Delete ${row.name}? Its stores and menus remain; they become uncategorized.`))void run(async()=>{await call(`store-categories/${row.code}`,'DELETE');if(edit.code===row.code){setEdit({...empty});setExisting(false);}});}}>Delete</button></td></tr>)}</tbody></table></div>
 </section>;
}
