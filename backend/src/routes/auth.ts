import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'quiz-class-secret-key-12345';

// Extend Express Request type to include user information
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Auth middleware to verify JWT
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.userId = decoded.userId;
    next();
  });
};

// Teacher Sign Up
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const existingTeacher = await prisma.teacher.findUnique({ where: { email } });
    if (existingTeacher) {
      res.status(400).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const teacher = await prisma.teacher.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    const token = jwt.sign({ userId: teacher.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Teacher Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, teacher.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: teacher.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get current teacher profile
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!teacher) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user: teacher });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;
