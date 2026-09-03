"use client";

import { useState } from "react";

// Port of the #sms_form AJAX submit in assets/js/newsletter.js — posts to
// /send-sms and shows the result inline rather than navigating.
export function SmsForm({ hash }: { hash?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/send-sms", { method: "POST", body: formData });
      const data = await response.json();
      setStatus(data.success ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="notice notice--success">SMS sendt.</p>;
  }

  return (
    <form id="sms_form" onSubmit={onSubmit}>
      <div className="form-field">
        <label className="form-field__label" htmlFor="phone">
          Få et link til appen på SMS
        </label>
        <input
          className="form-field__input"
          type="tel"
          id="phone"
          name="phone"
          pattern="^\d{8}$"
          required
        />
      </div>
      <input type="hidden" name="subscription" value={hash ?? ""} />
      <button className="button button--secondary" type="submit" disabled={status === "sending"}>
        Send SMS
      </button>
      {status === "error" && <p className="notice notice--error">Kunne ikke sende SMS. Prøv igen.</p>}
    </form>
  );
}
