import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getOrSeedHomepageContent } from "@/lib/domains/homepage";
import { HomepageEditor } from "./HomepageEditor";

// Full-viewport Puck editor for the public homepage (hero + newsletter
// grid) — lives outside the (shell) sidebar layout on purpose, see the
// plan's admin layout restructure. The parent app/(admin)/admin/layout.tsx
// still gates this on the same admin session check as every other /admin
// page.
export default async function HomepagePage() {
  const [newsletters, content] = await Promise.all([
    getAdminNewsletters(),
    getOrSeedHomepageContent(),
  ]);

  return <HomepageEditor initialNewsletters={newsletters} initialData={content.data} />;
}
