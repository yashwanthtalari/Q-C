'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Plus, LogOut, BookOpen, Trophy, Users, BarChart3, 
  Settings as SettingsIcon, Play, Edit, Trash2, ShieldAlert,
  ChevronRight, Calendar, UserPlus, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { initialize, token, user, logout, isAuthenticated } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'quizzes' | 'classes' | 'reports'>('quizzes');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Class form state
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [classModalOpen, setClassModalOpen] = useState(false);

  // Student form state
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [studentNames, setStudentNames] = useState('');
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  // Report modal state
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [reportDetails, setReportDetails] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load dashboard data
  useEffect(() => {
    if (token) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const headers = { 'Authorization': `Bearer ${token}` };

      const [quizzesRes, classesRes, reportsRes] = await Promise.all([
        fetch(`${apiHost}/api/quizzes`, { headers }),
        fetch(`${apiHost}/api/quizzes/classes/list`, { headers }),
        fetch(`${apiHost}/api/quizzes/reports/list`, { headers })
      ]);

      if (!quizzesRes.ok || !classesRes.ok || !reportsRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const [quizzesData, classesData, reportsData] = await Promise.all([
        quizzesRes.json(),
        classesRes.json(),
        reportsRes.json()
      ]);

      setQuizzes(quizzesData);
      setClasses(classesData);
      setReports(reportsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiHost}/api/quizzes/classes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newClassName.trim(), description: newClassDesc.trim() })
      });

      if (!response.ok) throw new Error('Failed to create class');
      
      setNewClassName('');
      setNewClassDesc('');
      setClassModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNames.trim() || !selectedClass) return;

    // Parse list of student names (newline separated)
    const nameList = studentNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (nameList.length === 0) return;

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const students = nameList.map(name => ({
        name,
        pin: Math.floor(1000 + Math.random() * 9000).toString() // auto roll pin
      }));

      const response = await fetch(`${apiHost}/api/quizzes/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ students })
      });

      if (!response.ok) throw new Error('Failed to add students');

      setStudentNames('');
      setStudentModalOpen(false);
      setSelectedClass(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiHost}/api/quizzes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete quiz');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewReport = async (reportId: string) => {
    setReportLoading(true);
    setSelectedReport(reportId);
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiHost}/api/quizzes/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load report metrics');
      const data = await response.json();
      setReportDetails(data);
    } catch (err: any) {
      alert(err.message);
      setSelectedReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const handleStartSession = (quizId: string) => {
    router.push(`/host?quizId=${quizId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 glass-panel border-r border-white/5 p-6 flex flex-col justify-between z-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="font-bold text-white text-md">Q</span>
            </div>
            <span className="font-extrabold text-lg text-white tracking-tight">Q/C Class</span>
          </div>

          {/* Teacher Profile Card */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-6">
            <div className="text-xs text-slate-400">Signed in as</div>
            <div className="font-bold text-white text-sm truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => { setActiveTab('quizzes'); setSelectedReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'quizzes' 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Quizzes
            </button>
            <button
              onClick={() => { setActiveTab('classes'); setSelectedReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'classes' 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" /> Classes
            </button>
            <button
              onClick={() => { setActiveTab('reports'); setSelectedReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'reports' 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
          </nav>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all mt-6 cursor-pointer border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 z-10 overflow-y-auto max-h-screen">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 1: QUIZZES
            ---------------------------------------------------- */}
        {activeTab === 'quizzes' && (
          <div className="animate-fade-in flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">My Quizzes</h1>
                <p className="text-sm text-slate-400 mt-1">Manage, import, and host your live quizzes</p>
              </div>
              <Link 
                href="/dashboard/quizzes/create"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 px-5 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Quiz
              </Link>
            </div>

            {/* Quick stats banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Quizzes</div>
                  <div className="text-2xl font-bold text-white">{quizzes.length}</div>
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Active Classes</div>
                  <div className="text-2xl font-bold text-white">{classes.length}</div>
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Completed Sessions</div>
                  <div className="text-2xl font-bold text-white">{reports.length}</div>
                </div>
              </div>
            </div>

            {/* Quizzes list */}
            {quizzes.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl border border-white/5 flex flex-col items-center max-w-lg mx-auto mt-6">
                <FileText className="w-12 h-12 text-indigo-400/50 mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-white">No quizzes yet</h3>
                <p className="text-sm text-slate-400 mt-2">Create a quiz by importing a standard plain text file containing your questions and correct answer markings.</p>
                <Link 
                  href="/dashboard/quizzes/create"
                  className="bg-indigo-500 hover:bg-indigo-600 px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer mt-6"
                >
                  <Plus className="w-4 h-4" /> Import First Quiz
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="glass-panel rounded-2xl border border-white/5 p-6 flex flex-col justify-between hover:border-white/10 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 filter blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all"></div>
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-bold text-white text-lg group-hover:text-indigo-300 transition-all truncate">{quiz.title}</h3>
                      </div>
                      <p className="text-slate-400 text-xs mt-1 truncate">{quiz.description || 'No description'}</p>
                      
                      <div className="flex items-center gap-4 mt-6">
                        <div className="text-xs bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full font-semibold border border-indigo-500/15">
                          {quiz._count.questions} questions
                        </div>
                        {quiz.class && (
                          <div className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-semibold">
                            {quiz.class.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-8 pt-4 border-t border-white/5">
                      <button
                        onClick={() => handleStartSession(quiz.id)}
                        className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-md hover:shadow-indigo-500/10 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Host Live
                      </button>
                      <Link
                        href={`/dashboard/quizzes/create?edit=${quiz.id}`}
                        className="p-2.5 glass-panel border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="p-2.5 glass-panel border border-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 2: CLASSES
            ---------------------------------------------------- */}
        {activeTab === 'classes' && (
          <div className="animate-fade-in flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Classes & Rosters</h1>
                <p className="text-sm text-slate-400 mt-1">Manage rosters of students for assignable performance evaluation</p>
              </div>
              <button 
                onClick={() => setClassModalOpen(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 px-5 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Class
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl border border-white/5 flex flex-col items-center max-w-lg mx-auto mt-6">
                <Users className="w-12 h-12 text-indigo-400/50 mb-4" />
                <h3 className="text-lg font-bold text-white">No classes created</h3>
                <p className="text-sm text-slate-400 mt-2">Create classes to add student names and track performance logs and quiz reports.</p>
                <button 
                  onClick={() => setClassModalOpen(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer mt-6"
                >
                  <Plus className="w-4 h-4" /> Add Class
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((cls) => (
                  <div key={cls.id} className="glass-panel rounded-2xl border border-white/5 p-6 flex flex-col justify-between hover:border-white/10 transition-all">
                    <div>
                      <h3 className="font-bold text-white text-lg truncate">{cls.name}</h3>
                      <p className="text-slate-400 text-xs mt-1 truncate">{cls.description || 'No description'}</p>
                      
                      <div className="flex items-center gap-4 mt-6">
                        <div className="text-xs bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full font-semibold border border-indigo-500/15">
                          {cls._count.students} Students
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-8 pt-4 border-t border-white/5">
                      <button
                        onClick={() => { setSelectedClass(cls); setStudentModalOpen(true); }}
                        className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer border border-indigo-500/25"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Add Students
                      </button>
                      <button
                        onClick={() => { router.push(`/dashboard/classes/${cls.id}`); }}
                        className="p-2.5 glass-panel border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center text-xs font-semibold gap-1 px-3"
                      >
                        View roster <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 3: REPORTS & ANALYTICS
            ---------------------------------------------------- */}
        {activeTab === 'reports' && !selectedReport && (
          <div className="animate-fade-in flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Quiz Session Reports</h1>
              <p className="text-sm text-slate-400 mt-1">Review live metrics, accuracy graphs, and student podium details</p>
            </div>

            {reports.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-3xl border border-white/5 flex flex-col items-center max-w-lg mx-auto mt-6">
                <BarChart3 className="w-12 h-12 text-indigo-400/50 mb-4" />
                <h3 className="text-lg font-bold text-white">No sessions completed</h3>
                <p className="text-sm text-slate-400 mt-2">When students join and complete a live quiz session that you host, stats will automatically appear here.</p>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-slate-300">
                      <th className="p-4 font-semibold">Quiz Title</th>
                      <th className="p-4 font-semibold">Access PIN</th>
                      <th className="p-4 font-semibold text-center">Players</th>
                      <th className="p-4 font-semibold text-center">Avg. Score</th>
                      <th className="p-4 font-semibold text-center">Avg. Accuracy</th>
                      <th className="p-4 font-semibold">Date Completed</th>
                      <th className="p-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((rep) => (
                      <tr key={rep.id} className="border-b border-white/5 hover:bg-white/5 text-slate-400 transition-all">
                        <td className="p-4 font-semibold text-white truncate max-w-xs">{rep.quizTitle}</td>
                        <td className="p-4 font-mono font-bold text-indigo-400">{rep.accessCode}</td>
                        <td className="p-4 text-center text-white font-bold">{rep.participants}</td>
                        <td className="p-4 text-center">{rep.averageScore}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            rep.accuracy >= 70 ? 'bg-green-500/10 text-green-400' :
                            rep.accuracy >= 40 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {rep.accuracy}%
                          </span>
                        </td>
                        <td className="p-4 text-xs">
                          {new Date(rep.endedAt).toLocaleDateString()} at {new Date(rep.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleViewReport(rep.id)}
                            className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/35 transition-all cursor-pointer font-bold"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            REPORT FULL VIEW (NESTED REPORT ANALYTICS DETAILS)
            ---------------------------------------------------- */}
        {selectedReport && reportDetails && (
          <div className="animate-fade-in flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white text-sm font-semibold cursor-pointer"
              >
                &larr; Back to Reports List
              </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">{reportDetails.quizTitle}</h1>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Ended on {new Date(reportDetails.endedAt).toLocaleDateString()}
                  <span className="text-slate-600">|</span> Room PIN: <span className="font-mono text-indigo-400 font-bold">{reportDetails.accessCode}</span>
                </p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-400">Total Participants</div>
                <div className="text-3xl font-bold text-white mt-1">{reportDetails.participantCount}</div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-400">Class Average Score</div>
                <div className="text-3xl font-bold text-white mt-1">
                  {reportDetails.participants.length > 0 
                    ? Math.round(reportDetails.participants.reduce((acc: any, p: any) => acc + p.score, 0) / reportDetails.participants.length)
                    : 0
                  }
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-400">Highest Score</div>
                <div className="text-3xl font-bold text-white mt-1">
                  {reportDetails.participants.length > 0 ? reportDetails.participants[0].score : 0}
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-400">Hardest Question</div>
                <div className="text-sm font-bold text-red-400 truncate mt-2">
                  {reportDetails.hardestQuestion ? reportDetails.hardestQuestion.text : 'N/A'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {reportDetails.hardestQuestion ? `Accuracy: ${reportDetails.hardestQuestion.accuracy}%` : ''}
                </div>
              </div>
            </div>

            {/* Split: Left=Rankings list, Right=Questions accuracy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Leaderboard rankings */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Rankings Leaderboard</h3>
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                  {reportDetails.participants.map((p: any, idx: number) => (
                    <div key={p.id} className="flex justify-between items-center p-3.5 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-slate-950 font-black' :
                          idx === 1 ? 'bg-slate-300 text-slate-950 font-black' :
                          idx === 2 ? 'bg-amber-600 text-slate-100 font-black' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">{p.correctAnswers} / {p.submissionsCount} correct</span>
                        <span className="font-bold text-indigo-400">{p.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question summary logs */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Question Details</h3>
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                  {reportDetails.questionsSummary.map((q: any) => (
                    <div key={q.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-semibold text-white text-sm">{q.text}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          q.accuracy >= 70 ? 'bg-green-500/10 text-green-400' :
                          q.accuracy >= 40 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {q.accuracy}% accuracy
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>Type: {q.type}</span>
                        <span>Avg response: {q.avgResponseTime}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {reportLoading && (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
          </div>
        )}
      </main>

      {/* ----------------------------------------------------
          MODAL: CREATE CLASS
          ---------------------------------------------------- */}
      {classModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 relative shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Create a Class</h2>
            <p className="text-xs text-slate-400 mb-6">Group students to record performance track records</p>
            
            <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. Grade 10 A, Physics Sec-1"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Morning batch physics lectures"
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="flex-1 py-3 rounded-xl glass-panel border border-white/10 text-slate-300 font-bold hover:bg-white/5 active:scale-95 transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: ADD STUDENTS
          ---------------------------------------------------- */}
      {studentModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 relative shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1">Add Students</h2>
            <p className="text-xs text-indigo-400 mb-6 font-semibold">Class: {selectedClass.name}</p>
            
            <form onSubmit={handleAddStudents} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Student Names (One per line)
                </label>
                <textarea
                  placeholder="Alice Smith&#10;Bob Jones&#10;Charlie Brown"
                  value={studentNames}
                  onChange={(e) => setStudentNames(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm border border-white/10 min-h-40"
                  required
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setStudentModalOpen(false); setSelectedClass(null); }}
                  className="flex-1 py-3 rounded-xl glass-panel border border-white/10 text-slate-300 font-bold hover:bg-white/5 active:scale-95 transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold hover:shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
                >
                  Add Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
