import { pgTable, uuid, text, jsonb, timestamp, bigserial, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { DrinkDef } from '$lib/drinks';

export const event = pgTable('event', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  hostToken: text('host_token').notNull(),
  drinks: jsonb('drinks').$type<DrinkDef[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const participant = pgTable('participant', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  cookieId: uuid('cookie_id').notNull(),
  nick: text('nick').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex('participant_nick_uq').on(t.eventId, sql`lower(${t.nick})`),
  uniqueIndex('participant_cookie_uq').on(t.eventId, t.cookieId)
]);

export const entry = pgTable('entry', {
  seq: bigserial('seq', { mode: 'number' }).primaryKey(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').notNull().references(() => participant.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'drink' | 'undo'>().notNull(),
  drinkKey: text('drink_key'),
  undoesSeq: bigint('undoes_seq', { mode: 'number' }),
  submissionId: text('submission_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex('entry_submission_uq').on(t.eventId, t.submissionId),
  index('entry_event_seq_idx').on(t.eventId, t.seq)
]);