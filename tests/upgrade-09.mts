import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.9 upgrade adds five modules and preserves 0.8 data and financial values',async()=>{
 const db=await PGlite.create();
 try{
  const sql=execFileSync('node_modules/.bin/prisma',['migrate','diff','--from-empty','--to-schema','tests/fixtures/schema-0.8.prisma','--script'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://test:test@localhost/test'}});
  await db.exec(sql);
  await db.exec(`INSERT INTO "Tenant" (id,name,slug,"merchantType",status,"taxPercent","updatedAt") VALUES ('preserved','Preserved','preserved','RESTAURANT','ACTIVE',18,now())`);
  const migration=readFileSync('packages/database/prisma/upgrades/20260920-09-schema.sql','utf8');
  assert.doesNotMatch(migration,/DROP|TRUNCATE|DELETE/i);
  await db.exec('BEGIN;'+migration+'COMMIT;');
  const tenant=await db.query<{status:string;taxPercent:string}>(`SELECT status,"taxPercent" FROM "Tenant" WHERE id='preserved'`);
  assert.equal(tenant.rows[0].status,'ACTIVE');assert.equal(Number(tenant.rows[0].taxPercent),18);
  for(const name of ['MediaAsset','RuntimeSettings','AdminAction','CommissionPeriod','StoreVisit'])await db.query(`SELECT count(*) FROM "${name}"`);
 }finally{await db.close();}
});
