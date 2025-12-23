"use client";

import Script from "next/script";

export function VisitTracker() {
  return (
    <Script
      id="visit-tracker-slack"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  if (typeof window === "undefined" || !window.fetch) return;

  try {
    var visitorType = "first-time";
    try {
      var key = "fw_visit_seen";
      var stored = window.localStorage.getItem(key);
      if (stored === "1") {
        visitorType = "returning";
      } else {
        window.localStorage.setItem(key, "1");
      }
    } catch (e) {
      // localStorage may be disabled; ignore
    }

    var payload = {
      title: document.title || null,
      url: window.location.href,
      hostname: window.location.hostname,
      language: navigator.language || null,
      referrer: document.referrer || null,
      screen: window.innerWidth + "x" + window.innerHeight,
      visitorType: visitorType
    };

    console.log("[VISIT_TRACKER] Sending visit data:", payload);

    fetch("/api/umami-to-slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    })
      .then(function (response) {
        console.log("[VISIT_TRACKER] Response status:", response.status);
        return response.json();
      })
      .then(function (data) {
        console.log("[VISIT_TRACKER] Response data:", data);
      })
      .catch(function (error) {
        console.error("[VISIT_TRACKER] Fetch error:", error);
      });

  } catch (e) {
    console.error("[VISIT_TRACKER] client error", e);
  }
})();
        `,
      }}
    />
  );
}
