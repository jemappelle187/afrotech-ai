'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2>Something went wrong</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}




