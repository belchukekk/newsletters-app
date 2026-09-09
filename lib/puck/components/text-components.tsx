import type { ComponentConfig } from "@puckeditor/core";

// The freeform hero building blocks — marketing composes these (plus
// ImageBlock and TwoColumn, in their own files) in whatever arrangement they
// like on /admin/homepage. Deliberately plain text/textarea fields in v1, no
// rich formatting — see the plan's risk notes.

type HeadingProps = { text: string; level: "h1" | "h2" };

export const Heading: ComponentConfig<HeadingProps> = {
  label: "Overskrift",
  fields: {
    text: { type: "text" },
    level: {
      type: "select",
      options: [
        { label: "Stor (H1)", value: "h1" },
        { label: "Mellem (H2)", value: "h2" },
      ],
    },
  },
  defaultProps: { text: "Overskrift", level: "h1" },
  render: ({ text, level }) => {
    const Tag = level;
    return <Tag className="hero__heading">{text}</Tag>;
  },
};

type EyebrowProps = { text: string };

export const Eyebrow: ComponentConfig<EyebrowProps> = {
  label: "Kicker-tekst",
  fields: { text: { type: "text" } },
  defaultProps: { text: "NYHEDSBREVE FRA KRISTELIGT DAGBLAD" },
  render: ({ text }) => <p className="hero__eyebrow">{text}</p>,
};

type BodyTextProps = { text: string };

export const BodyText: ComponentConfig<BodyTextProps> = {
  label: "Brødtekst",
  fields: { text: { type: "textarea" } },
  defaultProps: { text: "Skriv en tekst her." },
  render: ({ text }) => <p className="hero__body">{text}</p>,
};

type AnnotationProps = { text: string; rotation: "-6" | "-3" | "0" | "3" | "6" };

export const Annotation: ComponentConfig<AnnotationProps> = {
  label: "Håndskrevet notat",
  fields: {
    text: { type: "text" },
    rotation: {
      type: "select",
      options: [
        { label: "-6°", value: "-6" },
        { label: "-3°", value: "-3" },
        { label: "0°", value: "0" },
        { label: "3°", value: "3" },
        { label: "6°", value: "6" },
      ],
    },
  },
  defaultProps: { text: "Sammen om et mere menneskeligt samfund", rotation: "-3" },
  render: ({ text, rotation }) => (
    <p className="hero__annotation" style={{ transform: `rotate(${rotation}deg)` }}>
      {text}
    </p>
  ),
};

type ButtonBlockProps = { label: string; href: string; variant: "primary" | "secondary" };

export const ButtonBlock: ComponentConfig<ButtonBlockProps> = {
  label: "Knap",
  fields: {
    label: { type: "text" },
    href: { type: "text", label: "Link" },
    variant: {
      type: "select",
      options: [
        { label: "Primær", value: "primary" },
        { label: "Sekundær", value: "secondary" },
      ],
    },
  },
  defaultProps: { label: "Se alle nyhedsbreve", href: "#nyhedsbreve", variant: "primary" },
  render: ({ label, href, variant }) => (
    <a className={variant === "secondary" ? "button button--secondary" : "button"} href={href}>
      {label}
    </a>
  ),
};

type SpacerProps = { size: "s" | "m" | "l" | "xl" };

export const Spacer: ComponentConfig<SpacerProps> = {
  label: "Mellemrum",
  fields: {
    size: {
      type: "select",
      options: [
        { label: "Lille", value: "s" },
        { label: "Mellem", value: "m" },
        { label: "Stor", value: "l" },
        { label: "Ekstra stor", value: "xl" },
      ],
    },
  },
  defaultProps: { size: "m" },
  render: ({ size }) => <div className={`spacer spacer--${size}`} />,
};
