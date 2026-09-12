ALTER TABLE "SystemPhoneNumber"
ADD COLUMN "disabledWebhookCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastDisabledWebhookAt" TIMESTAMP(3);

CREATE INDEX "SystemPhoneNumber_last_disabled_webhook_idx"
ON "SystemPhoneNumber"("lastDisabledWebhookAt");
