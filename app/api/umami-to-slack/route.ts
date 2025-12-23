import { NextRequest, NextResponse } from "next/server";

type UmamiEventPayload = {
  title?: string;
  url?: string;
  hostname?: string;
  language?: string;
  referrer?: string | null;
  screen?: string;
  visitorType?: "first-time" | "returning" | string;
};

function getClientIp(req: NextRequest): string | null {
  const localhostCandidates = new Set(["127.0.0.1", "::1"]);
  const isDevelopment = process.env.NODE_ENV === "development";

  // 1) Try X-Forwarded-For (may contain multiple IPs)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ips = xff
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);

    // Prefer the first non-localhost IP (unless in dev with test IP)
    const realIp = ips.find((ip) => !localhostCandidates.has(ip)) || ips[0];

    if (realIp) {
      // In development, allow test IPs (like 8.8.8.8 for testing)
      // In production, filter out localhost
      if (isDevelopment || !localhostCandidates.has(realIp)) {
        return realIp;
      }
    }
  }

  // 2) Try X-Real-IP
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) {
    const ip = xRealIp.trim();
    if (isDevelopment || !localhostCandidates.has(ip)) {
      return ip;
    }
  }

  // 3) Try CF-Connecting-IP (Cloudflare / some CDNs)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    const ip = cfIp.trim();
    if (isDevelopment || !localhostCandidates.has(ip)) {
      return ip;
    }
  }

  // 4) In development, check for test IP header
  if (isDevelopment) {
    const testIp = req.headers.get("x-test-ip");
    if (testIp) {
      return testIp.trim();
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UmamiEventPayload;
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

    console.log("[UMAMI-TO-SLACK] Received request:", {
      title: body.title,
      url: body.url,
      hasWebhookUrl: !!slackWebhookUrl,
    });

    if (!slackWebhookUrl) {
      console.warn(
        "[UMAMI-TO-SLACK] SLACK_WEBHOOK_URL not set, skipping Slack push."
      );
      return NextResponse.json({ ok: true, skipped: true });
    }

    const clientIp = getClientIp(req);

    // Geo enrichment via ipapi.co
    let geoCity = "";
    let geoRegion = "";
    let geoCountry = "";
    let geoOrg = "";
    let geoLat = "";
    let geoLon = "";

    // Spam detection via CleanTalk (optional)
    let spamStatus = "";
    let spamFrequency = "";
    let spamLastUpdated = "";
    let isSpamDetected = false;

    if (clientIp) {
      // Geo-location lookup (ipapi.co)
      try {
        const geoRes = await fetch(`https://ipapi.co/${clientIp}/json/`, {
          cache: "no-store",
          headers: {
            "User-Agent": "AfrotechAI-Webhook/1.0",
          },
        });

        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          if (!geoData.error) {
            geoCity = geoData.city || "";
            geoRegion = geoData.region || "";
            geoCountry = geoData.country_name || geoData.country || "";
            geoOrg = geoData.org || "";
            if (geoData.latitude && geoData.longitude) {
              geoLat = String(geoData.latitude);
              geoLon = String(geoData.longitude);
            }
          }
        }
      } catch (e) {
        console.error("Geo lookup error:", e);
      }

      // Spam detection lookup (CleanTalk - optional)
      const cleanTalkApiKey = process.env.CLEANTALK_API_KEY;
      if (cleanTalkApiKey && clientIp) {
        try {
          // CleanTalk API: Use 'ip' parameter for GET request (single IP check)
          const spamCheckUrl = new URL("https://api.cleantalk.org/");
          spamCheckUrl.searchParams.set("method_name", "spam_check");
          spamCheckUrl.searchParams.set("auth_key", cleanTalkApiKey);
          spamCheckUrl.searchParams.set("ip", clientIp);

          const spamRes = await fetch(spamCheckUrl.toString(), {
            method: "GET",
            cache: "no-store",
            headers: {
              "User-Agent": "AfrotechAI-Webhook/1.0",
            },
          });

          if (spamRes.ok) {
            const spamData: any = await spamRes.json();
            console.log("[UMAMI-TO-SLACK] CleanTalk API response:", {
              hasData: !!spamData?.data,
              ipInData: !!spamData?.data?.[clientIp],
              responseKeys: spamData ? Object.keys(spamData) : [],
            });

            if (spamData?.data?.[clientIp]) {
              const ipData = spamData.data[clientIp];
              isSpamDetected = ipData.appears === 1;
              spamStatus = isSpamDetected
                ? "⚠️ Detected in spam database"
                : "✅ Not in spam database";
              spamFrequency = ipData.frequency || "";
              spamLastUpdated = ipData.updated || "";
            } else {
              // IP not found in response - likely clean, but API didn't return it
              spamStatus = "✅ Not in spam database";
              console.log(
                "[UMAMI-TO-SLACK] IP not in CleanTalk response, assuming clean"
              );
            }
          } else {
            const errorText = await spamRes.text();
            console.error(
              "[UMAMI-TO-SLACK] CleanTalk API error:",
              spamRes.status,
              errorText
            );
            spamStatus = "❓ Unable to check (API error)";
          }
        } catch (e) {
          console.error("[UMAMI-TO-SLACK] Spam check error:", e);
          spamStatus = "❓ Unable to check (request failed)";
        }
      }
    }

    const coordinatesText =
      geoLat && geoLon
        ? `<https://www.google.com/maps?q=${geoLat},${geoLon}|${geoLat}, ${geoLon}>`
        : "-";

    // Format Slack message (using Slack Block Kit for rich formatting)
    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*🌍 Location & Network*` +
            `\n• Country: ${geoCountry || "-"}` +
            `\n• Region: ${geoRegion || "-"}` +
            `\n• City: ${geoCity || "-"}` +
            `\n• Coordinates: ${coordinatesText}` +
            `\n• Network: ${geoOrg || "-"}` +
            `\n• IP: ${clientIp || "-"}`,
        },
      },
    ];

    // Add spam detection section if CleanTalk API key is configured
    const cleanTalkApiKey = process.env.CLEANTALK_API_KEY;
    if (cleanTalkApiKey && clientIp) {
      // Ensure we always have a status to display
      const displayStatus = spamStatus || "⏳ Checking...";
      const spamSection = {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*🛡️ Spam Detection*` +
            `\n• Status: ${displayStatus}` +
            (spamFrequency ? `\n• Reports: ${spamFrequency} websites` : "") +
            (spamLastUpdated ? `\n• Last Updated: ${spamLastUpdated}` : ""),
        },
      };
      blocks.push(spamSection);
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*📊 Visit Details*` +
          `\n• Page: ${body.title || "-"}` +
          `\n• URL: ${body.url || "-"}` +
          `\n• Hostname: ${body.hostname || "-"}` +
          `\n• Language: ${body.language || "-"}` +
          `\n• Screen: ${body.screen || "-"}` +
          `\n• Visitor Type: ${body.visitorType || "-"}` +
          (body.referrer ? `\n• Referrer: ${body.referrer}` : ""),
      },
    });

    const payload = {
      text: "New visitor on your site",
      blocks,
    };

    const slackResponse = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error(
        "[UMAMI-TO-SLACK] Slack API error:",
        slackResponse.status,
        errorText
      );
    } else {
      console.log("[UMAMI-TO-SLACK] Successfully sent message to Slack");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
