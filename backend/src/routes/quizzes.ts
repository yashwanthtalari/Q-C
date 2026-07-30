import { Router, Response } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from './auth';
import { parseQuizText } from '../utils/parser';

const router = Router();

// Apply Authentication Middleware globally for quiz/class operations
router.use(authenticateToken as any);

/**
 * POST /api/quizzes/import
 * Parses raw text input for a quiz preview
 */
router.post('/import', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'No text content provided for parsing' });
      return;
    }

    const result = parseQuizText(text);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to parse text: ' + error.message });
  }
});

/**
 * GET /api/quizzes
 * List quizzes created by the authenticated teacher
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { teacherId: req.userId },
      include: {
        _count: {
          select: { questions: true }
        },
        class: {
          select: { name: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.status(200).json(quizzes);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * GET /api/quizzes/:id
 * Retrieve a specific quiz with full questions and options
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const quiz = await prisma.quiz.findFirst({
      where: { id, teacherId: req.userId },
      include: {
        questions: {
          include: {
            options: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }

    res.status(200).json(quiz);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * POST /api/quizzes
 * Create a new quiz with nested questions and options
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, classId, questions } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Quiz title is required' });
      return;
    }

    // Create the Quiz using a transactional block or nested creates
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        teacherId: req.userId!,
        classId: classId || null,
        questions: {
          create: (questions || []).map((q: any, qIdx: number) => ({
            text: q.text,
            type: q.type || 'MCQ',
            order: qIdx,
            timeLimit: q.timeLimit || 30,
            points: q.points || 100,
            options: {
              create: (q.options || []).map((o: any, oIdx: number) => ({
                text: o.text,
                isCorrect: o.isCorrect || false,
                order: oIdx
              }))
            }
          }))
        }
      },
      include: {
        questions: {
          include: { options: true }
        }
      }
    });

    res.status(201).json(quiz);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create quiz: ' + error.message });
  }
});

/**
 * PUT /api/quizzes/:id
 * Update an existing quiz (re-creates questions to simplify sync edits)
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, classId, questions } = req.body;

    // Verify ownership
    const existing = await prisma.quiz.findFirst({
      where: { id, teacherId: req.userId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Quiz not found or unauthorized' });
      return;
    }

    // Perform inside a transaction: Delete old questions, create new ones, update quiz details
    const updatedQuiz = await prisma.$transaction(async (tx) => {
      // 1. Delete all old questions (cascades to options)
      await tx.question.deleteMany({ where: { quizId: id } });

      // 2. Update Quiz metadata and recreate questions
      return await tx.quiz.update({
        where: { id },
        data: {
          title,
          description,
          classId: classId || null,
          questions: {
            create: (questions || []).map((q: any, qIdx: number) => ({
              text: q.text,
              type: q.type || 'MCQ',
              order: qIdx,
              timeLimit: q.timeLimit || 30,
              points: q.points || 100,
              options: {
                create: (q.options || []).map((o: any, oIdx: number) => ({
                  text: o.text,
                  isCorrect: o.isCorrect || false,
                  order: oIdx
                }))
              }
            }))
          }
        },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' }
          }
        }
      });
    });

    res.status(200).json(updatedQuiz);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update quiz: ' + error.message });
  }
});

/**
 * DELETE /api/quizzes/:id
 * Delete a quiz
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.quiz.findFirst({
      where: { id, teacherId: req.userId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Quiz not found or unauthorized' });
      return;
    }

    await prisma.quiz.delete({ where: { id } });
    res.status(200).json({ message: 'Quiz deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/* ==========================================
   CLASS MANAGEMENT ENDPOINTS
   ========================================== */

/**
 * GET /api/classes
 * List classes for the teacher
 */
router.get('/classes/list', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.userId },
      include: {
        _count: {
          select: { students: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(classes);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * POST /api/classes
 * Create a new class
 */
router.post('/classes/create', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Class name is required' });
      return;
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        description,
        teacherId: req.userId!
      }
    });

    res.status(201).json(newClass);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * GET /api/classes/:id
 * Retrieve class details and student roster
 */
router.get('/classes/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cls = await prisma.class.findFirst({
      where: { id, teacherId: req.userId },
      include: {
        students: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!cls) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    res.status(200).json(cls);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * POST /api/classes/:id/students
 * Add student(s) to a class
 */
router.post('/classes/:id/students', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { students } = req.body; // Expects an array: [{ name, email, pin }]

    const cls = await prisma.class.findFirst({
      where: { id, teacherId: req.userId }
    });

    if (!cls) {
      res.status(404).json({ error: 'Class not found or unauthorized' });
      return;
    }

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'An array of students is required' });
      return;
    }

    const created = await prisma.student.createMany({
      data: students.map(s => ({
        name: s.name,
        email: s.email || null,
        pin: s.pin || null,
        classId: id
      }))
    });

    res.status(201).json({ message: `Successfully added ${created.count} students` });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/* ==========================================
   REPORTS & ANALYTICS ENDPOINTS
   ========================================== */

