require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Only allow requests from the frontend origin
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const roomCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 room creations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Room creation limit reached. Try again in an hour.' },
});

app.use(generalLimiter);
app.use(express.json());

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_BASE_URL = 'https://api.daily.co/v1';

// In-memory store for rooms (use Supabase/DB in production)
const rooms = new Map();

// ─────────────────────────────────────────────
// POST /api/room/create
// Creates a new Daily.co room and returns invite link
// ─────────────────────────────────────────────
app.post('/api/room/create', roomCreateLimiter, async (req, res) => {
  try {
    const roomName = `zentini-${uuidv4().slice(0, 8)}`;

    const response = await fetch(`${DAILY_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
          max_participants: 2,
          start_video_off: false,
          start_audio_off: false,
          enable_prejoin_ui: false,
        },
      }),
    });

    const room = await response.json();

    if (!response.ok) {
      throw new Error(room.error || 'Failed to create room');
    }

    // Store room metadata
    rooms.set(room.name, {
      name: room.name,
      url: room.url,
      createdAt: new Date().toISOString(),
    });

    // The invite link is just your frontend URL with the room name
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/call/${room.name}`;

    res.json({
      success: true,
      roomName: room.name,
      roomUrl: room.url,        // Daily.co direct URL (for the iframe/SDK)
      inviteLink,               // Your branded invite link
    });

  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/room/:roomName
// Validates a room exists before joining
// ─────────────────────────────────────────────
app.get('/api/room/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;

    const response = await fetch(`${DAILY_BASE_URL}/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (!response.ok) {
      return res.status(404).json({ success: false, error: 'Room not found or expired' });
    }

    const room = await response.json();

    res.json({
      success: true,
      roomName: room.name,
      roomUrl: room.url,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/room/:roomName
// Ends the call and deletes the room
// ─────────────────────────────────────────────
app.delete('/api/room/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;

    await fetch(`${DAILY_BASE_URL}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    rooms.delete(roomName);
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'zentini-backend' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🕯️  Zentini backend running on http://localhost:${PORT}\n`);
});
