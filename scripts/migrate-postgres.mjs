import pg from 'pg';
import { readFile } from 'node:fs/promises';
for(const name of ['DATABASE_URL','SESSION_SECRET','ADMIN_PASSWORD','CHATTRN_ACCESS_TOKEN'])if(!process.env[name])throw new Error(`${name} is required`);
if(process.env.SESSION_SECRET.length<32||process.env.ADMIN_PASSWORD.length<12||process.env.CHATTRN_ACCESS_TOKEN.length<32)throw new Error('Use a 12+ character admin password and 32+ character session/API secrets');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(10422026)');await client.query(await readFile(new URL('../db/postgres.sql',import.meta.url),'utf8'));await client.query('COMMIT');console.log('Postgres schema ready');}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
