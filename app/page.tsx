import Link from "next/link";
import { EmailCapture } from "@/components/EmailCapture";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 text-center px-4">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl tracking-widest uppercase font-bold">
          Afrotech.ai
        </h1>
        <p className="text-lg md:text-xl text-white/70">
          Where rhythm meets code.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          className="border border-white/30 px-6 py-3 rounded hover:bg-white/10 transition-colors text-sm uppercase tracking-wider"
          href="/darkroom"
        >
          Enter Dark Room
        </Link>
        <Link
          className="border border-white/30 px-6 py-3 rounded hover:bg-white/10 transition-colors text-sm uppercase tracking-wider"
          href="/beach"
        >
          Beach Session <span className="text-xs opacity-60">(beta)</span>
        </Link>
      </div>

      <div className="mt-8">
        <EmailCapture />
      </div>

      <footer className="absolute bottom-6 text-xs text-white/40">
        <p>Built with Next.js, Three.js & Spotify</p>
      </footer>
    </main>
  );
}



