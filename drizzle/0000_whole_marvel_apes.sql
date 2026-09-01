CREATE TABLE "entry" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"drink_key" text,
	"undoes_seq" bigint,
	"submission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_kind_ck" CHECK ("entry"."kind" in ('drink', 'undo')),
	CONSTRAINT "entry_shape_ck" CHECK (
				("entry"."kind" = 'drink' and "entry"."drink_key" is not null and "entry"."undoes_seq" is null) or
				("entry"."kind" = 'undo' and "entry"."undoes_seq" is not null and "entry"."drink_key" is null)
			)
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"host_token_hash" text NOT NULL,
	"drinks" jsonb NOT NULL,
	"creator_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"cookie_id" uuid NOT NULL,
	"nick" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kicked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_undoes_fk" FOREIGN KEY ("undoes_seq") REFERENCES "public"."entry"("seq") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entry_submission_uq" ON "entry" USING btree ("event_id","submission_id");--> statement-breakpoint
CREATE INDEX "entry_event_seq_idx" ON "entry" USING btree ("event_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_undo_uq" ON "entry" USING btree ("undoes_seq") WHERE "entry"."kind" = 'undo';--> statement-breakpoint
CREATE INDEX "event_creator_idx" ON "event" USING btree ("creator_ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_nick_uq" ON "participant" USING btree ("event_id",lower("nick"));--> statement-breakpoint
CREATE UNIQUE INDEX "participant_cookie_uq" ON "participant" USING btree ("event_id","cookie_id") WHERE "participant"."kicked_at" is null;