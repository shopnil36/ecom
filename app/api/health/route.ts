import { getPool } from '../../../lib/postgres';
export async function GET(){try{await getPool().query('SELECT 1 FROM records LIMIT 1');return Response.json({status:'ok'});}catch{return Response.json({status:'unavailable'},{status:503});}}
