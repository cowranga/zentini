#  Zentini: Video Calling for 2

HD, low-latency 1-on-1 video calls for couples. Built with Daily.co + Node.js + React.
- Check out the static html demo render here: https://zentini.netlify.app
- Live Demo: https://zentini.vercel.app

---

## What's in here

```
zentini/
├── backend/          ← Node.js server (creates/manages rooms)
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── frontend/         ← React app (the UI)
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── HomePage.jsx      ← Create room / join room
    │   │   └── CallPage.jsx      ← The actual video call
    ├── .env.example
    └── package.json
```

---

## Step 1: Get your Daily.co API key (free)

1. Go to **https://dashboard.daily.co** and sign up (free)
2. In the dashboard, go to **Developers → API Key**
3. Copy the API key — you'll need it in Step 3

Daily.co free tier includes **10,000 call minutes/month** — plenty to get started.

---

## Step 2: Set up the backend

```bash
# 1. Go into the backend folder
cd zentini/backend

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env

# 4. Open .env and paste your Daily.co API key:
#    DAILY_API_KEY=your_key_here

# 5. Start the backend server
npm run dev
```

You should see:
```
🕯️  Zentini backend running on http://localhost:3001
```

---

## Step 3: Set up the frontend

Open a **new terminal window**, then:

```bash
# 1. Go into the frontend folder
cd zentini/frontend

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# (no changes needed for local dev)

# 4. Start the frontend
npm run dev
```

You should see:
```
  ➜  Local:   http://localhost:5173/
```

---

## Step 4: Test it

1. Open **http://localhost:5173** in your browser
2. Click **"Create room ♡"**
3. Copy the invite link that appears
4. Open the invite link in a **second browser window** (or send it to your partner)
5. Enter your name in both windows and click **Join call**

You'll be on a live HD video call. 🎉

---

## How the invite link works

- Person A clicks **Create room** → gets a unique link like `http://localhost:5173/call/zentini-a1b2c3d4`
- They share it with their partner
- Person B opens the link, enters their name, joins instantly
- No accounts, no passwords, no app download needed

---

## Tech stack explained

| What | Tech | Why |
|------|------|-----|
| Video calls | **Daily.co** | Handles all the hard WebRTC stuff. HD, low-latency, reliable. |
| Server | **Node.js + Express** | Lightweight, fast to write, perfect for real-time apps. |
| Frontend | **React + Vite** | Industry standard. Fast development, great ecosystem. |
| Routing | **React Router** | Handles the `/call/:roomName` URL automatically. |

---


