import { getTemplateForShop } from "../src/lib/templates/getTemplateForShop";

const out = getTemplateForShop({
  industry_template: "dental",
  template_overrides: { labels: { providerLabel: "Doctor" } },
  branding: { accentColor: "#0f766e" },
});

console.log(JSON.stringify(out, null, 2));