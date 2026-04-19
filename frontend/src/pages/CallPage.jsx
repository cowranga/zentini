import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DailyIframe from '@daily-co/daily-js'
import styles from './CallPage.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const STATE = {
  LOADING: 'loading',
  WAITING: 'waiting',
  JOINING: 'joining',
  IN_CALL: 'in_call',
  PARTNER_LEFT: 'partner_left',
  ERROR: 'error',
}

export default function CallPage() {
  const { roomName } = useParams()
  const navigate = useNavigate()
  const callObjectRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const screenAudioRef = useRef(null)
  const remoteCameraRef = useRef(null)
  const remoteCamDragging = useRef(false)
  const remoteCamDragOffset = useRef({ x: 0, y: 0 })
  const localCamDragging = useRef(false)
  const localCamDragOffset = useRef({ x: 0, y: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const [state, setState] = useState(STATE.LOADING)
  const [displayName, setDisplayName] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false)
  const [remoteCamPos, setRemoteCamPos] = useState(() => ({ x: 24, y: window.innerHeight - 250 }))
  const [remoteCamSize, setRemoteCamSize] = useState({ width: 200, height: 130 })
  const [localCamPos, setLocalCamPos] = useState(() => ({ x: window.innerWidth - 224, y: window.innerHeight - 250 }))
  const [partnerName, setPartnerName] = useState('')
  const [controlsVisible, setControlsVisible] = useState(false)
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
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }

  function formatDuration(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // ── Attach tracks to video elements ──
  function attachTracks(participant) {
    if (participant.local) {
      const track = participant.tracks?.video?.persistentTrack
      if (localVideoRef.current && track) {
        localVideoRef.current.srcObject = new MediaStream([track])
      }
    } else {
      const screenTrack = participant.tracks?.screenVideo?.persistentTrack
      const screenState = participant.tracks?.screenVideo?.state
      const videoTrack = participant.tracks?.video?.persistentTrack
      const audioTrack = participant.tracks?.audio?.persistentTrack

      if (remoteVideoRef.current) {
        if (screenTrack && screenState === 'playable') {
          remoteVideoRef.current.srcObject = new MediaStream([screenTrack])
          setRemoteScreenSharing(true)
          if (remoteCameraRef.current && videoTrack) {
            remoteCameraRef.current.srcObject = new MediaStream([videoTrack])
          }
        } else if (videoTrack) {
          remoteVideoRef.current.srcObject = new MediaStream([videoTrack])
          setRemoteScreenSharing(false)
          if (remoteCameraRef.current) {
            remoteCameraRef.current.srcObject = null
          }
        }
      }
      if (remoteAudioRef.current && audioTrack) {
        remoteAudioRef.current.srcObject = new MediaStream([audioTrack])
      }
      const screenAudioTrack = participant.tracks?.screenAudio?.persistentTrack
      const screenAudioState = participant.tracks?.screenAudio?.state
      if (screenAudioRef.current) {
        if (screenAudioTrack && screenAudioState === 'playable') {
          screenAudioRef.current.srcObject = new MediaStream([screenAudioTrack])
        } else {
          screenAudioRef.current.srcObject = null
        }
      }
    }
  }

  // ── Join the call ──
  const joinCall = useCallback(async () => {
    if (!displayName.trim() || !roomUrl) return
    setState(STATE.JOINING)

    const callObject = DailyIframe.createCallObject()
    callObjectRef.current = callObject

    callObject.on('joined-meeting', (event) => {
      hasJoinedRef.current = true
      setState(STATE.IN_CALL)
      startTimer()
      const local = event.participants?.local
      if (local) attachTracks(local)
    })

    callObject.on('participant-joined', (event) => {
      if (!event.participant.local) {
        setPartnerName(event.participant.user_name || 'Your partner')
      }
      attachTracks(event.participant)
    })

    callObject.on('participant-updated', (event) => {
      attachTracks(event.participant)
      if (event.participant.local) {
        const screenState = event.participant.tracks?.screenVideo?.state
        setIsScreenSharing(screenState === 'playable' || screenState === 'loading')
      }
    })

    callObject.on('track-started', (event) => {
      attachTracks(event.participant)
    })

    callObject.on('participant-left', (event) => {
      if (!event.participant.local) {
        setPartnerName('')
        setState(STATE.PARTNER_LEFT)
        clearInterval(timerRef.current)
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
      }
    })

    callObject.on('left-meeting', () => {
      clearInterval(timerRef.current)
      if (hasJoinedRef.current) navigate('/')
    })

    callObject.on('error', (e) => {
      setError(e.errorMsg || 'Call error')
      setState(STATE.ERROR)
    })

    try {
      await callObject.join({ url: roomUrl, userName: displayName.trim() })
    } catch (e) {
      console.error('join error full:', e)
      setError(e.message || e.errorMsg || JSON.stringify(e) || 'Unknown join error')
      setState(STATE.ERROR)
    }
  }, [displayName, roomUrl, navigate])

  // ── Controls ──
  function toggleMute() {
    callObjectRef.current?.setLocalAudio(isMuted)
    setIsMuted(!isMuted)
  }

  function toggleVideo() {
    callObjectRef.current?.setLocalVideo(isVideoOff)
    setIsVideoOff(!isVideoOff)
  }

  async function toggleScreenShare() {
    if (isScreenSharing) {
      callObjectRef.current?.stopScreenShare()
    } else {
      try {
        await callObjectRef.current?.startScreenShare({ screenAudioEnabled: true })
      } catch {
        // User cancelled the screen picker or permission denied
      }
    }
  }

  function onLocalCamPointerDown(e) {
    localCamDragging.current = true
    localCamDragOffset.current = { x: e.clientX - localCamPos.x, y: e.clientY - localCamPos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onLocalCamPointerMove(e) {
    if (!localCamDragging.current) return
    setLocalCamPos({ x: e.clientX - localCamDragOffset.current.x, y: e.clientY - localCamDragOffset.current.y })
  }
  function onLocalCamPointerUp() { localCamDragging.current = false }

  function onRemoteCamPointerDown(e) {
    remoteCamDragging.current = true
    remoteCamDragOffset.current = { x: e.clientX - remoteCamPos.x, y: e.clientY - remoteCamPos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onRemoteCamPointerMove(e) {
    if (!remoteCamDragging.current) return
    setRemoteCamPos({ x: e.clientX - remoteCamDragOffset.current.x, y: e.clientY - remoteCamDragOffset.current.y })
  }
  function onRemoteCamPointerUp() { remoteCamDragging.current = false }

  function onResizePointerDown(corner) {
    return (e) => {
      e.stopPropagation()
      resizing.current = true
      resizeStart.current = {
        x: e.clientX, y: e.clientY,
        width: remoteCamSize.width, height: remoteCamSize.height,
        posX: remoteCamPos.x, posY: remoteCamPos.y,
        corner,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  function onResizePointerMove(e) {
    if (!resizing.current) return
    const { x, y, width, height, posX, posY, corner } = resizeStart.current
    const dx = e.clientX - x
    const dy = e.clientY - y
    const maxW = Math.floor(window.innerWidth * 0.5)
    const maxH = Math.floor(window.innerHeight * 0.5)
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
    // Right edge and bottom edge stay fixed for left/top corners respectively
    const rightEdge = posX + width
    const bottomEdge = posY + height
    let newW, newH, newX = posX, newY = posY
    if (corner === 'br') {
      newW = clamp(width + dx, 200, maxW); newH = clamp(height + dy, 130, maxH)
    } else if (corner === 'bl') {
      newW = clamp(width - dx, 200, maxW); newH = clamp(height + dy, 130, maxH); newX = rightEdge - newW
    } else if (corner === 'tr') {
      newW = clamp(width + dx, 200, maxW); newH = clamp(height - dy, 130, maxH); newY = bottomEdge - newH
    } else {
      newW = clamp(width - dx, 200, maxW); newH = clamp(height - dy, 130, maxH); newX = rightEdge - newW; newY = bottomEdge - newH
    }
    setRemoteCamSize({ width: newW, height: newH })
    setRemoteCamPos({ x: newX, y: newY })
  }
  function onResizePointerUp() { resizing.current = false }

  async function leaveCall() {
    clearInterval(timerRef.current)
    await callObjectRef.current?.leave()
    navigate('/')
  }

  // Auto-dismiss "partner left" banner after 5s
  useEffect(() => {
    if (state === STATE.PARTNER_LEFT) {
      const t = setTimeout(() => setState(STATE.IN_CALL), 5000)
      return () => clearTimeout(t)
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      callObjectRef.current?.destroy()
    }
  }, [])

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

  const inCall = state === STATE.IN_CALL || state === STATE.PARTNER_LEFT

  function onPageMouseMove(e) {
    setControlsVisible(e.clientY > window.innerHeight - 120)
  }

  return (
    <div className={styles.page} onMouseMove={onPageMouseMove}>
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

      {/* ── Video area ── */}
      <div className={styles.videoArea} style={{ display: inCall || state === STATE.JOINING ? 'block' : 'none' }}>
        {/* Remote (full screen) */}
        <video
          ref={remoteVideoRef}
          className={`${styles.remoteVideo} ${remoteScreenSharing ? styles.remoteVideoContain : ''}`}
          autoPlay
          playsInline
        />
        {/* Hidden audio elements for remote participant */}
        <audio ref={remoteAudioRef} autoPlay />
        <audio ref={screenAudioRef} autoPlay />
        {/* Local (picture-in-picture) — draggable */}
        <video
          ref={localVideoRef}
          className={styles.localVideo}
          style={{ left: localCamPos.x, top: localCamPos.y }}
          autoPlay
          playsInline
          muted
          onPointerDown={onLocalCamPointerDown}
          onPointerMove={onLocalCamPointerMove}
          onPointerUp={onLocalCamPointerUp}
        />
        {/* Remote camera PiP during screen share — draggable + resizable */}
        <div
          className={styles.remoteCameraWrapper}
          style={{
            left: remoteCamPos.x,
            top: remoteCamPos.y,
            width: remoteCamSize.width,
            height: remoteCamSize.height,
            display: remoteScreenSharing ? 'block' : 'none',
          }}
          onPointerDown={onRemoteCamPointerDown}
          onPointerMove={onRemoteCamPointerMove}
          onPointerUp={onRemoteCamPointerUp}
        >
          <video ref={remoteCameraRef} className={styles.remoteCameraVideo} autoPlay playsInline />
          {['tl', 'tr', 'bl', 'br'].map(corner => (
            <div
              key={corner}
              className={`${styles.resizeHandle} ${styles['resizeHandle' + corner.toUpperCase()]}`}
              onPointerDown={onResizePointerDown(corner)}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            />
          ))}
        </div>
      </div>

      {/* ── Remote screen share badge ── */}
      {remoteScreenSharing && inCall && (
        <div className={styles.screenShareBadge}>
          🖥️ {partnerName || 'Your partner'} is sharing their screen
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
      {inCall && (
        <div className={styles.topBar}>
          <div className={styles.logo}>zen<span>tini</span></div>
          <div className={styles.callInfo}>
            {partnerName ? (
              <div className={styles.partnerTag}>
                <div className={styles.onlineDot} />
                {partnerName}
              </div>
            ) : (
              <div className={styles.waitingTag}>
                ⏳ Waiting for your partner...
              </div>
            )}
          </div>
          <div className={styles.timer}>{formatDuration(duration)}</div>
        </div>
      )}

      {/* ── CONTROLS ── */}
      {inCall && (
        <div className={`${styles.controls} ${controlsVisible ? styles.controlsVisible : ''}`}>
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
              className={`${styles.ctrlBtn} ${isScreenSharing ? styles.ctrlBtnOn : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? '📤' : '🖥️'}
              <span>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</span>
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
