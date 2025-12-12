'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24 }}>
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
        Reload
      </button>
    </div>
  );
}




