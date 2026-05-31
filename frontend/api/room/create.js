const DAILY_BASE_URL = 'https://api.daily.co/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { randomUUID } = await import('node:crypto');
  const roomName = `zentini-${randomUUID().slice(0, 8)}`;

  try {
    const response = await fetch(`${DAILY_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
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

    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const inviteLink = `${protocol}://${host}/call/${room.name}`;

    res.json({
      success: true,
      roomName: room.name,
      roomUrl: room.url,
      inviteLink,
    });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
