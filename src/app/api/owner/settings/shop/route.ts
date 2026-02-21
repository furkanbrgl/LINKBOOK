import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireOwner";
import { createServerSupabaseClient } from "@/lib/db/supabase.server";
import { BrandingSchema, TemplateOverridesSchema } from "@/lib/templates/types";

const slugRegex = /^[a-z0-9-]+$/;

function normalizeReminderTime(s: string): string | null {
  const trimmed = s.trim();
  // HH:MM or HH:MM:SS
  const twoPart = /^(\d{1,2}):(\d{2})$/;
  const threePart = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  const m2 = trimmed.match(twoPart);
  const m3 = trimmed.match(threePart);
  if (m2) {
    const h = Math.max(0, Math.min(23, parseInt(m2[1], 10)));
    const min = Math.max(0, Math.min(59, parseInt(m2[2], 10)));
    return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;
  }
  if (m3) {
    const h = Math.max(0, Math.min(23, parseInt(m3[1], 10)));
    const min = Math.max(0, Math.min(59, parseInt(m3[2], 10)));
    const sec = Math.max(0, Math.min(59, parseInt(m3[3], 10)));
    return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return null;
}

const IndustryTemplateSchema = z.enum(["generic", "barber", "dental"]);

/** Remove empty strings and empty nested objects; return null if nothing left. */
function normalizeTemplateOverrides(
  obj: Record<string, unknown>
): Record<string, unknown> | null {
  const strip = (o: unknown): unknown => {
    if (typeof o === "string") return o === "" ? undefined : o;
    if (o != null && typeof o === "object" && !Array.isArray(o)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        const vv = strip(v);
        if (vv !== undefined) out[k] = vv;
      }
      return Object.keys(out).length === 0 ? undefined : out;
    }
    return o;
  };
  const result = strip(obj) as Record<string, unknown> | undefined;
  if (result == null || Object.keys(result).length === 0) return null;
  return result;
}

