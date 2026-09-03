import type { GdprEvent } from "@/lib/integrations/bigquery";

// Shared by /admin/gdpr and /admin/gdpr/delete — port of
// page_newsletter-gdpr-overview.html.twig's event table.
export function GdprEventsTable({ events }: { events: GdprEvent[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Dato</th>
          <th>Beskrivelse</th>
          <th>Yderligere information</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event, index) => (
          <tr key={index}>
            <td>{event.timestamp}</td>
            <td className={`event-${String(event.event ?? "")}`}>
              {String(event.eventDesc ?? "")}
            </td>
            <td>{String(event.info ?? "")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
