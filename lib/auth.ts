import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
export function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function secret(){const key=process.env.SESSION_SECRET;if(!key||key.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters');return key;}
export function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url');}
export async function identity(){const jar=await cookies();const raw=jar.get('commerce_session')?.value;let guest='';if(raw){const [id,signature]=raw.split('.');if(id&&signature&&safeEqual(signature,sign(id)))guest=id;}if(!guest){guest=randomUUID();jar.set('commerce_session',`${guest}.${sign(guest)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*30});}const admin=jar.get('commerce_admin')?.value;let isAdmin=false;if(admin){const [exp,sig]=admin.split('.');isAdmin=Number(exp)>Date.now()&&safeEqual(sig||'',sign(`admin:${guest}:${exp}`));}return {guest,isAdmin};}
