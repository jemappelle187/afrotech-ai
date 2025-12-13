import Link from "next/link";
import { EmailCapture } from "@/components/EmailCapture";

export default function HomePage() {
  return (
    <main 
      className="min-h-screen flex flex-col items-center justify-center gap-8 text-center px-4"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 1rem' }}
    >
      <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 
          className="text-4xl md:text-6xl tracking-widest uppercase font-bold"
          style={{ fontSize: '2.25rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}
        >
          Afrotech.ai
        </h1>
        <p 
          className="text-lg md:text-xl text-white/70"
          style={{ fontSize: '1.125rem', color: 'rgba(255, 255, 255, 0.7)' }}
        >
          Where rhythm meets code.
        </p>
      </div>

      <div 
        className="flex flex-col sm:flex-row gap-4"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <Link
          className="border border-white/30 px-6 py-3 rounded hover:bg-white/10 transition-colors text-sm uppercase tracking-wider"
          href="/darkroom"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textDecoration: 'none',
            color: 'white',
            transition: 'background-color 0.15s'
          }}
        >
          Enter Dark Room
        </Link>
        <Link
          className="border border-white/30 px-6 py-3 rounded hover:bg-white/10 transition-colors text-sm uppercase tracking-wider"
          href="/beach"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textDecoration: 'none',
            color: 'white',
            transition: 'background-color 0.15s'
          }}
        >
          Beach Session <span className="text-xs opacity-60" style={{ fontSize: '0.75rem', opacity: 0.6 }}>(beta)</span>
        </Link>
      </div>

      <div className="mt-8" style={{ marginTop: '2rem' }}>
        <EmailCapture />
      </div>

      <footer 
        className="absolute bottom-6 text-xs text-white/40"
        style={{ position: 'absolute', bottom: '1.5rem', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)' }}
      >
        <p>Built with Next.js, Three.js & Spotify</p>
      </footer>
    </main>
  );
}



