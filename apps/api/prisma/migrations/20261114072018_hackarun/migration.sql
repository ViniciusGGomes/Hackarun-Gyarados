-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('attendant', 'manager');

-- CreateEnum
CREATE TYPE "location_type" AS ENUM ('entrance', 'food_court', 'parking', 'store_area', 'service', 'other');

-- CreateEnum
CREATE TYPE "service_kind" AS ENUM ('interactive', 'informational');

-- CreateEnum
CREATE TYPE "service_flow" AS ENUM ('equipment_reservation', 'lost_report', 'sac_message', 'none');

-- CreateEnum
CREATE TYPE "equipment_type" AS ENUM ('wheelchair', 'stroller');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('reservation', 'lost_report', 'sac_message');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('reserved', 'picked_up', 'returned', 'no_show', 'registered', 'searching', 'possible_match', 'ready_for_pickup', 'delivered', 'closed_not_found', 'open', 'in_progress', 'answered', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "reservation_for_whom" AS ENUM ('self', 'other');

-- CreateEnum
CREATE TYPE "wheelchair_size" AS ENUM ('adult', 'child');

-- CreateEnum
CREATE TYPE "stroller_kind" AS ENUM ('single', 'double');

-- CreateEnum
CREATE TYPE "object_category" AS ENUM ('documents', 'wallet_bag', 'phone_electronics', 'keys', 'clothing_accessories', 'glasses_jewelry', 'other');

-- CreateEnum
CREATE TYPE "day_period" AS ENUM ('morning', 'afternoon', 'night', 'unknown');

-- CreateEnum
CREATE TYPE "sac_subject" AS ENUM ('question', 'complaint', 'suggestion', 'compliment', 'other', 'data_deletion');

-- CreateEnum
CREATE TYPE "found_item_status" AS ENUM ('stored', 'delivered', 'discarded', 'forwarded');

-- CreateEnum
CREATE TYPE "message_author" AS ENUM ('staff', 'visitor');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('staff', 'visitor', 'system');

-- CreateEnum
CREATE TYPE "notification_event" AS ENUM ('reservation_confirmed', 'status_changed', 'new_message');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "floor" VARCHAR(40) NOT NULL,
    "type" "location_type" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "short_description" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(60),
    "kind" "service_kind" NOT NULL,
    "flow" "service_flow" NOT NULL DEFAULT 'none',
    "equipment_type" "equipment_type",
    "how_it_works" TEXT[],
    "contact_phone" VARCHAR(30),
    "pickup_location_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" SERIAL NOT NULL,
    "weekday" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "open_time" VARCHAR(5),
    "close_time" VARCHAR(5),

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "loan_duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "pickup_tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
    "max_advance_days" INTEGER NOT NULL DEFAULT 7,
    "max_active_reservations_per_phone" INTEGER NOT NULL DEFAULT 1,
    "require_document_on_pickup" BOOLEAN NOT NULL DEFAULT false,
    "found_item_storage_days" INTEGER NOT NULL DEFAULT 90,
    "personal_data_retention_days" INTEGER NOT NULL DEFAULT 180,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "equipment_type" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "pickup_location_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" VARCHAR(20) NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "protocol" VARCHAR(13) NOT NULL,
    "type" "request_type" NOT NULL,
    "status" "request_status" NOT NULL,
    "visitor_name" VARCHAR(120) NOT NULL,
    "visitor_phone" VARCHAR(11),
    "visitor_email" VARCHAR(255),
    "has_new_visitor_reply" BOOLEAN NOT NULL DEFAULT false,
    "first_response_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "anonymized_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "privacy_notice_version" VARCHAR(20) NOT NULL,
    "purpose" VARCHAR(120) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "equipment_type" "equipment_type" NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "pickup_deadline" TIMESTAMPTZ(3) NOT NULL,
    "picked_up_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "for_whom" "reservation_for_whom",
    "size" "wheelchair_size",
    "stroller_kind" "stroller_kind",
    "current_location_id" UUID,
    "notes" VARCHAR(200),
    "document_checked" BOOLEAN,
    "pickup_notes" VARCHAR(300),
    "return_notes" VARCHAR(300),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unmet_demands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_type" "equipment_type" NOT NULL,
    "requested_for" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmet_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "category" "object_category" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "identification_detail" VARCHAR(300),
    "photo_url" VARCHAR(500),
    "location_id" UUID,
    "unknown_location" BOOLEAN NOT NULL DEFAULT false,
    "lost_date" DATE NOT NULL,
    "lost_period" "day_period" NOT NULL DEFAULT 'unknown',
    "found_item_id" UUID,
    "matched_at" TIMESTAMPTZ(3),
    "identification_validated" BOOLEAN,
    "delivered_at" TIMESTAMPTZ(3),
    "delivery_notes" VARCHAR(300),

    CONSTRAINT "lost_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "found_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seq" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "status" "found_item_status" NOT NULL DEFAULT 'stored',
    "category" "object_category" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "found_location_id" UUID NOT NULL,
    "found_at" TIMESTAMPTZ(3) NOT NULL,
    "stored_place" VARCHAR(120),
    "photo_url" VARCHAR(500),
    "handed_in_by" VARCHAR(120),
    "storage_deadline" DATE NOT NULL,
    "registered_by_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "close_notes" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "found_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sac_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "subject" "sac_subject" NOT NULL,
    "message" VARCHAR(1500) NOT NULL,
    "related_service_id" UUID,
    "related_protocol" VARCHAR(13),

    CONSTRAINT "sac_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "author" "message_author" NOT NULL,
    "author_user_id" UUID,
    "text" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "from_status" "request_status",
    "to_status" "request_status" NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_user_id" UUID,
    "internal_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "event" "notification_event" NOT NULL,
    "to_email" VARCHAR(255) NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" VARCHAR(60) NOT NULL,
    "status" "job_status" NOT NULL,
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "error" VARCHAR(500),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_floor_key" ON "locations"("name", "floor");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_active_sort_order_idx" ON "services"("active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_weekday_key" ON "opening_hours"("weekday");

-- CreateIndex
CREATE INDEX "equipment_type_active_idx" ON "equipment"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_notices_version_key" ON "privacy_notices"("version");

-- CreateIndex
CREATE UNIQUE INDEX "requests_protocol_key" ON "requests"("protocol");

-- CreateIndex
CREATE INDEX "requests_type_status_idx" ON "requests"("type", "status");

-- CreateIndex
CREATE INDEX "requests_visitor_phone_type_status_idx" ON "requests"("visitor_phone", "type", "status");

-- CreateIndex
CREATE INDEX "requests_created_at_idx" ON "requests"("created_at");

-- CreateIndex
CREATE INDEX "requests_anonymized_at_completed_at_idx" ON "requests"("anonymized_at", "completed_at");

-- CreateIndex
CREATE INDEX "consents_request_id_idx" ON "consents"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_request_id_key" ON "reservations"("request_id");

-- CreateIndex
CREATE INDEX "reservations_equipment_type_start_at_end_at_idx" ON "reservations"("equipment_type", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "reservations_start_at_idx" ON "reservations"("start_at");

-- CreateIndex
CREATE INDEX "unmet_demands_equipment_type_created_at_idx" ON "unmet_demands"("equipment_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lost_reports_request_id_key" ON "lost_reports"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "lost_reports_found_item_id_key" ON "lost_reports"("found_item_id");

-- CreateIndex
CREATE INDEX "lost_reports_category_idx" ON "lost_reports"("category");

-- CreateIndex
CREATE INDEX "lost_reports_lost_date_idx" ON "lost_reports"("lost_date");

-- CreateIndex
CREATE INDEX "lost_reports_location_id_idx" ON "lost_reports"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "found_items_seq_key" ON "found_items"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "found_items_code_key" ON "found_items"("code");

-- CreateIndex
CREATE INDEX "found_items_status_storage_deadline_idx" ON "found_items"("status", "storage_deadline");

-- CreateIndex
CREATE INDEX "found_items_category_idx" ON "found_items"("category");

-- CreateIndex
CREATE INDEX "found_items_found_location_id_idx" ON "found_items"("found_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "sac_messages_request_id_key" ON "sac_messages"("request_id");

-- CreateIndex
CREATE INDEX "request_messages_request_id_created_at_idx" ON "request_messages"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_history_request_id_created_at_idx" ON "request_history"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_request_id_idx" ON "notification_logs"("request_id");

-- CreateIndex
CREATE INDEX "job_logs_job_name_started_at_idx" ON "job_logs"("job_name", "started_at");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_privacy_notice_version_fkey" FOREIGN KEY ("privacy_notice_version") REFERENCES "privacy_notices"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_reports" ADD CONSTRAINT "lost_reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_reports" ADD CONSTRAINT "lost_reports_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_reports" ADD CONSTRAINT "lost_reports_found_item_id_fkey" FOREIGN KEY ("found_item_id") REFERENCES "found_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_found_location_id_fkey" FOREIGN KEY ("found_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_items" ADD CONSTRAINT "found_items_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sac_messages" ADD CONSTRAINT "sac_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sac_messages" ADD CONSTRAINT "sac_messages_related_service_id_fkey" FOREIGN KEY ("related_service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_history" ADD CONSTRAINT "request_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_history" ADD CONSTRAINT "request_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
