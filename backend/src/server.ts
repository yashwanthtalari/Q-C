import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routers & sockets
import authRouter from './routes/auth';
import quizRouter from './routes/quizzes';
import { setupQuizSockets } from './sockets/quizEngine';

// Load Environment Configuration
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Next.js Frontend
const corsOptions = {
  origin: '*', // For development, allow any origin. In production, restrict to frontend domain.
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Support larger text imports

// API Route Mounts
app.use('/api/auth', authRouter);
app.use('/api/quizzes', quizRouter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach WebSockets Handlers
setupQuizSockets(io);

// Start Server Listening
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Q/C Quiz Class Backend listening on http://localhost:${PORT}`);
});
