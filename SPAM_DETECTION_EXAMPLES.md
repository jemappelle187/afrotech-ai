# Spam Detection Examples

This document shows what CleanTalk spam detection looks like in your Slack notifications.

## How It Works

When `CLEANTALK_API_KEY` is configured, the system will:

1. Check each visitor's IP address against CleanTalk's spam database
2. Add a **🛡️ Spam Detection** section to your Slack notifications
3. Display whether the IP is flagged and how many websites have reported it

## Example Slack Notifications

### Case 1: Clean IP (Not in Spam Database)

```
🌍 Location & Network
• Country: Netherlands
• Region: South Holland
• City: The Hague
• Coordinates: 52.0738, 4.3226
• Network: Vodafone Libertel B.V.
• IP: 83.85.232.2

🛡️ Spam Detection
• Status: ✅ Not in spam database

📊 Visit Details
• Page: Afrotech.ai - Where rhythm meets code
• URL: https://www.afrotech.ai/
• Visitor Type: returning
```

### Case 2: Spam IP Detected

```
🌍 Location & Network
• Country: Unknown
• Region: -
• City: -
• Coordinates: -
• Network: Unknown
• IP: 192.0.2.100

🛡️ Spam Detection
• Status: ⚠️ Detected in spam database
• Reports: 245 websites
• Last Updated: 2024-12-15 14:30:00

📊 Visit Details
• Page: Afrotech.ai - Where rhythm meets code
• URL: https://www.afrotech.ai/
• Visitor Type: first-time
```

## What the Data Means

### Status Values

- **✅ Not in spam database**: IP address is clean, no spam reports
- **⚠️ Detected in spam database**: IP has been reported for spam activity

### Reports Count

- Number of websites that have reported this IP for spam
- Higher numbers = more widespread spam activity
- Useful indicator of how serious the threat is

### Last Updated

- When the spam database entry was last updated
- Helps you understand if this is recent or historical spam activity

## CleanTalk API Response Format

The CleanTalk API returns data like this:

```json
{
  "data": {
    "83.85.232.2": {
      "appears": 0
    }
  }
}
```

For spam IPs:

```json
{
  "data": {
    "192.0.2.100": {
      "appears": 1,
      "frequency": "245",
      "updated": "2024-12-15 14:30:00"
    }
  }
}
```

## Setup

1. **Get a free CleanTalk API key:**

   - Visit: https://cleantalk.org/register
   - Free tier: 10,000 requests/month
   - No credit card required

2. **Add to environment variables:**

   ```bash
   CLEANTALK_API_KEY=your_api_key_here
   ```

3. **Deploy:**
   - The spam detection section will automatically appear in Slack notifications
   - If the API key is not set, the section won't appear (feature is optional)

## When to Use

**Useful for:**

- Identifying potentially malicious visitors
- Understanding if traffic spikes are from spam/bots
- Security monitoring and threat detection
- Filtering suspicious registrations or form submissions

**Not necessary if:**

- You only want geo-location data
- You have other spam/bot detection in place
- You want to keep the setup simple

## Comparison: With vs Without CleanTalk

### Without CleanTalk (current setup)

- ✅ Detailed geo-location (city, region, coordinates)
- ✅ Network/ISP information
- ❌ No threat/spam indicators

### With CleanTalk (optional add-on)

- ✅ All of the above
- ✅ Spam/threat detection
- ✅ Number of spam reports
- ✅ Last update timestamp

## Free Tier Limits

- **CleanTalk Free Tier**: 10,000 requests/month
- **ipapi.co Free Tier**: 1,000 requests/day (30,000/month)

For most websites, the free tier should be sufficient. If you exceed limits, you'll get API errors logged in your server console, but the geo-location will still work.
