import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.10 additive migration is repeatable and preserves existing users and monetary values',async()=>{
 const db=await PGlite.create();
 try{
  const sql=execFileSync('node_modules/.bin/prisma',['migrate','diff','--from-empty','--to-schema','tests/fixtures/schema-0.8.prisma','--script'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://test:test@localhost/test'}});
  await db.exec(sql);
  await db.exec(readFileSync('packages/database/prisma/upgrades/20260920-09-schema.sql','utf8'));
  await db.exec(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('preserved','preserved@example.test',now()); INSERT INTO "Tenant" (id,name,slug,"merchantType","taxPercent","updatedAt") VALUES ('preserved','Preserved','preserved','RESTAURANT',18,now());`);
  const migration=readFileSync('packages/database/prisma/upgrades/20260921-010-schema.sql','utf8');
  assert.doesNotMatch(migration,/DROP|TRUNCATE|DELETE/i);
  for(let i=0;i<2;i++)await db.exec('BEGIN;'+migration+'COMMIT;');
  const users=await db.query<{authVersion:number}>(`SELECT "authVersion" FROM "User" WHERE id='preserved'`);assert.equal(users.rows[0].authVersion,0);
  const tenants=await db.query<{taxPercent:string}>(`SELECT "taxPercent" FROM "Tenant" WHERE id='preserved'`);assert.equal(Number(tenants.rows[0].taxPercent),18);
  const indexes=await db.query(`SELECT indexname FROM pg_indexes WHERE indexname IN ('Order_status_createdAt_tenantId_idx','OrderItem_orderId_idx')`);assert.equal(indexes.rows.length,2);
 }finally{await db.close();}
});
