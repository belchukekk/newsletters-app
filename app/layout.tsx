import type { Metadata } from "next";
import { fontSans, fontSerif, fontSlab } from "./fonts";
import { Header } from "./Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kristeligt Dagblad Nyhedsbreve",
  description: "Tilmeld og administrer nyhedsbreve fra Kristeligt Dagblad.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="da"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontSlab.variable}`}
    >
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
