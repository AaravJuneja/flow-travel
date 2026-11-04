import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export const trips = sqliteTable(
  'trips',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    originCode: text('origin_code').notNull(),
    originName: text('origin_name').notNull(),
    destinationCode: text('destination_code').notNull(),
    destinationName: text('destination_name').notNull(),
    departureDate: text('departure_date').notNull(),
    departureTime: text('departure_time').notNull(),
    travelers: integer('travelers').notNull().default(1),
    status: text('status').notNull().default('planning'),
    selectedOptionId: text('selected_option_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('trips_user_updated_idx').on(table.userId, table.updatedAt)],
)

export const routeOptions = sqliteTable(
  'route_options',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    mode: text('mode').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull(),
    changes: integer('changes').notNull(),
    summary: text('summary').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('route_options_trip_idx').on(table.tripId)],
)

export const itinerarySegments = sqliteTable(
  'itinerary_segments',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    routeOptionId: text('route_option_id').notNull().references(() => routeOptions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    mode: text('mode').notNull(),
    fromName: text('from_name').notNull(),
    toName: text('to_name').notNull(),
    departureTime: text('departure_time').notNull(),
    arrivalTime: text('arrival_time').notNull(),
    status: text('status').notNull().default('upcoming'),
    note: text('note').notNull().default(''),
  },
  (table) => [
    index('itinerary_trip_position_idx').on(table.tripId, table.position),
    uniqueIndex('itinerary_option_position_idx').on(table.routeOptionId, table.position),
  ],
)

export const walletItems = sqliteTable(
  'wallet_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    referenceCode: text('reference_code').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('wallet_trip_idx').on(table.tripId),
    uniqueIndex('wallet_reference_idx').on(table.referenceCode),
  ],
)

export const journeyEvents = sqliteTable(
  'journey_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    message: text('message').notNull(),
    delayMinutes: integer('delay_minutes'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('journey_events_trip_time_idx').on(table.tripId, table.createdAt)],
)

export const paymentRecords = sqliteTable(
  'payment_records',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    providerReference: text('provider_reference'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('payment_trip_idx').on(table.tripId)],
)
