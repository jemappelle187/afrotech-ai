// Optional PostHog analytics setup
// Uncomment and configure when ready

/*
import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  posthog.init('YOUR_POSTHOG_KEY', {
    api_host: 'https://app.posthog.com',
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') posthog.opt_out_capturing();
    }
  });
}

export { posthog };
*/

export const analytics = {
  track: (event: string, properties?: any) => {
    // Placeholder for analytics
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
    }
  }
};




