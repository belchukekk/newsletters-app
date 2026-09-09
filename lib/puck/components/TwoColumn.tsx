import type { ComponentConfig, Slot } from "@puckeditor/core";

type TwoColumnProps = {
  left: Slot;
  right: Slot;
  ratio: "1-1" | "2-1" | "1-2";
};

// Freeform layout primitive so marketing can compose e.g. text-stack + photo
// side by side (matching the reference screenshot's hero layout) without a
// dedicated "Hero" component baking that arrangement in as the only option.
export const TwoColumn: ComponentConfig<TwoColumnProps> = {
  label: "To kolonner",
  fields: {
    left: { type: "slot" },
    right: { type: "slot" },
    ratio: {
      type: "select",
      options: [
        { label: "Lige (1:1)", value: "1-1" },
        { label: "Bred venstre (2:1)", value: "2-1" },
        { label: "Bred højre (1:2)", value: "1-2" },
      ],
    },
  },
  defaultProps: { ratio: "1-1", left: [], right: [] },
  render: ({ left: Left, right: Right, ratio }) => (
    <div className={`two-column two-column--ratio-${ratio}`}>
      <div className="two-column__col">
        <Left />
      </div>
      <div className="two-column__col">
        <Right />
      </div>
    </div>
  ),
};
