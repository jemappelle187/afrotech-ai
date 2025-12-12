'use client';

export default function DarkroomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 24,
        background: '#000',
        color: '#fff',
        minHeight: '100vh',
      }}
    >
      <h2>Darkroom crashed</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.8 }}>
        {error?.message}
      </pre>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: '8px 16px',
          cursor: 'pointer',
          background: '#333',
          color: '#fff',
          border: '1px solid #666',
          borderRadius: 4,
        }}
      >
        Reload Darkroom
      </button>
    </div>
  );
}




