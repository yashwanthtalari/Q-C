'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '../../../../store/useAuthStore';
import { ArrowLeft, UserPlus, Users, Key, Mail, Plus, AlertCircle } from 'lucide-react';

export default function ClassDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;

  const { initialize, token, isAuthenticated } = useAuthStore();
  
  const [classDetails, setClassDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add students form
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentNames, setStudentNames] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auth redirect
  useEffect(() => {
    const checkAuth = setTimeout(() => {
      if (!isAuthenticated) router.push('/auth/login');
    }, 500);
    return () => clearTimeout(checkAuth);
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (token && classId) {
      fetchClassDetails();
    }
  }, [token, classId]);

  const fetchClassDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiHost}/api/quizzes/classes/${classId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Class not found or unauthorized');
      }

      const data = await response.json();
      setClassDetails(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load class roster');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNames.trim()) return;

    const nameList = studentNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (nameList.length === 0) return;

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const students = nameList.map(name => ({
        name,
        pin: Math.floor(1000 + Math.random() * 9000).toString() // Generate unique 4-digit numeric roll pin
      }));

      const response = await fetch(`${apiHost}/api/quizzes/classes/${classId}/students`, {
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
      fetchClassDetails();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !classDetails) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative">
        <div className="ambient-glow-1"></div>
        <div className="glass-panel p-8 rounded-3xl border border-red-500/25 text-center max-w-sm w-full shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to load class</h2>
          <p className="text-xs text-slate-400 mb-6">{error || 'Class not found'}</p>
          <Link href="/dashboard" className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <div className="max-w-4xl mx-auto z-10 relative flex flex-col gap-6 animate-fade-in">
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
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{classDetails.name}</h1>
              <p className="text-xs text-slate-400 mt-1">{classDetails.description || 'No description provided'}</p>
            </div>
          </div>
          <button
            onClick={() => setStudentModalOpen(true)}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Students
          </button>
        </div>

        {/* Students list roster */}
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="font-bold text-white text-md flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Student Roster ({classDetails.students.length})
            </span>
          </div>

          {classDetails.students.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <UserPlus className="w-12 h-12 text-slate-600 mb-4" />
              <h4 className="font-bold text-white text-md">Class is empty</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">Enroll students to assign quizzes and generate attendance credentials.</p>
              <button
                onClick={() => setStudentModalOpen(true)}
                className="mt-4 px-4 py-2 text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                Enroll Students
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 bg-white/5">
                  <th className="p-4 font-semibold">Student Name</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">PIN/Roll Number</th>
                  <th className="p-4 font-semibold">Joined At</th>
                </tr>
              </thead>
              <tbody>
                {classDetails.students.map((student: any) => (
                  <tr key={student.id} className="border-b border-white/5 text-slate-300 hover:bg-white/5 transition-all">
                    <td className="p-4 font-bold text-white">{student.name}</td>
                    <td className="p-4 text-xs text-slate-400">{student.email || 'N/A'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-bold rounded-lg">
                        <Key className="w-3 h-3" /> {student.pin || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: ENROLL STUDENTS */}
      {studentModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 relative shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Enroll Students</h2>
            <p className="text-xs text-slate-400 mb-6">Enter list of student names to generate their quiz access PIN numbers</p>
            
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
                  onClick={() => setStudentModalOpen(false)}
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
