import {NextResponse} from 'next/server';
import {backendBaseUrl} from '../../../lib/backend';
export async function GET(){
 try{const r=await fetch(`${backendBaseUrl}/v1/marketplace/store-categories`,{cache:'no-store',signal:AbortSignal.timeout(10000)});return NextResponse.json(await r.json(),{status:r.status});}
 catch{return NextResponse.json({error:'categories_unavailable'},{status:502});}
}
