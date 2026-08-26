# Configurable Services Booking App — Build Plan & Code-Generation Prompts

A step-by-step plan to build a config-driven, multi-vertical service booking app (starting with car care: PPF, ceramic coating, accessories fitting), plus copy-paste prompts for an AI coding assistant (Claude Code, Cursor, etc.) at each stage.

---

## 1. Finalized Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile app | React Native + Expo (TypeScript, managed workflow) | One codebase for iOS + Android, OTA updates via EAS Update without app-store resubmission for most JS-only changes |
| State/data fetching | TanStack Query + Zustand | Query caches server state (services, bookings); Zustand handles local UI state |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, Row Level Security) | Relational core with JSONB flexibility for per-service attributes; RLS gives you module-level access control without a custom backend |
| Admin/config panel | Next.js + Tailwind CSS, deployed on Vercel | Lets non-developers add services/pricing without touching app code |
| Payments | Razorpay | UPI + cards, standard for India-based service businesses |
| Push notifications | Expo Notifications + FCM/APNs (or OneSignal if you want a dashboard) | Booking confirmations, technician assignment updates, status changes |
| Mobile builds | EAS Build + EAS Submit | Handles iOS/Android binaries and store submission from one config |

**Why this fits "configurable & loosely coupled":** Supabase's Postgres + JSONB lets you store service-specific attributes without new tables/migrations for every service type. Each concern (Auth, Catalog, Booking, Payments, Notifications) can be built as an independent Edge Function / module, callable from both the mobile app and admin panel — nothing is hardwired to "car care" specifically.

---

## 2. Core Data Model

This is the most important design decision — get this right before writing app code.

- **categories** — `id, name, slug, icon, input_template_id` (input_template controls what info a booking needs — vehicle vs address vs room count)
- **services** — `id, category_id, name, description, images[], base_price, pricing_type (fixed/tiered/per_unit), duration_minutes, attributes (JSONB)`
- **pricing_rules** — `id, service_id, condition (JSONB: e.g. vehicle_size=SUV), price`
- **addons** — `id, service_id, name, price, is_multi_select`
- **input_templates** — `id, name, fields (JSONB schema: field name, type, required)` — this is what makes a new vertical possible without new screens
- **customer_assets** — `id, user_id, type (vehicle/property), attributes (JSONB)` — generic instead of a hardcoded `vehicles` table
- **bookings** — `id, user_id, service_id, asset_id, addon_ids[], scheduled_at, status, technician_id, total_price`
- **technicians** — `id, name, phone, category_ids[], status`
- **payments** — `id, booking_id, amount, status, razorpay_order_id`
- **profiles** — `id, name, phone, role (customer/technician/admin)`

---

## 3. Phased Plan of Action

| Phase | Goal | Output |
|---|---|---|
| 0 | Project scaffolding | Expo app, Supabase project, Next.js admin repo running locally |
| 1 | Schema & config data | Tables, RLS policies, seed data for Car Care services |
| 2 | Admin panel | CRUD for categories/services/pricing/addons |
| 3 | Mobile shell | Auth (OTP), navigation, theming |
| 4 | Catalog browsing | Config-driven category & service detail screens |
| 5 | Booking flow | Dynamic asset input form, scheduling, add-ons, price calc |
| 6 | Payments | Razorpay order creation + checkout |
| 7 | Notifications | Push on booking status change |
| 8 | Technician assignment | Admin-side assignment + technician status updates |
| 9 | Build & launch | EAS builds, store listings, submission |

---

## 4. Step-by-Step Code-Generation Prompts

Use these in order with your AI coding tool of choice. Each is written to be pasted as-is; adjust names/branding as needed. Run each in its own session/commit so you can review before moving on.

### Phase 0 — Scaffolding

**Prompt 1 — Mobile app scaffold**
```
Create a new Expo (managed workflow) React Native app in TypeScript called
"service-hub-app". Set up:
- Expo Router for file-based navigation
- TanStack Query and Zustand
- A .env-based config for Supabase URL/anon key
- ESLint + Prettier
- A basic folder structure: /app (screens), /components, /lib, /hooks, /types
Show me the folder structure and package.json when done.
```

**Prompt 2 — Supabase project setup**
```
I'm using Supabase as my backend. Generate the Supabase CLI setup steps to:
- Initialize a local Supabase project linked to my remote project
- Set up a /supabase/migrations folder
- Add a supabase/config.toml for local dev
Also generate a TypeScript Supabase client wrapper in /lib/supabase.ts that
reads the URL and anon key from environment variables.
```

**Prompt 3 — Admin panel scaffold**
```
Create a Next.js 14 (App Router) + TypeScript + Tailwind CSS admin panel
called "service-hub-admin". Include:
- Supabase client setup (server + browser clients)
- A basic authenticated layout with sidebar navigation (Categories,
  Services, Bookings, Technicians)
- A protected route pattern using Supabase Auth middleware
```

### Phase 1 — Schema & Config Data

**Prompt 4 — Core schema**
```
Write Postgres migration SQL for Supabase implementing this schema:
categories, services, pricing_rules, addons, input_templates,
customer_assets, bookings, technicians, payments, profiles.
[Paste the data model from Section 2 of this plan here]
Use UUID primary keys, foreign keys with ON DELETE CASCADE where sensible,
JSONB columns for flexible attributes, and created_at/updated_at timestamps
on every table. Add indexes on foreign keys and on bookings.status.
```

**Prompt 5 — Row Level Security**
```
Given the schema above, write RLS policies so that:
- Customers can only read/write their own bookings, customer_assets, and
  payments
- Categories, services, addons, pricing_rules, input_templates are
  publicly readable but only writable by users with role = 'admin' in
  profiles
- Technicians can read bookings assigned to them and update status only
Generate the SQL for enabling RLS and each policy.
```

