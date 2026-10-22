import { cookies } from 'next/headers';
export async function POST(req:Request){if(new URL(req.headers.get('origin')||'http://invalid').host!==req.headers.get('host'))return new Response('Forbidden',{status:403});(await cookies()).delete('commerce_admin');return Response.json({ok:true});}
