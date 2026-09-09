import type { Config } from "@puckeditor/core";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { NewsletterPatch } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { Heading, Eyebrow, BodyText, Annotation, ButtonBlock, Spacer } from "@/lib/puck/components/text-components";
import { ImageBlock } from "@/lib/puck/components/ImageBlock";
import { TwoColumn } from "@/lib/puck/components/TwoColumn";
import { Row } from "@/lib/puck/components/Row";
import { buildNewsletterComponent } from "@/lib/puck/components/Newsletter";
import { buildPromotionComponent } from "@/lib/puck/components/Promotion";

// One config builder for both the admin editor (<Puck>, client) and the
// public page (<Render>, server) — a field's own render (the
// properties-panel UI) only ever runs inside <Puck>, and <Render> only
// calls each component's top-level render, so nothing editor-only leaks
// into the public path. The Newsletter/Promotion components' resolveData
// only ever reads plain values off `metadata` (never touches the database
// itself), so this config never needs a server-only/client-only split the
// way an earlier version of it did.
export function buildPuckConfig({
  newsletters,
  onNewsletterPatched = () => {},
}: {
  newsletters: Newsletter[];
  onNewsletterPatched?: (id: string, patch: NewsletterPatch) => void;
}): Config {
  return {
    categories: {
      hero: {
        title: "Forside",
        components: ["Eyebrow", "Heading", "BodyText", "Annotation", "ButtonBlock", "ImageBlock", "TwoColumn", "Spacer"],
      },
      grid: {
        title: "Nyhedsbreve",
        components: ["Row", "Newsletter", "Promotion"],
      },
    },
    components: {
      Heading,
      Eyebrow,
      BodyText,
      Annotation,
      ButtonBlock,
      ImageBlock,
      TwoColumn,
      Spacer,
      Row,
      Newsletter: buildNewsletterComponent({ newsletters, onNewsletterPatched }),
      Promotion: buildPromotionComponent({ newsletters, onNewsletterPatched }),
    },
  };
}
