'use client';

import { useState } from 'react';

export function EmailCapture() {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!value) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: value })
      });
      
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Email capture error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submit();
    }
  };

  if (submitted) {
    return (
      <p className="text-white/70 text-sm">
        Thanks! You're on the list. 🎉
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Your email"
        className="bg-transparent border border-white/30 px-4 py-2 rounded focus:outline-none focus:border-white/60 transition-colors"
        disabled={loading}
      />
      <button
        onClick={submit}
        disabled={loading}
        className="border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join the tribe'}
      </button>
    </div>
  );
}




