import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './HomePage.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function HomePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Create a new room
  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/room/create`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setInviteLink(data.inviteLink)
    } catch (e) {
      setError('Could not create room. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // Copy invite link
  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Go to the call directly (room creator)
  function handleGoToCall() {
    const roomName = inviteLink.split('/call/')[1]
    navigate(`/call/${roomName}`)
  }

  // Join via a code or pasted link
  function handleJoin(e) {
    e.preventDefault()
    const input = joinCode.trim()
    if (!input) return
    // Support both full links and just the room name
    if (input.includes('/call/')) {
      const roomName = input.split('/call/')[1]
      navigate(`/call/${roomName}`)
    } else {
      navigate(`/call/${input}`)
    }
  }

  return (
    <div className={styles.page}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.logo}>zen<span>tini</span></div>
      </nav>

      <main className={styles.main}>
        <div className={styles.tag}>♡ For couples, by heart</div>
        <h1 className={styles.title}>Your space<br />to <em>be close</em></h1>
        <p className={styles.subtitle}>
          HD video calls designed for two. Create a room and share the link. No account needed!
        </p>

        <div className={styles.cards}>
          {/* CREATE */}
          <div className={styles.card}>
            <div className={styles.cardIcon}>🕯️</div>
            <h2>Start a call</h2>
            <p>Create a private room and send your partner the link.</p>

            {!inviteLink ? (
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating your space...' : 'Create room ♡'}
              </button>
            ) : (
              <div className={styles.linkBox}>
                <p className={styles.linkLabel}>Share this link with your partner:</p>
                <div className={styles.linkRow}>
                  <input
                    className={styles.linkInput}
                    value={inviteLink}
                    readOnly
                    onClick={e => e.target.select()}
                  />
                  <button className={styles.copyBtn} onClick={handleCopy}>
                    {copied ? '✓' : '⧉'}
                  </button>
                </div>
                <button className={styles.btnPrimary} onClick={handleGoToCall}>
                  Join my room →
                </button>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>

          {/* JOIN */}
          <div className={styles.card}>
            <div className={styles.cardIcon}>💌</div>
            <h2>Join a call</h2>
            <p>Paste the link your partner sent you to join their room.</p>
            <form onSubmit={handleJoin} className={styles.joinForm}>
              <input
                className={styles.joinInput}
                placeholder="Paste invite link here..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
              />
              <button type="submit" className={styles.btnPrimary}>
                Join →
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
