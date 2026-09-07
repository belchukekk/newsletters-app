import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getUserSubscriptionsAdmin } from "@/lib/domains/subscriptions";
import { getCustomerByEmail } from "@/lib/domains/customer";
import { AdminUserToggleList } from "./AdminUserToggleList";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Admin lookup: type an email, see and edit that person's newsletter
// subscriptions. Not a port — the old app's admin dashboard only ever showed
// the admin's own state; this is a new capability for support use.
export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const searchParams = await props.searchParams;
  const email = firstParam(searchParams.email)?.trim();

  return (
    <main className="page">
      <h1>Slå nyhedsbrevsabonnement op</h1>
      <p className="page-intro">
        Find en bruger på e-mail for at se og ændre, hvilke nyhedsbreve vedkommende er tilmeldt.
      </p>

      <form className="form-field--inline-search" action="/admin/users" method="get">
        <div className="form-field">
          <label className="form-field__label" htmlFor="user-email">
            E-mail
          </label>
          <input
            className="form-field__input"
            id="user-email"
            type="email"
            name="email"
            defaultValue={email}
            placeholder="navn@eksempel.dk"
            required
          />
        </div>
        <button className="button" type="submit">
          Slå op
        </button>
      </form>

      {email && <UserSubscriptions email={email} />}
    </main>
  );
}

async function UserSubscriptions({ email }: { email: string }) {
  const [newsletters, subscriptionRows, customer] = await Promise.all([
    getAdminNewsletters(),
    getUserSubscriptionsAdmin(email),
    getCustomerByEmail(email),
  ]);

  const rowById = new Map(subscriptionRows.map((row) => [row.id, row]));
  const initialRows = Object.fromEntries(
    newsletters.map((newsletter) => {
      const row = rowById.get(newsletter.id);
      return [
        newsletter.id,
        {
          subscribed: row?.status === 1,
          source: row?.source ?? "",
          cacheEvent: row?.cacheEvent ?? null,
        },
      ];
    })
  );

  const fullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ");

  return (
    <div className="section">
      <h2>{fullName || email}</h2>
      {fullName ? (
        <p className="page-intro">
          {email}
          {customer?.email && customer.email !== email ? ` · primær e-mail: ${customer.email}` : ""}
        </p>
      ) : (
        <p className="notice notice--info">
          Ingen kundeprofil fundet i Infosoft for denne e-mail — viser kun nyhedsbrevsdata.
        </p>
      )}
      <AdminUserToggleList email={email} newsletters={newsletters} initialRows={initialRows} />
    </div>
  );
}
