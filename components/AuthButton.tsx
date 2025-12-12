'use client';

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session } = useSession();
  
  return session ? (
    <button 
      onClick={() => signOut()} 
      className="border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors"
    >
      Disconnect Spotify
    </button>
  ) : (
    <button 
      onClick={() => signIn('spotify')} 
      className="border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors"
    >
      Connect Spotify
    </button>
  );
}




