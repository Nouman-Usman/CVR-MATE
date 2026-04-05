-- Phase 3: Pricing Migration
-- Migrates legacy plan names (go/flow) to new plan names (starter/professional/enterprise)
-- Safe to re-run (idempotent) — only updates rows that still have old values

-- go users → free (they were on old pricing, need to re-subscribe at new price)
-- flow users → free (same reason)
-- If you want to grandfather them instead, change 'free' to 'professional'/'enterprise'
UPDATE "subscription" SET "plan" = 'free' WHERE "plan" = 'go';
UPDATE "subscription" SET "plan" = 'free' WHERE "plan" = 'flow';
