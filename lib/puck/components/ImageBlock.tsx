import type { ComponentConfig } from "@puckeditor/core";
import { ImageUploadField } from "@/lib/puck/fields/ImageUploadField";

type ImageBlockProps = {
  imageUrl?: string;
  alt: string;
  treatment: "none" | "rounded" | "soft";
};

// The hero's decorative photo. Deliberately not a clone of the reference
// screenshot's bespoke organic-blob collage illustration — that artwork
// doesn't exist anywhere in this codebase (checked, see plan) — just an
// uploaded photo with a simple CSS shape treatment on top.
export const ImageBlock: ComponentConfig<ImageBlockProps> = {
  label: "Billede",
  fields: {
    imageUrl: { type: "custom", render: ImageUploadField, label: "Billede" },
    alt: { type: "text", label: "Alt-tekst" },
    treatment: {
      type: "select",
      options: [
        { label: "Ingen", value: "none" },
        { label: "Afrundet", value: "rounded" },
        { label: "Blødt", value: "soft" },
      ],
    },
  },
  defaultProps: { alt: "", treatment: "soft" },
  render: ({ imageUrl, alt, treatment }) =>
    imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- image host is S3, not worth a remotePatterns config (matches the rest of the app)
      <img
        className={treatment === "none" ? "hero-image" : `hero-image hero-image--${treatment}`}
        src={imageUrl}
        alt={alt}
      />
    ) : (
      <div className="hero-image hero-image--empty" />
    ),
};
