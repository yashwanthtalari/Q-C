'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowRight, BookOpen, Sparkles, Trophy, Users } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { initialize, isAuthenticated, user } = useAuthStore();
  const [accessCode, setAccessCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initialize();
    
    // Check if code is passed as a query parameter
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.length === 6 && !isNaN(Number(codeParam))) {
      setAccessCode(codeParam);
      setShowNameInput(true);
    }
  }, [initialize]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (accessCode.length !== 6 || isNaN(Number(accessCode))) {
      setError('Please enter a valid 6-digit room code');
      return;
    }
    
    // Switch to Name selection screen
    setShowNameInput(true);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!studentName.trim()) {
      setError('Please enter a nickname');
      return;
    }

    setLoading(true);
    // Route student directly to the play room
    router.push(`/play?code=${accessCode}&name=${encodeURIComponent(studentName.trim())}`);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between p-6 md:p-12 relative overflow-hidden dark">
      {/* Ambient background glows */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Header */}
      <header className="flex justify-between items-center w-full z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-white text-xl">Q</span>
          </div>
          <span className="font-extrabold text-2xl bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent tracking-tight">
            Q/C Quiz on Class
          </span>
        </div>

        <div>
          {isAuthenticated ? (
            <Link 
              href="/dashboard" 
              className="glass-panel text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10"
            >
              Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link 
              href="/auth/login" 
              className="glass-panel text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all border border-white/10"
            >
              Teacher Login
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-12 w-full max-w-6xl mx-auto my-12 z-10 flex-grow">
        {/* Left Column - Headline & Features */}
        <div className="flex-1 text-center lg:text-left flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold self-center lg:self-start">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Classroom Engagement
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Conduct Live Quizzes <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Compete Instantly.
            </span>
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto lg:mx-0">
            Transform your lectures, workshops, or training sessions into a thrilling game. Import questions instantly from text files and watch rankings shift live.
          </p>

          {/* Quick Stats/Features */}
          <div className="grid grid-cols-3 gap-4 mt-4 max-w-md mx-auto lg:mx-0">
            <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <Trophy className="w-6 h-6 text-purple-400 mb-2" />
              <div className="font-bold text-white text-sm">Real-time</div>
              <div className="text-xs text-slate-400">Leaderboard</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <Users className="w-6 h-6 text-indigo-400 mb-2" />
              <div className="font-bold text-white text-sm">Instant</div>
              <div className="text-xs text-slate-400">TXT Imports</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <BookOpen className="w-6 h-6 text-pink-400 mb-2" />
              <div className="font-bold text-white text-sm">Classroom</div>
              <div className="text-xs text-slate-400">Analytics</div>
            </div>
          </div>
        </div>

        {/* Right Column - Interaction Card */}
        <div className="w-full max-w-md">
          <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
            {/* Ambient card glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 filter blur-xl rounded-full"></div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Join a Live Session</h2>
              <p className="text-sm text-slate-400 mt-1">Enter your room pin code to join your classmates</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-xl mb-4 text-center">
                {error}
              </div>
            )}

            {!showNameInput ? (
              /* Step 1: Access Code Input */
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    6-Digit PIN Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-4 text-center text-2xl font-bold tracking-widest rounded-2xl glass-input border border-white/10"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Join Room <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            ) : (
              /* Step 2: Name Input */
              <form onSubmit={handleJoinGame} className="flex flex-col gap-4 animate-fade-in">
                <div>
                  <label htmlFor="nickname" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Enter Your Name
                  </label>
                  <input
                    type="text"
                    id="nickname"
                    maxLength={15}
                    placeholder="Your Nickname"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full py-4 text-center text-xl font-bold rounded-2xl glass-input border border-white/10"
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNameInput(false)}
                    className="flex-1 py-4 rounded-2xl glass-panel border border-white/10 text-slate-300 font-semibold hover:bg-white/5 active:scale-95 transition-all cursor-pointer text-center text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Entering...' : 'Enter Game'} <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-slate-500 text-xs z-10 w-full mt-6">
        &copy; {new Date().getFullYear()} Q/C Quiz on Class. All rights reserved. Created for premium classrooms.
      </footer>
    </main>
  );
}
