import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records',{key:text('key').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull()});
export const stock = sqliteTable('stock',{key:text('key').primaryKey(),item:text('item').notNull(),location:text('location').notNull(),available:integer('available').notNull()},(t)=>[check('stock_nonnegative',sql`${t.available} >= 0`)]);
export const completions = sqliteTable('completions',{draft:text('draft').primaryKey(),orderId:text('order_id').notNull()});
