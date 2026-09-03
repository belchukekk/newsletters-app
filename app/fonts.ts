import localFont from "next/font/local";

// Kristeligt Dagblad's actual brand fonts, ported from the legacy app's
// assets/scss/_typography.scss — not invented, this is the real design system.
export const fontSans = localFont({
  src: [
    { path: "../public/fonts/firasans.regular.woff", weight: "400", style: "normal" },
    { path: "../public/fonts/firasans.medium.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const fontSerif = localFont({
  src: [
    { path: "../public/fonts/metaserif.book.woff", weight: "400", style: "normal" },
    { path: "../public/fonts/metaserif.bookitalic.woff", weight: "400", style: "italic" },
    { path: "../public/fonts/metaserif.bold.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const fontSlab = localFont({
  src: [{ path: "../public/fonts/duplicateslab.bold.woff", weight: "700", style: "normal" }],
  variable: "--font-slab",
  display: "swap",
});
