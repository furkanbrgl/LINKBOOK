import { TEMPLATES } from "./registry";
import {
  BrandingSchema,
  TemplateOverridesSchema,
  type Branding,
  type IndustryTemplate,
  type IndustryTemplateKey,
} from "./types";
import { deepMerge } from "./merge";

type ShopLike = {
  industry_template?: string | null;
  template_overrides?: unknown | null;
  branding?: unknown | null;
};

export function getTemplateForShop(shop: ShopLike): {
  template: IndustryTemplate;
  branding: Branding;
} {
  const rawKey = (shop.industry_template ?? "generic") as IndustryTemplateKey;
  const base = TEMPLATES[rawKey] ?? TEMPLATES.generic;

  const overridesParsed = TemplateOverridesSchema.safeParse(
    shop.template_overrides ?? {}
  );
  const overrides = overridesParsed.success ? overridesParsed.data : {};

  const template = deepMerge(base, overrides);

  const brandingParsed = BrandingSchema.safeParse(shop.branding ?? {});
  const branding: Branding = brandingParsed.success ? brandingParsed.data : {};

  const accentColor =
    branding.accentColor ?? template.ui.accentColorDefault;

  return {
    template,
    branding: { ...branding, accentColor },
  };
}
