# Linkbook Templates — Non-Negotiable Rules (v1)

## Terms
- **Base template**: shipped in code at `src/lib/templates/registry.ts` (generic/barber/dental).
- **Shop template choice**: stored in `shops.industry_template`.
- **Overrides**: per-shop customizations stored in `shops.template_overrides` (JSON).
- **Branding**: per-shop theme data stored in `shops.branding` (JSON).

## What "editing a template" means
Shops DO NOT edit global templates.
They only edit **their own overrides** (labels/copy/ui text) and branding.

## Guaranteed safety rules
1) Changing `industry_template` must NEVER delete, overwrite, or mutate:
   - staff, services, working_hours, blocks, bookings, customers, outbox, tokens
2) Selecting a template must NEVER auto-rewrite existing services/staff.
3) "Suggested services" can only be added via an explicit **opt-in button** and must be additive.
4) Overrides must be validated by strict Zod allowlists. Unknown keys are rejected/ignored.

## Allowed customization surface (v1)
- Labels (Provider/Service/Customer wording + plurals)
- Booking page copy (hero title/subtitle, microcopy up to 3 lines)
- UI text (CTA confirm, schedule title)
- Branding (logo URL, accent color, cover image URL)

## Switching templates (expected behavior)
- Labels/copy change immediately in UI
- Existing data remains untouched
- Optional "Add suggested services" action may insert new services (no overwrite)

## Implementation contract
- Use `getTemplateForShop(shop)` everywhere in UI to obtain a merged template.
- Never read `shops.template_overrides` directly in UI without validation.
- Never mutate objects returned from registry; treat as immutable.
