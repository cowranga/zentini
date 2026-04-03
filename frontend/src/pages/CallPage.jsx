import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DailyIframe from '@daily-co/daily-js'
import styles from './CallPage.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Call states
const STATE = {
  LOADING: 'loading',
  WAITING: 'waiting',      // Room validated, asking for display name
  JOINING: 'joining',
  IN_CALL: 'in_call',
  PARTNER_LEFT: 'partner_left',
  ERROR: 'error',
}

export default function CallPage() {
  const { roomName } = useParams()
  const navigate = useNavigate()
  const callContainerRef = useRef(null)
  const callFrameRef = useRef(null)

  const [state, setState] = useState(STATE.LOADING)
  const [displayName, setDisplayName] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [participants, setParticipants] = useState({})
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const timerRef = useRef(null)
  const hasJoinedRef = useRef(false)

  // ── Validate room on mount ──
  useEffect(() => {
    async function validateRoom() {
      try {
        const res = await fetch(`${API_URL}/api/room/${roomName}`)
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Room not found')
        setRoomUrl(data.roomUrl)
        setState(STATE.WAITING)
      } catch (e) {
        setError(e.message)
        setState(STATE.ERROR)
      }
    }
    validateRoom()
  }, [roomName])

  // ── Timer ──
  function startTimer() {
    timerRef.current = setInterval(() => {
      setDuration(d => d + 1)
    }, 1000)
  }

  function formatDuration(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // ── Join the call ──
  const joinCall = useCallback(async () => {
    if (!displayName.trim() || !roomUrl) return
    setState(STATE.JOINING)

    const frame = DailyIframe.createFrame(callContainerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '0px',
      },
      showLeaveButton: false,
      showFullscreenButton: false,
    })

    callFrameRef.current = frame

    // ── Event listeners ──
    frame.on('joined-meeting', () => {
      hasJoinedRef.current = true
      setState(STATE.IN_CALL)
      startTimer()
    })

    frame.on('participant-joined', (event) => {
      if (!event.participant.local) {
        setPartnerName(event.participant.user_name || 'Your partner')
      }
      setParticipants(prev => ({
        ...prev,
        [event.participant.session_id]: event.participant
      }))
    })

    frame.on('participant-updated', (event) => {
      setParticipants(prev => ({
        ...prev,
        [event.participant.session_id]: event.participant
      }))
    })

    frame.on('participant-left', (event) => {
      if (!event.participant.local) {
        setPartnerName('')
        setState(STATE.PARTNER_LEFT)
        clearInterval(timerRef.current)
      }
      setParticipants(prev => {
        const updated = { ...prev }
        delete updated[event.participant.session_id]
        return updated
      })
    })

    frame.on('left-meeting', () => {
      clearInterval(timerRef.current)
      if (hasJoinedRef.current) {
        navigate('/')
      }
    })

    frame.on('error', (e) => {
      setError(e.errorMsg || 'Call error')
      setState(STATE.ERROR)
    })

    try {
      await frame.join({
        url: roomUrl,
        userName: displayName.trim(),
      })
    } catch (e) {
      console.error('join error full:', e)
      setError(e.message || e.errorMsg || JSON.stringify(e) || 'Unknown join error')
      setState(STATE.ERROR)
    }
  }, [displayName, roomUrl, navigate])

  // ── Controls ──
  function toggleMute() {
    callFrameRef.current?.setLocalAudio(isMuted)
    setIsMuted(!isMuted)
  }

  function toggleVideo() {
    callFrameRef.current?.setLocalVideo(isVideoOff)
    setIsVideoOff(!isVideoOff)
  }

  async function leaveCall() {
    clearInterval(timerRef.current)
    await callFrameRef.current?.leave()
    navigate('/')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      callFrameRef.current?.destroy()
    }
  }, [])

  const participantCount = Object.keys(participants).length

  // ───────────────── RENDER ─────────────────

  if (state === STATE.ERROR) {
    return (
      <div className={styles.centeredPage}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>💔</div>
          <h2>{error?.includes('permission') || error?.includes('camera') ? 'Camera access needed' : 'Room not found'}</h2>
          <p>{error || "This room may have expired or the link is invalid."}</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/')}>
            Back to Zentini
          </button>
        </div>
      </div>
    )
  }

  if (state === STATE.LOADING) {
    return (
      <div className={styles.centeredPage}>
        <div className={styles.loadingDot} />
        <p className={styles.loadingText}>Finding your space...</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Background glow */}
      <div className={styles.bgGlow} />

      {/* ── Name entry overlay ── */}
      {(state === STATE.WAITING || state === STATE.JOINING) && (
        <div className={styles.overlay}>
          <div className={styles.preJoin}>
            <div className={styles.logo}>zen<span>tini</span></div>
            <div className={styles.preJoinIcon}>🕯️</div>
            <h2>Ready to connect?</h2>
            <p>Enter your name so your partner knows it's you.</p>
            <input
              className={styles.nameInput}
              placeholder="Your name..."
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinCall()}
              autoFocus
              maxLength={30}
            />
            <button
              className={styles.btnPrimary}
              onClick={joinCall}
              disabled={!displayName.trim() || state === STATE.JOINING}
            >
              {state === STATE.JOINING ? 'Joining...' : 'Join call ♡'}
            </button>
          </div>
        </div>
      )}

      {/* ── Partner left banner ── */}
      {state === STATE.PARTNER_LEFT && (
        <div className={styles.partnerLeftBanner}>
          <span>💔 Your partner left the call</span>
          <button onClick={() => setState(STATE.IN_CALL)}>Dismiss</button>
        </div>
      )}

      {/* ── TOP BAR ── */}
      {(state === STATE.IN_CALL || state === STATE.PARTNER_LEFT) && (
        <div className={styles.topBar}>
          <div className={styles.logo}>zen<span>tini</span></div>
          <div className={styles.callInfo}>
            {partnerName && (
              <div className={styles.partnerTag}>
                <div className={styles.onlineDot} />
                {partnerName}
              </div>
            )}
            {participantCount < 2 && !partnerName && (
              <div className={styles.waitingTag}>
                ⏳ Waiting for your partner...
              </div>
            )}
          </div>
          <div className={styles.timer}>{formatDuration(duration)}</div>
        </div>
      )}

      {/* ── DAILY IFRAME CONTAINER ── */}
      <div
        ref={callContainerRef}
        className={styles.callContainer}
        style={{ visibility: state === STATE.JOINING || state === STATE.IN_CALL || state === STATE.PARTNER_LEFT ? 'visible' : 'hidden' }}
      />

      {/* ── CONTROLS ── */}
      {(state === STATE.IN_CALL || state === STATE.PARTNER_LEFT) && (
        <div className={styles.controls}>
          <div className={styles.controlsInner}>
            <button
              className={`${styles.ctrlBtn} ${isMuted ? styles.ctrlBtnOff : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎙️'}
              <span>{isMuted ? 'Unmuted' : 'Mute'}</span>
            </button>

            <button
              className={`${styles.ctrlBtn} ${isVideoOff ? styles.ctrlBtnOff : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📵' : '📷'}
              <span>{isVideoOff ? 'Start video' : 'Stop video'}</span>
            </button>

            <button
              className={styles.endBtn}
              onClick={leaveCall}
              title="End call"
            >
              ✕
              <span>End call</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
