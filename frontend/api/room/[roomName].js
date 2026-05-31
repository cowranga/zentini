const DAILY_BASE_URL = 'https://api.daily.co/v1';

export default async function handler(req, res) {
  const { roomName } = req.query;

  try {
    if (req.method === 'GET') {
      const response = await fetch(`${DAILY_BASE_URL}/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      });

      if (!response.ok) {
        return res.status(404).json({ success: false, error: 'Room not found or expired' });
      }

      const room = await response.json();
      return res.json({ success: true, roomName: room.name, roomUrl: room.url });
    }

    if (req.method === 'DELETE') {
      await fetch(`${DAILY_BASE_URL}/rooms/${roomName}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      });
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
