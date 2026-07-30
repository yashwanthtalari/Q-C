'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '../../context/SocketContext';
import { 
  ArrowLeft, Users, Trophy, Award, CheckCircle2, XCircle, 
  Clock, Sparkles, Flame, Check, HelpCircle
} from 'lucide-react';

export default function PlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const nickname = searchParams.get('name');

  const { socket, isConnected } = useSocket();

  // Game state
  const [gameState, setGameState] = useState<'WAITING' | 'QUESTION' | 'SUBMITTED' | 'LEADERBOARD' | 'COMPLETED'>('WAITING');
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');

  // Answer selections
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  
  // Feedback metrics
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    scoreEarned: number;
    totalScore: number;
    currentStreak: number;
  } | null>(null);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRankInfo, setMyRankInfo] = useState<any | null>(null);
  const [participantId, setParticipantId] = useState('');

  // Connect and join session
  useEffect(() => {
    if (!code || !nickname) {
      setError('Missing access code or nickname');
      return;
    }

    if (!socket || !isConnected) return;

    // Join room
    socket.emit('join_session', { accessCode: code, name: nickname });

    // Listeners
    socket.on('room_joined', (data: any) => {
      setParticipantId(data.participantId);
      setTotalQuestions(data.totalQuestions);
      
      // Match active game screen if quiz has already started
      if (data.status === 'ACTIVE' && data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        setCurrentQuestionIdx(data.currentQuestionIndex);
        setGameState('QUESTION');
      } else if (data.status === 'LEADERBOARD') {
        setGameState('LEADERBOARD');
      } else if (data.status === 'COMPLETED') {
        setGameState('COMPLETED');
      } else {
        setGameState('WAITING');
      }
    });

    socket.on('join_error', (msg: string) => {
      setError(msg);
    });

    socket.on('lobby_participants', (players: any[]) => {
      setParticipants(players);
    });

    socket.on('question_active', (q: any) => {
      setCurrentQuestion(q);
      setCurrentQuestionIdx(q.currentQuestionIndex);
      setTimeLeft(q.timeLimit);
      setSelectedOptionIds([]);
      setTextAnswer('');
      setFeedback(null);
      setGameState('QUESTION');
    });

    socket.on('answers_locked', () => {
      // Disables submissions if teacher forces locks
      setGameState((prev) => (prev === 'QUESTION' ? 'SUBMITTED' : prev));
    });

    socket.on('question_skipped', () => {
      setGameState('SUBMITTED');
    });

    socket.on('submission_ack', (ackData: any) => {
      setFeedback(ackData);
      setGameState('SUBMITTED');
    });

    socket.on('leaderboard_update', ({ leaderboard }: { leaderboard: any[] }) => {
      setLeaderboard(leaderboard);
      const myInfo = leaderboard.find((p) => p.name === nickname);
      setMyRankInfo(myInfo);
      setGameState('LEADERBOARD');
    });

    socket.on('quiz_completed', ({ leaderboard }: { leaderboard: any[] }) => {
      setLeaderboard(leaderboard);
      const myInfo = leaderboard.find((p) => p.name === nickname);
      setMyRankInfo(myInfo);
      setGameState('COMPLETED');
    });

    socket.on('error_message', (msg: string) => {
      alert(msg);
    });

    return () => {
      socket.off('room_joined');
      socket.off('join_error');
      socket.off('lobby_participants');
      socket.off('question_active');
      socket.off('answers_locked');
      socket.off('question_skipped');
      socket.off('submission_ack');
      socket.off('leaderboard_update');
      socket.off('quiz_completed');
      socket.off('error_message');
    };
  }, [socket, isConnected, code, nickname]);

  // Sync client countdown timer with question limit
  useEffect(() => {
    if (gameState !== 'QUESTION' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto submit choices when timer expires if not already sent
          if (gameState === 'QUESTION') {
            handleSubmitAnswer();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleSelectOption = (optionId: string) => {
    if (gameState !== 'QUESTION' || !currentQuestion) return;

    if (currentQuestion.type === 'MCQ' || currentQuestion.type === 'TRUE_FALSE') {
      // Direct submit for single choice
      const options = [optionId];
      setSelectedOptionIds(options);
      
      if (socket) {
        socket.emit('submit_answer', {
          questionId: currentQuestion.questionId,
          chosenOptionIds: options
        });
      }
    } else {
      // Toggle checkmark for multi-select
      setSelectedOptionIds((prev) => {
        if (prev.includes(optionId)) {
          return prev.filter((id) => id !== optionId);
        }
        return [...prev, optionId];
      });
    }
  };

  const handleSubmitAnswer = () => {
    if (gameState !== 'QUESTION' || !currentQuestion || !socket) return;

    socket.emit('submit_answer', {
      questionId: currentQuestion.questionId,
      chosenOptionIds: selectedOptionIds,
      textAnswer: currentQuestion.type === 'FILL_IN' || currentQuestion.type === 'SHORT_ANSWER' ? textAnswer : undefined
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative">
        <div className="ambient-glow-1"></div>
        <div className="glass-panel p-8 rounded-3xl border border-red-500/25 text-center max-w-sm w-full shadow-2xl">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-white mb-2">Error Joining Session</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative flex flex-col justify-between">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* TOP HEADER */}
      <header className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-slate-400">Class PIN: </span>
          <span className="font-mono font-black text-sm text-indigo-400">{code}</span>
        </div>

        <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl text-xs font-bold text-white max-w-xs truncate">
          {nickname}
        </div>
      </header>

      {/* MAIN SCREEN BODY */}
      <div className="flex-grow flex flex-col justify-center items-center max-w-lg w-full mx-auto my-6 z-10">
        {/* ----------------------------------------------------
            STATE 1: STUDENT WAITING ROOM
            ---------------------------------------------------- */}
        {gameState === 'WAITING' && (
          <div className="w-full text-center flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2 border border-indigo-500/20">
              <Users className="w-8 h-8" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">You're in the Game!</h2>
            <p className="text-sm text-slate-400 max-w-xs">
              Waiting for your instructor to launch the quiz. Keep your eyes on the board!
            </p>

            <div className="w-full glass-panel p-5 rounded-2xl border border-white/5 mt-4">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Other Joined Players ({participants.length})</div>
              <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto">
                {participants.map((p) => (
                  <span 
                    key={p.id} 
                    className="text-xs bg-white/5 border border-white/5 text-slate-300 font-semibold px-3 py-1.5 rounded-full"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 2: PLAYING QUESTION WINDOW
            ---------------------------------------------------- */}
        {gameState === 'QUESTION' && currentQuestion && (
          <div className="w-full flex flex-col gap-6 animate-fade-in text-center">
            {/* Header progress info */}
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Question {currentQuestionIdx + 1} of {totalQuestions}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {timeLeft}s remaining</span>
            </div>

            {/* Question title */}
            <h2 className="text-xl md:text-2xl font-bold text-white px-2">
              {currentQuestion.text}
            </h2>

            {/* Answer choice layouts */}
            {(currentQuestion.type === 'MCQ' || currentQuestion.type === 'TRUE_FALSE' || currentQuestion.type === 'POLL' || currentQuestion.type === 'MULTI_SELECT') ? (
              <div className="flex flex-col gap-3 w-full mt-4">
                {currentQuestion.options.map((opt: any) => {
                  const isSelected = selectedOptionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full p-4.5 rounded-2xl font-bold text-sm text-left border flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
                        isSelected 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-indigo-500/20 text-white shadow-lg shadow-indigo-500/10' 
                          : 'glass-panel border-white/5 text-slate-300 hover:border-white/10'
                      }`}
                    >
                      <span>{opt.text}</span>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}

                {/* Submit button for multi-select */}
                {currentQuestion.type === 'MULTI_SELECT' && (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedOptionIds.length === 0}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer mt-4"
                  >
                    Submit Answer Selection
                  </button>
                )}
              </div>
            ) : (
              /* Text fill-in layout */
              <div className="flex flex-col gap-4 w-full mt-4">
                <input
                  type="text"
                  placeholder="Type your response here..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  className="w-full px-5 py-4 text-center rounded-2xl glass-input text-lg border border-white/10"
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!textAnswer.trim()}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Submit Response
                </button>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 3: SUBMITTED (WAITING TO FINISH SCREEN)
            ---------------------------------------------------- */}
        {gameState === 'SUBMITTED' && (
          <div className="w-full text-center flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2 animate-pulse border border-indigo-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-white">Answer Submitted!</h2>
            <p className="text-sm text-slate-400 max-w-xs">
              Waiting for other classmates to respond. Prepare for leaderboard updates.
            </p>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 4: INTERMEDIARY ROUND RESULT BREAKDOWN
            ---------------------------------------------------- */}
        {gameState === 'LEADERBOARD' && myRankInfo && (
          <div className="w-full flex flex-col gap-6 animate-fade-in text-center">
            {/* Answer Accuracy Feedback */}
            <div className="flex flex-col items-center gap-3">
              {feedback?.isCorrect ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center border border-green-500/20 shadow-lg shadow-green-500/5 animate-bounce">
                    <Check className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-400">Correct!</h3>
                  <div className="text-xs text-slate-400">+{feedback.scoreEarned} points</div>
                  {feedback.currentStreak > 1 && (
                    <div className="flex items-center gap-1 bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-xs font-black border border-orange-500/15">
                      <Flame className="w-3.5 h-3.5 fill-orange-400" /> On Fire! {feedback.currentStreak} Streak
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
                    <XCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-red-400">Incorrect!</h3>
                  <div className="text-xs text-slate-500">Streak reset. Focus on the next one!</div>
                </div>
              )}
            </div>

            {/* Student's Standing */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 w-full mt-4 flex justify-around">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Your Rank</span>
                <span className="text-3xl font-black text-white mt-1">#{myRankInfo.rank}</span>
              </div>
              <div className="h-10 w-px bg-white/5 align-self-center"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Score</span>
                <span className="text-3xl font-black text-indigo-400 mt-1 font-mono">{myRankInfo.score}</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 italic">Wait for the instructor to advance questions...</p>
          </div>
        )}

        {/* ----------------------------------------------------
            STATE 5: COMPLETED FINAL EVALUATION
            ---------------------------------------------------- */}
        {gameState === 'COMPLETED' && myRankInfo && (
          <div className="w-full text-center flex flex-col items-center gap-6 animate-fade-in">
            <Trophy className="w-14 h-14 text-yellow-500 animate-pulse" />
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Quiz Completed</span>
              <h2 className="text-3xl font-black text-white">Awesome Job!</h2>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 w-full mt-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 text-sm text-slate-400">
                <span>Final Rank</span>
                <span className="font-black text-white text-lg">#{myRankInfo.rank}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 text-sm text-slate-400">
                <span>Accuracy</span>
                <span className="font-bold text-white">{myRankInfo.accuracy}%</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>Total Score</span>
                <span className="font-black text-indigo-400 font-mono text-lg">{myRankInfo.score} pts</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl text-xs transition-all cursor-pointer mt-6"
            >
              Exit to Homepage
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="text-center text-slate-600 text-xs z-10 w-full mt-6 flex justify-between items-center border-t border-white/5 pt-4">
        <span>Nickname: <span className="text-white font-bold">{nickname}</span></span>
        <span>Game PIN: <span className="font-mono text-white font-bold">{code}</span></span>
      </footer>
    </div>
  );
}
