import { sql } from "void/db";
import { check, index, integer, sqliteTable, text } from "void/schema-d1";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Remaining sellable units per SKU. The CHECK constraint is the oversell guard:
 * a booking batch that would push a row below zero fails and rolls back as a whole.
 */
export const stock = sqliteTable(
  "stock",
  {
    sku: text("sku").primaryKey(),
    remaining: integer("remaining").notNull(),
  },
  (table) => [check("stock_remaining_non_negative", sql`${table.remaining} >= 0`)],
);

/** Redemptions per promo code, bounded by `max_uses` when the code has a limit. */
export const promoUsage = sqliteTable(
  "promo_usage",
  {
    code: text("code").primaryKey(),
    usedCount: integer("used_count").notNull().default(0),
    maxUses: integer("max_uses"),
  },
  (table) => [
    check(
      "promo_usage_within_limit",
      sql`${table.maxUses} IS NULL OR ${table.usedCount} <= ${table.maxUses}`,
    ),
  ],
);

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  requestHash: text("request_hash").notNull(),
  bookerName: text("booker_name").notNull(),
  bookerEmail: text("booker_email").notNull(),
  bookerPhone: text("booker_phone").notNull(),
  promoCode: text("promo_code"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  confirmationJson: text("confirmation_json").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Everyone who walks through the door, including the booker when attending. */
export const attendees = sqliteTable(
  "attendees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id),
    kind: text("kind", { enum: ["adult", "child", "toddler"] }).notNull(),
    fullName: text("full_name").notNull(),
    age: integer("age").notNull(),
    phone: text("phone"),
    attendanceDaysJson: text("attendance_days_json"),
  },
  (table) => [index("attendees_booking_id_idx").on(table.bookingId)],
);
