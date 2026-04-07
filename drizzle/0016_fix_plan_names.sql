-- Fix: subscription rows where plan='free' but have an active Stripe subscription
-- The plan name should be derived from the stripe_price_id

-- Your Starter monthly price
UPDATE "subscription"
SET "plan" = 'starter'
WHERE "stripe_price_id" = 'price_1TInS1DkfXQbwrmBfOQSTtAH'
  AND "status" = 'active';

-- Old flow price → enterprise
UPDATE "subscription"
SET "plan" = 'enterprise'
WHERE "stripe_price_id" = 'price_1TFSacDkfXQbwrmBP21gWzRq'
  AND "status" = 'active';

-- Old go price → professional
UPDATE "subscription"
SET "plan" = 'professional'
WHERE "stripe_price_id" = 'price_1TFSZBDkfXQbwrmBoCN8dIpB'
  AND "status" = 'active';