const BodySchema = z
  .object({
    shopId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .refine((s) => slugRegex.test(s.toLowerCase()), {
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      }),
    timezone: z.string().min(1, "Timezone is required"),
    phone: z.string().max(32).nullable().optional(),
    address: z.string().nullable().optional(),
    reminder_next_day_enabled: z.boolean(),
    reminder_next_day_send_time_local: z
      .string()
      .min(1)
      .refine((s) => normalizeReminderTime(s) != null, {
        message: "Invalid time; use HH:MM or HH:MM:SS",
      }),
    industry_template: IndustryTemplateSchema.optional(),
    branding: BrandingSchema.partial().optional(),
    template_overrides: TemplateOverridesSchema.partial().optional(),
    reset_template_overrides: z.boolean().optional(),
    reset_branding: z.boolean().optional(),
  })
  .transform((d) => ({
    ...d,
    slug: d.slug.toLowerCase().trim(),
    reminder_next_day_send_time_local: normalizeReminderTime(
      d.reminder_next_day_send_time_local
    )!,
  }));

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  if (raw?.reset_branding === true) {
    const parsed = z.object({ shopId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { shopId } = parsed.data;
    if (!owner.shopIds.includes(shopId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: updated, error } = await supabase
      .from("shops")
      .update({ branding: null, updated_at: new Date().toISOString() })
      .eq("id", shopId)
      .select("id, slug")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to reset branding" },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Shop not found or access denied" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: true, shopId: updated.id, slug: updated.slug },
      { status: 200 }
    );
  }

  if (raw?.reset_template_overrides === true) {
    const resetParsed = z.object({ shopId: z.string().uuid() }).safeParse(body);
    if (!resetParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: resetParsed.error.flatten() },
        { status: 400 }
      );
    }
    const { shopId } = resetParsed.data;
    if (!owner.shopIds.includes(shopId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: updated, error } = await supabase
      .from("shops")
      .update({
        template_overrides: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId)
      .select("id, slug")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to reset template overrides" },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Shop not found or access denied" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: true, shopId: updated.id, slug: updated.slug },
      { status: 200 }
    );
  }

  if (
    raw?.industry_template != null &&
    typeof raw?.name !== "string"
  ) {
    const parsed = z
      .object({
        shopId: z.string().uuid(),
        industry_template: IndustryTemplateSchema,
        reset_template_overrides: z.boolean().optional(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { shopId, industry_template, reset_template_overrides } = parsed.data;
    if (!owner.shopIds.includes(shopId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = await createServerSupabaseClient();
    const payload: Record<string, unknown> = {
      industry_template,
      updated_at: new Date().toISOString(),
    };
    if (reset_template_overrides === true) {
      payload.template_overrides = null;
    }
    const { data: updated, error } = await supabase
      .from("shops")
      .update(payload)
      .eq("id", shopId)
      .select("id, slug")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to update template" },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Shop not found or access denied" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: true, shopId: updated.id, slug: updated.slug },
      { status: 200 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { shopId, ...data } = parsed.data;

  if (!owner.shopIds.includes(shopId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();

  let brandingMerge: Record<string, unknown> | undefined;
  if (data.reset_branding === true) {
    brandingMerge = null;
  } else if (data.branding != null && Object.keys(data.branding).length > 0) {
    const { data: current } = await supabase
      .from("shops")
      .select("branding")
      .eq("id", shopId)
      .maybeSingle();
    const existing = (current?.branding as Record<string, unknown>) ?? {};
    brandingMerge = {
      ...existing,
      ...data.branding,
    };
    // Only allow known keys
    brandingMerge = {
      logoUrl: brandingMerge.logoUrl ?? existing.logoUrl,
      accentColor: brandingMerge.accentColor ?? existing.accentColor,
      coverImageUrl: brandingMerge.coverImageUrl ?? existing.coverImageUrl,
    };
  }

  const updatePayload: Record<string, unknown> = {
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    phone: data.phone ?? null,
    address: data.address ?? null,
    reminder_next_day_enabled: data.reminder_next_day_enabled,
    reminder_next_day_send_time_local: data.reminder_next_day_send_time_local,
    updated_at: new Date().toISOString(),
  };
  if (data.industry_template !== undefined) {
    updatePayload.industry_template = data.industry_template;
  }
  if (brandingMerge !== undefined) {
    updatePayload.branding = brandingMerge;
  }

  if (data.template_overrides != null && Object.keys(data.template_overrides).length > 0) {
    const incoming = data.template_overrides as Record<string, unknown>;
    const normalized = normalizeTemplateOverrides(incoming);
    if (normalized == null) {
      updatePayload.template_overrides = null;
    } else {
      const { data: current } = await supabase
        .from("shops")
        .select("template_overrides")
        .eq("id", shopId)
        .maybeSingle();
      const existing = (current?.template_overrides as Record<string, unknown>) ?? {};
      const merged = {
        ...existing,
        labels:
          normalized.labels != null
            ? { ...((existing.labels as Record<string, unknown>) ?? {}), ...(normalized.labels as Record<string, unknown>) }
            : existing.labels,
        ui:
          normalized.ui != null
            ? { ...((existing.ui as Record<string, unknown>) ?? {}), ...(normalized.ui as Record<string, unknown>) }
            : existing.ui,
        bookingCopy:
          normalized.bookingCopy != null
            ? {
                ...((existing.bookingCopy as Record<string, unknown>) ?? {}),
                ...(normalized.bookingCopy as Record<string, unknown>),
              }
            : existing.bookingCopy,
      };
      const mergedNormalized = normalizeTemplateOverrides(merged);
      updatePayload.template_overrides = mergedNormalized;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", shopId)
    .select("id, slug")
    .maybeSingle();

  if (updateError) {
    const code = (updateError as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update shop" },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Shop not found or access denied" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { ok: true, shopId: updated.id, slug: updated.slug },
    { status: 200 }
  );
}
