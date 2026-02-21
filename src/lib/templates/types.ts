import { z } from "zod";

export type IndustryTemplateKey = "generic" | "barber" | "dental";

export type TemplateLabels = {
  providerLabel: string;
  providersLabelPlural: string;
  serviceLabel: string;
  servicesLabelPlural: string;
  customerLabel: string;
  customersLabelPlural: string;
  bookingNoun: string;
};

export type BookingCopy = {
  heroTitle: string;
  heroSubtitle: string;
  microcopy: string[];
};

export type TemplateUI = {
  ctaConfirm: string;
  scheduleTitle: string;
  accentColorDefault: string;
};

export type IndustryTemplate = {
  key: IndustryTemplateKey;
  labels: TemplateLabels;
  bookingCopy: BookingCopy;
  ui: TemplateUI;
};

// Strict allowlist overrides
export const TemplateOverridesSchema = z
  .object({
    labels: z
      .object({
        providerLabel: z.string().min(1).max(40).optional(),
        providersLabelPlural: z.string().min(1).max(40).optional(),
        serviceLabel: z.string().min(1).max(40).optional(),
        servicesLabelPlural: z.string().min(1).max(40).optional(),
        customerLabel: z.string().min(1).max(40).optional(),
        customersLabelPlural: z.string().min(1).max(40).optional(),
        bookingNoun: z.string().min(1).max(40).optional(),
      })
      .optional(),
    bookingCopy: z
      .object({
        heroTitle: z.string().min(1).max(80).optional(),
        heroSubtitle: z.string().min(1).max(120).optional(),
        microcopy: z.array(z.string().min(1).max(120)).max(3).optional(),
      })
      .optional(),
    ui: z
      .object({
        ctaConfirm: z.string().min(1).max(40).optional(),
        scheduleTitle: z.string().min(1).max(60).optional(),
        accentColorDefault: z.string().min(1).max(30).optional(),
      })
      .optional(),
  })
  .strict();

export type TemplateOverrides = z.infer<typeof TemplateOverridesSchema>;

export const BrandingSchema = z
  .object({
    logoUrl: z.string().url().nullable().optional(),
    accentColor: z.string().min(1).max(30).nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type Branding = z.infer<typeof BrandingSchema>;
