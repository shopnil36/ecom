import { Pool } from 'pg';
let pool:Pool|undefined;
export function getPool(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is missing');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000});}
class Statement{
 values:any[]=[];
 mustChange=false;
 requireChange(){this.mustChange=true;return this;}
 constructor(public sql:string){}
 bind(...values:any[]){this.values=values;return this;}
 query(){let index=0;let sql=this.sql.replaceAll('INSERT OR IGNORE INTO','INSERT INTO').replaceAll('?',()=>`$${++index}`);if(this.sql.includes('INSERT OR IGNORE'))sql+=' ON CONFLICT DO NOTHING';return {text:sql,values:this.values};}
 async all(){const r=await getPool().query(this.query());return {results:r.rows};}
 async first(){return (await this.all()).results[0]||null;}
 async run(){const r=await getPool().query(this.query());return {meta:{changes:r.rowCount}};}
}
export const database={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){const client=await getPool().connect();try{await client.query('BEGIN');const out=[];for(const s of statements){const result=await client.query(s.query());if(s.mustChange&&!result.rowCount)throw Object.assign(new Error('Stock or product changed. Refresh and try again.'),{status:409});out.push(result);}await client.query('COMMIT');return out;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};
