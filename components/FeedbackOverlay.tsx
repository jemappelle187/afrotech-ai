"use client";

import { useState } from "react";
import { sendReward } from "@/lib/learner";

const BUTTON_STYLE =
  "rounded-lg bg-white/10 text-white/85 hover:bg-white/20 transition-colors px-3 py-2 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.35)]";

export default function FeedbackOverlay() {
  const [cooldown, setCooldown] = useState(false);

  function handleTap(type: "like" | "dislike" | "applause") {
    if ((type === "like" || type === "dislike") && cooldown) return;
    sendReward(type);
    if (type !== "applause") {
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), 3000);
    }
  }

  return (
    <div className="pointer-events-auto absolute bottom-5 right-5 z-50 flex gap-2">
      <button
        type="button"
        onClick={() => handleTap("like")}
        className={BUTTON_STYLE}
        aria-label="Love this transition"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => handleTap("dislike")}
        className={BUTTON_STYLE}
        aria-label="Not feeling it"
      >
        👎
      </button>
      <button
        type="button"
        onClick={() => handleTap("applause")}
        className={BUTTON_STYLE}
        aria-label="Applause"
      >
        👏
      </button>
    </div>
  );
}




