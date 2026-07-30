import { Server, Socket } from 'socket.io';
import prisma from '../utils/db';

interface ActiveSession {
  sessionId: string;
  quizId: string;
  accessCode: string;
  status: string; // WAITING, ACTIVE, LEADERBOARD, COMPLETED
  currentQuestionIndex: number;
  currentQuestionStartedAt: number | null;
  correctAnswersCount: number; // for speed bonus calculation
  questions: any[];
  timerId?: NodeJS.Timeout;
}

// In-memory active game sessions mapped by accessCode
const activeSessions = new Map<string, ActiveSession>();

export function setupQuizSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ----------------------------------------------------
    // TEACHER EVENTS
    // ----------------------------------------------------

    // 1. Teacher starts a quiz session and generates an access code
    socket.on('host_session', async ({ quizId }: { quizId: string }) => {
      try {
        const quiz = await prisma.quiz.findUnique({
          where: { id: quizId },
          include: {
            questions: {
              include: { options: true },
              orderBy: { order: 'asc' }
            }
          }
        });

        if (!quiz) {
          socket.emit('error_message', 'Quiz not found');
          return;
        }

        // Generate a unique 6-digit random code
        let accessCode = '';
        let codeExists = true;
        while (codeExists) {
          accessCode = Math.floor(100000 + Math.random() * 900000).toString();
          const existing = await prisma.quizSession.findUnique({ where: { accessCode } });
          if (!existing) codeExists = false;
        }

        const session = await prisma.quizSession.create({
          data: {
            quizId,
            status: 'WAITING',
            accessCode,
            currentQuestionIndex: -1
          }
        });

        const activeSession: ActiveSession = {
          sessionId: session.id,
          quizId,
          accessCode,
          status: 'WAITING',
          currentQuestionIndex: -1,
          currentQuestionStartedAt: null,
          correctAnswersCount: 0,
          questions: quiz.questions
        };

        activeSessions.set(accessCode, activeSession);
        socket.join(`room:${accessCode}`);
        socket.emit('session_created', { accessCode, sessionId: session.id });
      } catch (err: any) {
        socket.emit('error_message', 'Error hosting session: ' + err.message);
      }
    });

    // 2. Teacher starts the quiz (displays first question)
    socket.on('start_quiz', async ({ accessCode }: { accessCode: string }) => {
      const session = activeSessions.get(accessCode);
      if (!session) {
        socket.emit('error_message', 'Session not found');
        return;
      }

      session.status = 'ACTIVE';
      session.currentQuestionIndex = 0;
      session.currentQuestionStartedAt = Date.now();
      session.correctAnswersCount = 0;

      await prisma.quizSession.update({
        where: { id: session.sessionId },
        data: {
          status: 'ACTIVE',
          currentQuestionIndex: 0,
          currentQuestionStartedAt: new Date()
        }
      });

      const question = session.questions[0];
      // Hide correct answers from option objects sent to students
      const studentOptions = question.options.map((o: any) => ({
        id: o.id,
        text: o.text,
        order: o.order
      }));

      io.to(`room:${accessCode}`).emit('question_active', {
        questionId: question.id,
        text: question.text,
        type: question.type,
        timeLimit: question.timeLimit,
        points: question.points,
        order: question.order,
        options: studentOptions,
        totalQuestions: session.questions.length,
        currentQuestionIndex: session.currentQuestionIndex
      });
    });

    // 3. Teacher moves to next question
    socket.on('next_question', async ({ accessCode }: { accessCode: string }) => {
      const session = activeSessions.get(accessCode);
      if (!session) {
        socket.emit('error_message', 'Session not found');
        return;
      }

      session.currentQuestionIndex += 1;

      if (session.currentQuestionIndex >= session.questions.length) {
        // End of Quiz
        session.status = 'COMPLETED';
        await prisma.quizSession.update({
          where: { id: session.sessionId },
          data: { status: 'COMPLETED', endedAt: new Date() }
        });

        // Get final leaderboard details
        const finalLeaderboard = await getLeaderboardData(session.sessionId);
        io.to(`room:${accessCode}`).emit('quiz_completed', { leaderboard: finalLeaderboard });
        activeSessions.delete(accessCode);
        return;
      }

      session.status = 'ACTIVE';
      session.currentQuestionStartedAt = Date.now();
      session.correctAnswersCount = 0;

      await prisma.quizSession.update({
        where: { id: session.sessionId },
        data: {
          status: 'ACTIVE',
          currentQuestionIndex: session.currentQuestionIndex,
          currentQuestionStartedAt: new Date()
        }
      });

      const question = session.questions[session.currentQuestionIndex];
      const studentOptions = question.options.map((o: any) => ({
        id: o.id,
        text: o.text,
        order: o.order
      }));

      io.to(`room:${accessCode}`).emit('question_active', {
        questionId: question.id,
        text: question.text,
        type: question.type,
        timeLimit: question.timeLimit,
        points: question.points,
        order: question.order,
        options: studentOptions,
        totalQuestions: session.questions.length,
        currentQuestionIndex: session.currentQuestionIndex
      });
    });

    // 4. Teacher skips current question
    socket.on('skip_question', ({ accessCode }: { accessCode: string }) => {
      const session = activeSessions.get(accessCode);
      if (!session) return;

      io.to(`room:${accessCode}`).emit('question_skipped');
    });

    // 5. Teacher requests showing the leaderboard for the current question
    socket.on('show_leaderboard', async ({ accessCode }: { accessCode: string }) => {
      const session = activeSessions.get(accessCode);
      if (!session) return;

      session.status = 'LEADERBOARD';
      await prisma.quizSession.update({
        where: { id: session.sessionId },
        data: { status: 'LEADERBOARD' }
      });

      const leaderboard = await getLeaderboardData(session.sessionId);
      io.to(`room:${accessCode}`).emit('leaderboard_update', { leaderboard });
    });

    // 6. Teacher locks submissions manually
    socket.on('lock_answers', ({ accessCode }: { accessCode: string }) => {
      io.to(`room:${accessCode}`).emit('answers_locked');
    });

    // 7. Teacher ends quiz session manually
    socket.on('end_quiz', async ({ accessCode }: { accessCode: string }) => {
      const session = activeSessions.get(accessCode);
      if (!session) return;

      session.status = 'COMPLETED';
      await prisma.quizSession.update({
        where: { id: session.sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() }
      });

      const finalLeaderboard = await getLeaderboardData(session.sessionId);
      io.to(`room:${accessCode}`).emit('quiz_completed', { leaderboard: finalLeaderboard });
      activeSessions.delete(accessCode);
    });

    // ----------------------------------------------------
    // STUDENT EVENTS
    // ----------------------------------------------------

    // 1. Student joins a live lobby
    socket.on('join_session', async ({ accessCode, name }: { accessCode: string; name: string }) => {
      try {
        const session = activeSessions.get(accessCode);
        if (!session) {
          socket.emit('join_error', 'Invalid access code or session has expired');
          return;
        }

        if (session.status === 'COMPLETED') {
          socket.emit('join_error', 'This quiz session has already completed');
          return;
        }

        // Add participant in DB
        let participant = await prisma.participant.findFirst({
          where: { sessionId: session.sessionId, name }
        });

        if (!participant) {
          participant = await prisma.participant.create({
            data: {
              sessionId: session.sessionId,
              name,
              score: 0,
              currentStreak: 0,
              highestStreak: 0
            }
          });
        } else {
          // Reconnecting student
          await prisma.participant.update({
            where: { id: participant.id },
            data: { isConnected: true }
          });
        }

        // Associate details to the socket
        socket.data = {
          accessCode,
          participantId: participant.id,
          name
        };

        socket.join(`room:${accessCode}`);

        // Broadcast to teacher/lobby the student joined
        io.to(`room:${accessCode}`).emit('student_joined', {
          id: participant.id,
          name: participant.name,
          score: participant.score,
          isConnected: true
        });

        // Send current session status to the student so they can align layout
        const currentQuestion = session.currentQuestionIndex >= 0 ? session.questions[session.currentQuestionIndex] : null;
        let studentOptions = null;
        if (currentQuestion) {
          studentOptions = currentQuestion.options.map((o: any) => ({
            id: o.id,
            text: o.text,
            order: o.order
          }));
        }

        socket.emit('room_joined', {
          sessionId: session.sessionId,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.questions.length,
          participantId: participant.id,
          name: participant.name,
          currentQuestion: currentQuestion ? {
            questionId: currentQuestion.id,
            text: currentQuestion.text,
            type: currentQuestion.type,
            timeLimit: currentQuestion.timeLimit,
            points: currentQuestion.points,
            options: studentOptions
          } : null
        });

        // Refresh list of all participants to everyone
        const participants = await prisma.participant.findMany({
          where: { sessionId: session.sessionId }
        });
        io.to(`room:${accessCode}`).emit('lobby_participants', participants);
      } catch (err: any) {
        socket.emit('join_error', 'Failed to join: ' + err.message);
      }
    });

    // 2. Student submits an answer
    socket.on('submit_answer', async ({
      questionId,
      chosenOptionIds,
      textAnswer
    }: {
      questionId: string;
      chosenOptionIds: string[];
      textAnswer?: string;
    }) => {
      const { accessCode, participantId, name } = socket.data;
      if (!accessCode || !participantId) {
        socket.emit('error_message', 'Not connected to a valid session');
        return;
      }

      const session = activeSessions.get(accessCode);
      if (!session || session.status !== 'ACTIVE') {
        socket.emit('error_message', 'Answering is locked or session is not active');
        return;
      }

      const question = session.questions.find(q => q.id === questionId);
      if (!question) {
        socket.emit('error_message', 'Invalid question context');
        return;
      }

      try {
        const responseTimeMs = Date.now() - (session.currentQuestionStartedAt || Date.now());

        // Scoring rules:
        // Correct = 100 points
        // Speed bonus: 1st = +50, 2nd = +40, 3rd = +30
        // Streak bonus: +10 per consecutive correct answer
        let isCorrect = false;

        if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
          const correctOption = question.options.find((o: any) => o.isCorrect);
          isCorrect = chosenOptionIds.length === 1 && chosenOptionIds[0] === correctOption?.id;
        } else if (question.type === 'MULTI_SELECT') {
          const correctOptionIds = question.options.filter((o: any) => o.isCorrect).map((o: any) => o.id);
          isCorrect = chosenOptionIds.length === correctOptionIds.length &&
            chosenOptionIds.every(id => correctOptionIds.includes(id));
        } else if (question.type === 'FILL_IN' || question.type === 'SHORT_ANSWER') {
          const correctText = question.options[0]?.text.trim().toLowerCase();
          isCorrect = textAnswer?.trim().toLowerCase() === correctText;
        } else if (question.type === 'POLL') {
          // Poll questions are always "correct" as they measure opinions
          isCorrect = true;
        }

        // Get participant status
        const participant = await prisma.participant.findUnique({
          where: { id: participantId }
        });

        if (!participant) {
          socket.emit('error_message', 'Participant record not found');
          return;
        }

        let scoreEarned = 0;
        let newStreak = 0;

        if (isCorrect) {
          scoreEarned += question.points || 100; // Base score
          
          if (question.type !== 'POLL') {
            session.correctAnswersCount += 1;
            
            // Speed Bonus
            if (session.correctAnswersCount === 1) scoreEarned += 50;
            else if (session.correctAnswersCount === 2) scoreEarned += 40;
            else if (session.correctAnswersCount === 3) scoreEarned += 30;

            // Streak Bonus
            newStreak = participant.currentStreak + 1;
            scoreEarned += newStreak * 10;
          }
        } else {
          newStreak = 0; // Reset streak
        }

        const newScore = participant.score + scoreEarned;
        const newHighestStreak = Math.max(participant.highestStreak, newStreak);

        // Save Answer Submission and Update Participant
        await prisma.$transaction([
          prisma.answerSubmission.create({
            data: {
              participantId,
              questionId,
              chosenOptionIds: JSON.stringify(chosenOptionIds),
              textAnswer,
              scoreEarned,
              responseTimeMs,
              isCorrect
            }
          }),
          prisma.participant.update({
            where: { id: participantId },
            data: {
              score: newScore,
              currentStreak: newStreak,
              highestStreak: newHighestStreak
            }
          })
        ]);

        socket.emit('submission_ack', {
          isCorrect,
          scoreEarned,
          totalScore: newScore,
          currentStreak: newStreak
        });

        // Notify teacher and lobby that a user submitted
        io.to(`room:${accessCode}`).emit('student_submitted', {
          participantId,
          name,
          responseTimeMs
        });
      } catch (err: any) {
        socket.emit('error_message', 'Error saving submission: ' + err.message);
      }
    });

    // 3. Handle disconnect / connection drop
    socket.on('disconnect', async () => {
      const { accessCode, participantId } = socket.data;
      if (accessCode && participantId) {
        try {
          await prisma.participant.update({
            where: { id: participantId },
            data: { isConnected: false }
          });

          io.to(`room:${accessCode}`).emit('student_disconnected', { id: participantId });
          
          // Refresh list of all participants to remaining lobby members
          const session = activeSessions.get(accessCode);
          if (session) {
            const participants = await prisma.participant.findMany({
              where: { sessionId: session.sessionId }
            });
            io.to(`room:${accessCode}`).emit('lobby_participants', participants);
          }
        } catch (err) {}
      }
    });
  });
}

// Helper to compute rankings for a session
async function getLeaderboardData(sessionId: string) {
  const participants = await prisma.participant.findMany({
    where: { sessionId },
    include: {
      submissions: {
        select: { isCorrect: true, responseTimeMs: true }
      }
    },
    orderBy: { score: 'desc' }
  });

  return participants.map((p, index) => {
    const totalSubmissions = p.submissions.length;
    const correctCount = p.submissions.filter(s => s.isCorrect).length;
    const accuracy = totalSubmissions > 0 ? Math.round((correctCount / totalSubmissions) * 100) : 0;
    const avgResponseTime = totalSubmissions > 0
      ? Math.round(p.submissions.reduce((acc, curr) => acc + curr.responseTimeMs, 0) / totalSubmissions)
      : 0;

    return {
      rank: index + 1,
      id: p.id,
      name: p.name,
      score: p.score,
      accuracy,
      correctAnswers: correctCount,
      avgResponseTime,
      streak: p.currentStreak,
      highestStreak: p.highestStreak,
      isConnected: p.isConnected
    };
  });
}
