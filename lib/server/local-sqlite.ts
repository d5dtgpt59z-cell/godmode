/** Node-only local durable adapter. Never imported by Cloudflare routes. */
import {DatabaseSync} from 'node:sqlite';
import {SqlStore,type SqlDatabase,type Statement} from './store';
import {SCHEMA_SQL} from './schema';
export function localSqliteStore(path:string){
 const database=new DatabaseSync(path);database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');database.exec(SCHEMA_SQL);
 const source=new WeakMap<Statement,{sql:string;values:unknown[]}>();
 const wrap=(sql:string,values:unknown[]=[]):Statement=>{const statement:Statement={bind:(...next)=>wrap(sql,next),first:async<T>()=>(database.prepare(sql).get(...values as never[]) as T|undefined)??null,all:async<T>()=>({results:database.prepare(sql).all(...values as never[]) as T[]}),run:async()=>{const result=database.prepare(sql).run(...values as never[]);return{meta:{changes:Number(result.changes)}};}};source.set(statement,{sql,values});return statement;};
 const adapter:SqlDatabase={prepare:sql=>wrap(sql),exec:async sql=>database.exec(sql),batch:async statements=>{database.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements){const query=source.get(statement)!;const result=database.prepare(query.sql).run(...query.values as never[]);results.push({meta:{changes:Number(result.changes)}});}database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}}};
 return{store:new SqlStore(adapter),close:()=>database.close()};
}