**Prompt 6 — Seed data**
```
Write a SQL seed script that creates:
- One category: "Car Care" with an input_template requiring vehicle_make,
  vehicle_model, vehicle_size (hatchback/sedan/suv)
- Three services under it: "PPF (Paint Protection Film)", "Ceramic
  Coating", "Accessories Fitting" — each with realistic descriptions and
  tiered pricing_rules based on vehicle_size
- Two addons per service (e.g. "Interior detailing", "Headlight
  restoration")
```

### Phase 2 — Admin Panel

**Prompt 7 — Service CRUD UI**
```
In the Next.js admin panel, build a "Services" section with:
- A table listing all services (name, category, base price, status)
- A form to create/edit a service, including a dynamic pricing_rules
  editor (add/remove condition-price pairs) and an addons editor
- Use Supabase client to read/write, with optimistic UI updates
- Use shadcn/ui components for the table and form
```

**Prompt 8 — Image upload**
```
Add image upload support to the service form using Supabase Storage.
Create a "service-images" bucket, generate the upload/delete logic, show
a preview grid, and store the resulting public URLs in the service's
images array.
```

### Phase 3 — Mobile Shell

**Prompt 9 — Auth**
```
Implement phone number + OTP authentication in the Expo app using
Supabase Auth. Build:
- A phone number entry screen
- An OTP verification screen
- Session persistence using Expo SecureStore
- A useAuth hook exposing { user, session, signOut }
```

**Prompt 10 — Navigation shell**
```
Set up Expo Router tab navigation with tabs: Home, Bookings, Profile.
Add a stack navigator inside Home for category -> service detail ->
booking flow. Include a basic theme (colors, typography) in a shared
theme.ts file.
```

### Phase 4 — Catalog Browsing (config-driven)

**Prompt 11 — Category & service list**
```
Build a Home screen that fetches categories from Supabase and renders
them as cards. Tapping a category navigates to a Service List screen
showing all services in that category (image, name, starting price)
fetched via TanStack Query.
```

**Prompt 12 — Dynamic service detail screen**
```
Build a single ServiceDetailScreen component that renders based on the
service's data (not hardcoded per service): image carousel, description,
pricing_rules shown as a price table by vehicle_size, and an addons
checklist. This screen must work for any service in the catalog without
code changes — treat all content as data from the services/addons/
pricing_rules tables.
```

**Prompt 13 — Price calculation**
```
Write a pure function calculatePrice(service, selectedAttributes,
selectedAddonIds) that resolves the correct pricing_rule based on
selectedAttributes (e.g. vehicle_size) and sums selected addon prices.
Add unit tests covering fixed, tiered, and per_unit pricing_type cases.
```

### Phase 5 — Booking Flow

**Prompt 14 — Dynamic asset input form**
```
Build a DynamicForm component that renders form fields based on a
category's input_template.fields JSON schema (text, select, number
field types). Use it to collect vehicle_make/model/size for Car Care
bookings, saving the result as a customer_asset row linked to the user.
```

**Prompt 15 — Scheduling & booking creation**
```
Build a booking confirmation screen: date/time picker (constrained to
business hours), a summary of service + addons + calculated price, and
a "Confirm Booking" button that inserts a row into bookings with status
'pending_payment'.
```

**Prompt 16 — Booking status tracking**
```
Build a Bookings tab listing the user's bookings grouped by status
(Upcoming, In Progress, Completed, Cancelled), each showing service
name, scheduled time, technician (if assigned), and price. Add a detail
screen with a simple status timeline.
```

### Phase 6 — Payments

**Prompt 17 — Razorpay integration**
```
Create a Supabase Edge Function "create-razorpay-order" that takes a
booking_id, looks up the total price, and creates a Razorpay order via
their API, storing the razorpay_order_id on the booking. Then implement
the mobile-side checkout using react-native-razorpay, handling success
(update booking status to 'confirmed', insert a payments row) and
failure (keep status as 'pending_payment', show retry).
```

### Phase 7 — Notifications

**Prompt 18 — Push notifications**
```
Set up Expo push notifications: register device push tokens on login
and store them in a device_tokens table linked to profiles. Create a
Supabase Edge Function triggered on bookings.status changes (via a
Postgres trigger + webhook) that sends a push notification to the
relevant user and technician.
```

### Phase 8 — Technician Assignment

**Prompt 19 — Admin assignment UI**
```
In the admin panel, add a Bookings section showing pending bookings with
an "Assign Technician" dropdown filtered to technicians whose
category_ids include the booking's category. On assignment, update the
booking's technician_id and status to 'assigned', and trigger the push
notification flow from Prompt 18.
```

### Phase 9 — Build & Launch

**Prompt 20 — EAS build config**
```
Generate an eas.json with development, preview, and production build
profiles for iOS and Android. Include app.json config for bundle
identifier, app icon, splash screen, and required permissions
(notifications, camera if needed later).
```

**Prompt 21 — Store readiness checklist**
```
Give me a pre-submission checklist for Apple App Store and Google Play
covering: privacy policy URL, data safety form answers (what user data
we collect: phone, vehicle info, location for service), screenshots
needed per device size, and common rejection reasons for
booking/service apps.
```

---

## 5. Validation Checkpoint

Before adding a second vertical (e.g. bike service, home cleaning), test the architecture: create a new category with a *different* input_template (e.g. address + room count instead of vehicle info) and confirm you can launch it using **only admin panel entries** — zero app code changes. If that's not possible yet, that's the signal to revisit the config model before scaling further.
