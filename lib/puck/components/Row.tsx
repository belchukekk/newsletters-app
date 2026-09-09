import type { ComponentConfig, Slot } from "@puckeditor/core";

type RowProps = {
  columns: 1 | 2 | 3 | 4;
  items: Slot;
};

// A row of any number of items, laid out N-across (columns 1-4) — the
// layout half of the old single NewsletterGrid component, now a native Puck
// component so rows and their contents are arranged with Puck's own canvas
// (drag to reorder, delete, etc.) instead of a bespoke dnd-kit editor. Not
// capped at 4 items: `items` is one slot holding as many as you like, and
// the grid's own CSS wrapping (see .promo-row in globals.css) lays them out
// N-per-line automatically — add more Newsletter/content components to
// THIS row's items instead of creating a second Row, so the grid re-flows
// as one continuous block instead of leaving a ragged last line per Row.
// Each item is a general-purpose slot — a Newsletter card, but just as well
// a Heading/BodyText/ImageBlock/ButtonBlock or several of those, not
// restricted to newsletters only.
//
// Puck wraps a slot's contents in one shared container div (confirmed via a
// spike, not documented) — .promo-row > div is set to `display: contents`
// in globals.css so that wrapper disappears from the box model and each
// item becomes a direct grid item instead of the wrapper being the only one.
export const Row: ComponentConfig<RowProps> = {
  label: "Række",
  fields: {
    columns: {
      type: "select",
      label: "Antal kolonner",
      options: [
        { label: "1", value: 1 },
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
      ],
    },
    items: { type: "slot" },
  },
  defaultProps: { columns: 1, items: [] },
  render: ({ columns, items: Items }) => (
    <div className={`promo-row promo-row--cols-${columns}`}>
      <Items />
    </div>
  ),
};
