'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../../../store/useAuthStore';
import { 
  ArrowLeft, FileText, CheckCircle2, AlertTriangle, Play, Save, 
  Trash2, Plus, RefreshCw, UploadCloud, Edit3, HelpCircle
} from 'lucide-react';

interface ParsedOption {
  text: string;
  isCorrect: boolean;
}

interface ParsedQuestion {
  text: string;
  type: string; // MCQ, MULTI_SELECT, TRUE_FALSE, POLL, SHORT_ANSWER
  options: ParsedOption[];
  timeLimit: number;
  points: number;
}

export default function CreateQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editQuizId = searchParams.get('edit');

  const { initialize, token, isAuthenticated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz Metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);

  // Parser text input & results
  const [rawText, setRawText] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false); // Mode: paste editor or preview editor
  
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auth redirect
  useEffect(() => {
    if (token) {
      fetchClasses();
      if (editQuizId) {
        loadExistingQuiz(editQuizId);
      }
    } else {
      // Allow auth initialize to run
      const checkAuth = setTimeout(() => {
        if (!isAuthenticated) router.push('/auth/login');
      }, 500);
      return () => clearTimeout(checkAuth);
    }
  }, [token, isAuthenticated, editQuizId]);

  const fetchClasses = async () => {
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiHost}/api/quizzes/classes/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (e) {}
  };

  const loadExistingQuiz = async (quizId: string) => {
    setLoading(true);
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiHost}/api/quizzes/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Quiz not found');
      
      const quiz = await res.json();
      setTitle(quiz.title);
      setDescription(quiz.description || '');
      setClassId(quiz.classId || '');

      // Load questions into state previewer
      const loadedQuestions = quiz.questions.map((q: any) => ({
        text: q.text,
        type: q.type,
        timeLimit: q.timeLimit,
        points: q.points,
        options: q.options.map((o: any) => ({ text: o.text, isCorrect: o.isCorrect }))
      }));
      setQuestions(loadedQuestions);
      setIsEditing(true); // Direct to preview editor
    } catch (err: any) {
      alert(err.message);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Trigger parser API on text
  const handleParseText = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setLoading(true);
    setErrors([]);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiHost}/api/quizzes/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToParse })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to parse text');

      setQuestions(data.questions);
      setErrors(data.errors);
      setIsEditing(true); // Open the preview editor
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      handleParseText(content);
    };
    reader.readAsText(file);
  };

  // Preview Editor Handlers
  const updateQuestionText = (qIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].text = text;
    setQuestions(updated);
  };

  const updateQuestionType = (qIdx: number, type: string) => {
    const updated = [...questions];
    updated[qIdx].type = type;
    
    // Auto align correctness flags if True/False is chosen
    if (type === 'TRUE_FALSE') {
      updated[qIdx].options = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false }
      ];
    }
    
    setQuestions(updated);
  };

  const updateQuestionTime = (qIdx: number, sec: number) => {
    const updated = [...questions];
    updated[qIdx].timeLimit = sec;
    setQuestions(updated);
  };

  const updateQuestionPoints = (qIdx: number, points: number) => {
    const updated = [...questions];
    updated[qIdx].points = points;
    setQuestions(updated);
  };

  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx].text = text;
    setQuestions(updated);
  };

  const toggleOptionCorrect = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    const question = updated[qIdx];

    if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
      // Toggle off all other checks, only allow one correct answer
      question.options.forEach((o, idx) => {
        o.isCorrect = idx === oIdx;
      });
    } else {
      // Multi-select allows toggling individual options independently
      question.options[oIdx].isCorrect = !question.options[oIdx].isCorrect;
    }

    setQuestions(updated);
  };

  const deleteOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options.splice(oIdx, 1);
    setQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    updated[qIdx].options.push({ text: 'New Option', isCorrect: false });
    setQuestions(updated);
  };

  const deleteQuestion = (qIdx: number) => {
    const updated = [...questions];
    updated.splice(qIdx, 1);
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: 'New Question text here',
        type: 'MCQ',
        options: [
          { text: 'Option 1', isCorrect: true },
          { text: 'Option 2', isCorrect: false }
        ],
        timeLimit: 30,
        points: 100
      }
    ]);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      alert('Please enter a Quiz Title');
      return;
    }

    if (questions.length === 0) {
      alert('Please add or parse at least one question');
      return;
    }

    // Validate correct options are selected
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type !== 'POLL' && q.options.length > 0) {
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount === 0) {
          alert(`Question ${i + 1} ("${q.text.substring(0, 20)}...") has no correct answer marked!`);
          return;
        }
      }
    }

    setSaveLoading(true);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const endpoint = editQuizId ? `/api/quizzes/${editQuizId}` : '/api/quizzes';
      const method = editQuizId ? 'PUT' : 'POST';

      const response = await fetch(`${apiHost}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          classId: classId || null,
          questions
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save quiz');
      }

      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading && editQuizId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <div className="max-w-6xl mx-auto z-10 relative flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="p-3 glass-panel border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {editQuizId ? 'Edit Quiz' : 'Create a Quiz'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">Import from plain text files, validate, preview, and publish questions</p>
            </div>
          </div>
          <button
            onClick={handleSaveQuiz}
            disabled={saveLoading}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saveLoading ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>

        {/* Quiz Metadata form */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Quiz Title</label>
              <input
                type="text"
                placeholder="e.g. Science Quiz: Force and Dynamics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Assessment quiz for 10th grade students covering Newton's laws."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Assign to Class (Optional)</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10 bg-slate-900 text-slate-300"
            >
              <option value="">No class assignment</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic workflow display */}
        {!isEditing ? (
          /* STEP 1: PARSING PLATFORM */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Raw input text editor */}
            <div className="lg:col-span-3 glass-panel p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-md">Plain Text Question Editor</span>
                <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                  Mark correct option with a ✅
                </span>
              </div>
              <textarea
                placeholder={`Which language runs in the browser?&#10;A. Python&#10;B. Java&#10;C. JavaScript ✅&#10;D. C++&#10;&#10;What is the capital of India?&#10;A. Mumbai&#10;B. New Delhi ✅&#10;C. Kolkata`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full min-h-80 px-4 py-4 rounded-xl glass-input text-sm font-mono border border-white/10"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleParseText(rawText)}
                  disabled={loading || !rawText.trim()}
                  className="flex-grow py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Parsing...' : 'Parse & Preview Questions'}
                </button>
              </div>
            </div>

            {/* Drag and drop / Guide pane */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* File upload card */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="glass-panel p-10 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt" 
                  className="hidden" 
                />
                <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-indigo-400 transition-all mb-4" />
                <h3 className="font-bold text-white text-md">Import Plain Text File</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-xs">Drag and drop your quiz `.txt` file here, or click to browse files from your computer.</p>
              </div>

              {/* Instructions guide */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" /> Upload Formatting Guide
                </h4>
                <div className="text-xs text-slate-400 space-y-2 font-mono bg-white/5 p-4 rounded-xl">
                  <p className="text-indigo-300 font-bold">// Format question block like this:</p>
                  <p>What is 2 + 2?</p>
                  <p>A. 3</p>
                  <p>B. 4 ✅</p>
                  <p>C. 5</p>
                  <p>D. 6</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Questions are separated by empty lines. Options should start with A., B., C., D. prefix formats. Ensure exactly one correct answer contains the ✅ marker per question.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: INTERACTIVE QUESTIONS PREVIEW EDITOR */
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex justify-between items-center glass-panel p-4 rounded-2xl border border-white/5">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Previewing {questions.length} Questions
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs glass-panel border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl text-slate-300 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-import Text
                </button>
                <button
                  onClick={addQuestion}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-xl text-white font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Question
                </button>
              </div>
            </div>

            {/* Validation errors warning bar */}
            {errors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Found {errors.length} formatting warnings! Please resolve them before publishing:</span>
                </div>
                <ul className="list-disc pl-6 text-xs text-amber-400 space-y-1">
                  {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              </div>
            )}

            {/* Questions list editor */}
            <div className="flex flex-col gap-6">
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col gap-4 hover:border-white/10 transition-all relative">
                  {/* Floating index */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-slate-800 border border-white/10 text-white font-bold flex items-center justify-center text-xs shadow-md">
                    {qIdx + 1}
                  </div>

                  {/* Header controls (Question Type, Time, Points, Delete) */}
                  <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question Type</label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestionType(qIdx, e.target.value)}
                          className="px-3 py-1.5 rounded-lg glass-input text-xs border border-white/10 bg-slate-900 text-slate-300"
                        >
                          <option value="MCQ">Multiple Choice (MCQ)</option>
                          <option value="MULTI_SELECT">Multiple Select</option>
                          <option value="TRUE_FALSE">True / False</option>
                          <option value="POLL">Poll Question</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timer (Sec)</label>
                        <select
                          value={q.timeLimit}
                          onChange={(e) => updateQuestionTime(qIdx, Number(e.target.value))}
                          className="px-3 py-1.5 rounded-lg glass-input text-xs border border-white/10 bg-slate-900 text-slate-300"
                        >
                          <option value={10}>10s</option>
                          <option value={20}>20s</option>
                          <option value={30}>30s</option>
                          <option value={60}>60s</option>
                          <option value={90}>90s</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Points</label>
                        <select
                          value={q.points}
                          onChange={(e) => updateQuestionPoints(qIdx, Number(e.target.value))}
                          className="px-3 py-1.5 rounded-lg glass-input text-xs border border-white/10 bg-slate-900 text-slate-300"
                        >
                          <option value={50}>50 pts</option>
                          <option value={100}>100 pts</option>
                          <option value={200}>200 pts</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteQuestion(qIdx)}
                      className="text-xs bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 px-3.5 py-1.5 rounded-lg border border-red-500/15 flex items-center gap-1 transition-all cursor-pointer font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Question
                    </button>
                  </div>

                  {/* Question Title input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question Prompt</label>
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm font-semibold border border-white/10"
                    />
                  </div>

                  {/* Options items */}
                  {q.type !== 'SHORT_ANSWER' && (
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Response Options</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, oIdx) => (
                          <div 
                            key={oIdx} 
                            className={`flex items-center gap-2 p-3 bg-white/5 rounded-xl border transition-all ${
                              opt.isCorrect 
                                ? 'border-green-500/30 bg-green-500/5' 
                                : 'border-white/5'
                            }`}
                          >
                            {/* Correct Indicator button */}
                            {q.type !== 'POLL' && (
                              <button
                                type="button"
                                onClick={() => toggleOptionCorrect(qIdx, oIdx)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border cursor-pointer flex-shrink-0 ${
                                  opt.isCorrect 
                                    ? 'bg-green-500 border-green-500 text-slate-950 font-bold' 
                                    : 'border-white/20 hover:border-green-500/50'
                                }`}
                              >
                                {opt.isCorrect && '✓'}
                              </button>
                            )}
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                              className="flex-grow bg-transparent text-sm text-white focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5"
                            />
                            {/* Delete Option button */}
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => deleteOption(qIdx, oIdx)}
                                className="text-slate-500 hover:text-red-400 transition-all p-1"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Add Option button */}
                      {q.options.length < 6 && q.type !== 'TRUE_FALSE' && (
                        <button
                          type="button"
                          onClick={() => addOption(qIdx)}
                          className="self-start text-xs text-indigo-400 hover:text-indigo-300 font-bold mt-2 flex items-center gap-1 cursor-pointer"
                        >
                          + Add Option
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={handleSaveQuiz}
              disabled={saveLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-2xl hover:shadow-lg active:scale-95 transition-all text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saveLoading ? 'Publishing Quiz...' : 'Save and Publish Entire Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
