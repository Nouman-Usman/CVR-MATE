CREATE TABLE "feature_video" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"video_path" text NOT NULL,
	"thumbnail_path" text,
	"duration_seconds" integer,
	"auto_show" boolean DEFAULT true NOT NULL,
	"trigger_type" text DEFAULT 'auto' NOT NULL,
	"trigger_config" jsonb,
	"goal" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_is_current_check" CHECK (("feature_video"."status" = 'published' AND "feature_video"."is_current" = true) OR ("feature_video"."is_current" = false))
);
--> statement-breakpoint
CREATE TABLE "features" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_video_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"feature_key" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"view_count" integer DEFAULT 1 NOT NULL,
	"last_position_seconds" integer,
	"last_seen_version" integer NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"total_watch_time_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_video" ADD CONSTRAINT "feature_video_feature_key_features_key_fk" FOREIGN KEY ("feature_key") REFERENCES "public"."features"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_view" ADD CONSTRAINT "user_video_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_video_view" ADD CONSTRAINT "user_video_view_feature_key_features_key_fk" FOREIGN KEY ("feature_key") REFERENCES "public"."features"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_video_key_locale_version_idx" ON "feature_video" USING btree ("feature_key","locale","version");--> statement-breakpoint
CREATE INDEX "feature_video_key_locale_current_idx" ON "feature_video" USING btree ("feature_key","locale","is_current");--> statement-breakpoint
CREATE INDEX "features_route_idx" ON "features" USING btree ("route");--> statement-breakpoint
CREATE UNIQUE INDEX "user_video_view_user_feature_idx" ON "user_video_view" USING btree ("user_id","feature_key");--> statement-breakpoint
CREATE INDEX "user_video_view_user_idx" ON "user_video_view" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_video_current_idx" ON "feature_video" ("feature_key", "locale") WHERE "is_current" = true AND "status" = 'published';