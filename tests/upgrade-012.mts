import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
await test('0.12 migration preserves historical items and distinguishes unknown from empty choices',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE TABLE "OrderItem" (id text PRIMARY KEY,"productName" text,"unitPrice" numeric); INSERT INTO "OrderItem" VALUES ('old','Meal · Rice',1200);`);
  const sql=readFileSync('packages/database/prisma/upgrades/20260927-012-schema.sql','utf8');
  for(let i=0;i<2;i++)await db.exec('BEGIN;'+sql+'COMMIT;');
  const {rows}=await db.query<any>(`SELECT * FROM "OrderItem" WHERE id='old'`);
  assert.equal(rows[0].selectedOptions,null);assert.equal(rows[0].productName,'Meal · Rice');assert.equal(Number(rows[0].unitPrice),1200);
  await db.exec(`INSERT INTO "OrderItem" (id,"selectedOptions") VALUES ('plain','[]'),('choices','["Rice"]');`);
  assert.deepEqual((await db.query<any>(`SELECT "selectedOptions" FROM "OrderItem" WHERE id='plain'`)).rows[0].selectedOptions,[]);
  assert.deepEqual((await db.query<any>(`SELECT "selectedOptions" FROM "OrderItem" WHERE id='choices'`)).rows[0].selectedOptions,['Rice']);
 }finally{await db.close();}
});
