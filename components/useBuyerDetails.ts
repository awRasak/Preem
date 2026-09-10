"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Prefills buyer details when the checkout modal opens: verified session
// email (locked -- re-asking for the receipt address is pointless and
// breaks the session-skip), plus name/phone from the fan's most recent
// purchase. Guests get empty fields as before.
export function useBuyerDetails() {
  const [fanName, setFanName] = useState("");
  const [fanPhone, setFanPhone] = useState("");
  const [fanEmail, setFanEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);

  async function prefill() {
    setEmailLocked(false);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setFanEmail(user.email);
        setEmailLocked(true);
      } else {
        setFanEmail("");
      }
      const res = await fetch("/api/fan/last-details");
      if (res.ok) {
        const body = (await res.json()) as {
          fanName?: string;
          fanPhone?: string;
        };
        setFanName(body.fanName ?? "");
        setFanPhone(body.fanPhone ?? "");
      } else {
        setFanName("");
        setFanPhone("");
      }
    } catch {
      // Prefill is best-effort -- the form stays usable empty.
    }
  }

  return {
    fanName,
    fanPhone,
    fanEmail,
    emailLocked,
    setFanName,
    setFanPhone,
    setFanEmail,
    prefill,
  };
}
