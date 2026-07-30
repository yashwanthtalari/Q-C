'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '../../context/SocketContext';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  ArrowLeft, Users, Play, SkipForward, AlertCircle, Trophy, 
  Unlock, Lock, RefreshCw, BarChart3, CheckCircle, Flame
} from 'lucide-react';

export default function HostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('quizId');

  const { socket, isConnected } = useSocket();
  const { initialize, token, isAuthenticated } = useAuthStore();

  const [accessCode, setAccessCode] = useState('');
  const [gameState, setGameState] = useState<'LOBBY' | 'QUESTION' | 'LEADERBOARD' | 'COMPLETED'>('LOBBY');
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auth check
  useEffect(() => {
    const checkAuth = setTimeout(() => {
      if (!isAuthenticated) router.push('/auth/login');
    }, 500);
    return () => clearTimeout(checkAuth);
  }, [isAuthenticated, router]);

  // Handle Socket.IO communication
  useEffect(() => {
    if (!socket || !isConnected || !quizId) return;

    // 1. Host the quiz session
    socket.emit('host_session', { quizId });

    // 2. Event Listeners
    socket.on('session_created', ({ accessCode, sessionId }: { accessCode: string; sessionId: string }) => {
      setAccessCode(accessCode);
      setGameState('LOBBY');
    });

    socket.on('lobby_participants', (playerList: any[]) => {
      setParticipants(playerList);
    });

    socket.on('student_joined', (student: any) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.id === student.id);
        if (exists) {
          return prev.map((p) => (p.id === student.id ? student : p));
        }
        return [...prev, student];
      });
    });

    socket.on('student_disconnected', ({ id }: { id: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isConnected: false } : p))
      );
    });

    socket.on('question_active', (questionData: any) => {
      setCurrentQuestion(questionData);
      setTimeLeft(questionData.timeLimit);
      setSubmissions([]);
      setIsLocked(false);
      setGameState('QUESTION');
    });

    socket.on('student_submitted', (sub: any) => {
      setSubmissions((prev) => [...prev, sub]);
    });

    socket.on('answers_locked', () => {
      setIsLocked(true);
    });

    socket.on('leaderboard_update', ({ leaderboard }: { leaderboard: any[] }) => {
      setLeaderboard(leaderboard);
      setGameState('LEADERBOARD');
    });

    socket.on('quiz_completed', ({ leaderboard }: { leaderboard: any[] }) => {
      setLeaderboard(leaderboard);
      setGameState('COMPLETED');
    });

    socket.on('error_message', (msg: string) => {
      setError(msg);
    });

    return () => {
      socket.off('session_created');
      socket.off('lobby_participants');
      socket.off('student_joined');
      socket.off('student_disconnected');
      socket.off('question_active');
      socket.off('student_submitted');
      socket.off('answers_locked');
      socket.off('leaderboard_update');
      socket.off('quiz_completed');
      socket.off('error_message');
    };
  }, [socket, isConnected, quizId]);

  // Question countdown timer handler
  useEffect(() => {
    if (gameState !== 'QUESTION' || timeLeft <= 0 || isLocked) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // auto lock answers when timer expires
          handleLockAnswers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft, isLocked]);

  // Actions
  const handleStartQuiz = () => {
    if (!socket || !accessCode) return;
    socket.emit('start_quiz', { accessCode });
  };

  const handleNextQuestion = () => {
    if (!socket || !accessCode) return;
    socket.emit('next_question', { accessCode });
  };

  const handleLockAnswers = () => {
    if (!socket || !accessCode) return;
    socket.emit('lock_answers', { accessCode });
  };

  const handleShowLeaderboard = () => {
    if (!socket || !accessCode) return;
    socket.emit('show_leaderboard', { accessCode });
  };

  const handleSkipQuestion = () => {
    if (!socket || !accessCode) return;
    socket.emit('skip_question', { accessCode });
    handleLockAnswers();
  };

  const handleEndQuiz = () => {
    if (!confirm('Are you sure you want to end the quiz session now?')) return;
    if (!socket || !accessCode) return;
    socket.emit('end_quiz', { accessCode });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative flex flex-col justify-between">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* TOP HEADER */}
      <header className="flex justify-between items-center z-10">
        <button
          onClick={() => {
            if (gameState === 'LOBBY' || confirm('Exit hosting session? Progress will be saved.')) {
              router.push('/dashboard');
            }
          }}
          className="glass-panel text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Lobby
        </button>

        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-400 font-semibold">{isConnected ? 'Server Connected' : 'Server Reconnecting...'}</span>
        </div>
      </header>

      {/* MAIN SCREEN BODY */}
      <div className="flex-grow flex flex-col justify-center items-center max-w-4xl w-full mx-auto my-6 z-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl flex items-center gap-3 mb-6 w-full max-w-md">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 1: LOBBY (WAITING ROOM)
            ---------------------------------------------------- */}
        {gameState === 'LOBBY' && (
          <div className="w-full flex flex-col items-center gap-8 animate-fade-in text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-semibold text-indigo-400 uppercase tracking-widest">Student Access Code</span>
              <div className="text-6xl md:text-8xl font-black tracking-widest text-white font-mono bg-white/5 px-10 py-6 rounded-3xl border border-white/10 shadow-2xl relative select-all select-none">
                {accessCode ? `${accessCode.substring(0, 3)} ${accessCode.substring(3)}` : '000 000'}
                {/* Glowing border outline */}
                <div className="absolute inset-0 rounded-3xl border border-indigo-500/20 pointer-events-none animate-pulse"></div>
              </div>
              <p className="text-slate-400 text-sm mt-3">Go to home page and enter PIN code to join</p>
            </div>

            {/* Waiting roster */}
            <div className="w-full max-w-2xl glass-panel p-6 rounded-3xl border border-white/5">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                <span className="font-bold text-white text-md flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Joined Students ({participants.length})
                </span>
                {participants.length > 0 && (
                  <button
                    onClick={handleStartQuiz}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/25 px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" /> Start Quiz Game
                  </button>
                )}
              </div>

              {participants.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-600 mb-4"></div>
                  Waiting for players to join the lobby...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
                  {participants.map((p) => (
                    <div 
                      key={p.id} 
                      className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all text-center truncate ${
                        p.isConnected 
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-white' 
                          : 'bg-slate-900 border-white/5 text-slate-600'
                      }`}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 2: ACTIVE QUESTION SCREEN
            ---------------------------------------------------- */}
        {gameState === 'QUESTION' && currentQuestion && (
          <div className="w-full flex flex-col gap-6 animate-fade-in text-center">
            {/* Timer and score details */}
            <div className="flex justify-between items-center">
              <span className="text-xs bg-slate-800 border border-white/5 px-3 py-1.5 rounded-full font-semibold">
                Question {currentQuestion.order + 1} of {currentQuestion.totalQuestions}
              </span>
              <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 px-3 py-1.5 rounded-full font-semibold">
                Worth {currentQuestion.points} pts
              </span>
            </div>

            {/* Question Text Prompt */}
            <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-snug px-4">
              {currentQuestion.text}
            </h2>

            {/* Dynamic visual timer bar */}
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2">
              <div className="text-3xl font-black font-mono text-white tracking-wider">
                {timeLeft}s
              </div>
              <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / currentQuestion.timeLimit) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Answer Options grid (stripped of correct checkmarks) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full mx-auto mt-4">
              {currentQuestion.options.map((opt: any, idx: number) => (
                <div 
                  key={opt.id} 
                  className="glass-panel p-5 rounded-2xl border border-white/5 font-semibold text-slate-300 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt.text}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Control Console for Teacher */}
            <div className="flex flex-wrap gap-3 justify-center mt-8 pt-6 border-t border-white/5 w-full">
              <button
                onClick={handleLockAnswers}
                disabled={isLocked}
                className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/25 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" /> Lock Answers
              </button>
              <button
                onClick={handleSkipQuestion}
                disabled={isLocked}
                className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all bg-slate-800 text-slate-300 hover:text-white border border-white/5"
              >
                <SkipForward className="w-4 h-4" /> Skip Timer
              </button>
              <button
                onClick={handleShowLeaderboard}
                disabled={!isLocked && timeLeft > 0}
                className="px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <Trophy className="w-4 h-4" /> Show Leaderboard
              </button>
            </div>

            {/* Submission statistics banner */}
            <div className="text-xs text-slate-500 mt-4">
              Submitted answers: <span className="text-white font-bold">{submissions.length}</span> out of <span className="text-indigo-400 font-bold">{participants.length}</span> students
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 3: INTERMEDIARY LEADERBOARD RANKINGS
            ---------------------------------------------------- */}
        {gameState === 'LEADERBOARD' && (
          <div className="w-full flex flex-col gap-6 animate-fade-in text-center">
            <div>
              <span className="text-xs bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/15 font-semibold">
                Round Results
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">Leaderboard Standings</h2>
            </div>

            {/* Rankings lists */}
            <div className="w-full max-w-xl mx-auto flex flex-col gap-2.5">
              {leaderboard.slice(0, 5).map((p, idx) => (
                <div 
                  key={p.id} 
                  className={`flex justify-between items-center p-4 bg-white/5 rounded-2xl border transition-all ${
                    idx === 0 ? 'border-yellow-500/35 bg-yellow-500/5' :
                    idx === 1 ? 'border-slate-300/30 bg-slate-300/5' :
                    idx === 2 ? 'border-amber-600/30 bg-amber-600/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-slate-950' :
                      idx === 1 ? 'bg-slate-300 text-slate-950' :
                      idx === 2 ? 'bg-amber-600 text-slate-100' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white text-md">{p.name}</span>
                    {p.streak > 1 && (
                      <span className="flex items-center gap-0.5 text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full font-bold">
                        <Flame className="w-3.5 h-3.5 fill-orange-400" /> {p.streak} streak
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">{p.correctAnswers} correct</span>
                    <span className="font-extrabold text-indigo-400 font-mono text-md">{p.score} pts</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-center mt-8">
              <button
                onClick={handleNextQuestion}
                className="px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <SkipForward className="w-4 h-4" /> Next Question
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 4: FINAL QUIZ COMPLETION (PODIUM HIGHLIGHT)
            ---------------------------------------------------- */}
        {gameState === 'COMPLETED' && (
          <div className="w-full flex flex-col gap-6 animate-fade-in text-center">
            <Trophy className="w-16 h-16 text-yellow-500 animate-bounce mx-auto" />
            <div>
              <span className="text-xs bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/15 font-semibold">
                Quiz Over
              </span>
              <h2 className="text-4xl font-extrabold bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent tracking-tight mt-2">
                Final Podium Results
              </h2>
            </div>

            {/* Podium layout using custom visual cards */}
            <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-2xl w-full mx-auto mt-8 px-4">
              {/* 2nd place */}
              {leaderboard[1] && (
                <div className="w-full md:w-1/3 glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-2 h-48 justify-end relative order-2 md:order-1">
                  <span className="absolute top-4 w-9 h-9 rounded-full bg-slate-300 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-white/5 border border-white/10">2</span>
                  <div className="font-extrabold text-white text-lg truncate w-full">{leaderboard[1].name}</div>
                  <div className="font-bold text-indigo-400 text-sm font-mono">{leaderboard[1].score} pts</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{leaderboard[1].accuracy}% accuracy</div>
                </div>
              )}

              {/* 1st place */}
              {leaderboard[0] && (
                <div className="w-full md:w-1/3 bg-gradient-to-t from-indigo-500/10 to-purple-500/10 p-6 rounded-3xl border border-yellow-500/30 flex flex-col items-center gap-2 h-56 justify-end relative order-1 md:order-2 shadow-2xl shadow-indigo-500/10">
                  <div className="absolute top-4 w-12 h-12 rounded-full bg-yellow-500 text-slate-950 font-black flex items-center justify-center text-lg shadow-lg shadow-yellow-500/25 border-2 border-yellow-400 animate-pulse">1</div>
                  <div className="font-extrabold text-white text-xl truncate w-full">{leaderboard[0].name}</div>
                  <div className="font-extrabold text-indigo-400 text-md font-mono">{leaderboard[0].score} pts</div>
                  <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" /> Max Streak: {leaderboard[0].highestStreak}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">{leaderboard[0].accuracy}% accuracy</div>
                </div>
              )}

              {/* 3rd place */}
              {leaderboard[2] && (
                <div className="w-full md:w-1/3 glass-panel p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-2 h-40 justify-end relative order-3">
                  <span className="absolute top-4 w-9 h-9 rounded-full bg-amber-600 text-slate-100 font-bold flex items-center justify-center shadow-lg shadow-white/5 border border-white/10">3</span>
                  <div className="font-extrabold text-white text-lg truncate w-full">{leaderboard[2].name}</div>
                  <div className="font-bold text-indigo-400 text-sm font-mono">{leaderboard[2].score} pts</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{leaderboard[2].accuracy}% accuracy</div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-center mt-10">
              <button
                onClick={handleEndQuiz}
                className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-95 cursor-pointer"
              >
                Close Session & Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="text-center text-slate-600 text-xs z-10 w-full mt-6 flex justify-between items-center border-t border-white/5 pt-4">
        <span>Session Code: <span className="font-mono text-white font-bold">{accessCode}</span></span>
        <span>Participants inside: <span className="text-white font-bold">{participants.length}</span></span>
      </footer>
    </div>
  );
}