/**
 * GET /api/reports
 * Get completed quiz session reports for dashboard analytics
 */
router.get('/reports/list', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reports = await prisma.quizSession.findMany({
      where: {
        quiz: { teacherId: req.userId },
        status: 'COMPLETED'
      },
      include: {
        quiz: {
          select: { title: true }
        },
        participants: {
          select: {
            id: true,
            score: true,
            submissions: {
              select: { isCorrect: true }
            }
          }
        }
      },
      orderBy: { endedAt: 'desc' }
    });

    // Map responses to compute summary statistics
    const responseData = reports.map(session => {
      const participantCount = session.participants.length;
      let avgScore = 0;
      let highestScore = 0;
      let accuracy = 0;

      if (participantCount > 0) {
        let totalScore = 0;
        let totalSubmissions = 0;
        let correctSubmissions = 0;

        session.participants.forEach(p => {
          totalScore += p.score;
          if (p.score > highestScore) highestScore = p.score;
          
          p.submissions.forEach(sub => {
            totalSubmissions++;
            if (sub.isCorrect) correctSubmissions++;
          });
        });

        avgScore = Math.round(totalScore / participantCount);
        accuracy = totalSubmissions > 0 ? Math.round((correctSubmissions / totalSubmissions) * 100) : 0;
      }

      return {
        id: session.id,
        quizTitle: session.quiz.title,
        accessCode: session.accessCode,
        endedAt: session.endedAt,
        participants: participantCount,
        averageScore: avgScore,
        highestScore: highestScore,
        accuracy: accuracy
      };
    });

    res.status(200).json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

/**
 * GET /api/reports/:id
 * Retrieve comprehensive statistics of a specific session
 */
router.get('/reports/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const session = await prisma.quizSession.findFirst({
      where: {
        id,
        quiz: { teacherId: req.userId }
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: true,
                submissions: {
                  where: { participant: { sessionId: id } }
                }
              }
            }
          }
        },
        participants: {
          include: {
            submissions: true
          },
          orderBy: { score: 'desc' }
        }
      }
    });

    if (!session) {
      res.status(404).json({ error: 'Report session not found' });
      return;
    }

    // Prepare detailed analytical summary metrics
    const participantCount = session.participants.length;
    const questionsSummary = session.quiz.questions.map(q => {
      const totalAnswers = q.submissions.length;
      const correctAnswers = q.submissions.filter(s => s.isCorrect).length;
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      const avgResponseTime = totalAnswers > 0
        ? Math.round(q.submissions.reduce((acc, curr) => acc + curr.responseTimeMs, 0) / totalAnswers)
        : 0;

      return {
        id: q.id,
        text: q.text,
        type: q.type,
        accuracy,
        avgResponseTime,
        totalAnswers,
        correctAnswers
      };
    });

    // Identify hardest question (lowest accuracy, minimum 1 response)
    const activeQuestions = questionsSummary.filter(q => q.totalAnswers > 0);
    const hardestQuestion = activeQuestions.length > 0
      ? activeQuestions.reduce((prev, curr) => prev.accuracy < curr.accuracy ? prev : curr)
      : null;

    res.status(200).json({
      sessionId: session.id,
      quizTitle: session.quiz.title,
      accessCode: session.accessCode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      participantCount,
      participants: session.participants.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        highestStreak: p.highestStreak,
        submissionsCount: p.submissions.length,
        correctAnswers: p.submissions.filter(s => s.isCorrect).length,
        accuracy: p.submissions.length > 0
          ? Math.round((p.submissions.filter(s => s.isCorrect).length / p.submissions.length) * 100)
          : 0
      })),
      questionsSummary,
      hardestQuestion: hardestQuestion ? { text: hardestQuestion.text, accuracy: hardestQuestion.accuracy } : null
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;
