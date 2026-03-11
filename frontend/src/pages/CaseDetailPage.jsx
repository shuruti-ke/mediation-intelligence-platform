import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cases, sessions, recordings, caucus, documents } from '../api/client';
import JitsiEmbed from '../components/JitsiEmbed';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [sessionList, setSessionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRoom, setShowRoom] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showCaucusModal, setShowCaucusModal] = useState(false);
  const [caucusRoom, setCaucusRoom] = useState(null);
  const [caseDocuments, setCaseDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadCase = () => cases.get(id).then(({ data }) => setCaseData(data)).catch(() => setCaseData(null));
  const loadSessions = () => sessions.listForCase(id).then(({ data }) => setSessionList(data)).catch(() => setSessionList([]));

  useEffect(() => {
    if (!id) return;
    loadCase();
    loadSessions();
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'ACTIVE') return;
    const start = currentSession.started_at ? new Date(currentSession.started_at).getTime() : Date.now();
    const interval = setInterval(() => {
      setSessionTimer(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentSession]);

  const startSession = async () => {
    try {
      const { data } = await sessions.create({ case_id: id });
      await sessions.start(data.id);
      const roomRes = await sessions.getRoom(data.id);
      setCurrentSession({ ...data, status: 'ACTIVE', started_at: new Date().toISOString() });
      setRoomInfo({ roomName: roomRes.data.room_name, domain: roomRes.data.jitsi_domain, sessionId: data.id });
      setShowRoom(true);
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!roomInfo?.sessionId) return;
    try {
      if (isRecording) {
        await recordings.stop(roomInfo.sessionId);
        setIsRecording(false);
      }
      await sessions.end(roomInfo.sessionId);
      setShowRoom(false);
      setRoomInfo(null);
      setCurrentSession(null);
      setSessionTimer(0);
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to end session');
    }
  };

  const handleStartRecording = () => {
    setShowConsentModal(true);
  };

  const confirmRecording = async () => {
    if (!consentChecked || !roomInfo?.sessionId) return;
    try {
      await recordings.start(roomInfo.sessionId, true);
      setIsRecording(true);
      setShowConsentModal(false);
      setConsentChecked(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    if (!roomInfo?.sessionId) return;
    try {
      await recordings.stop(roomInfo.sessionId);
      setIsRecording(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to stop recording');
    }
  };

  const openCaucus = async (party) => {
    try {
      const { data } = await caucus.getRoom(roomInfo.sessionId, party);
      setCaucusRoom({ roomName: data.room_name, domain: data.jitsi_domain });
      setShowCaucusModal(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to get caucus room');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!caseData) return <p>Case not found</p>;

  return (
    <div className="case-detail">
      <header>
        <button onClick={() => navigate('/dashboard')}>← Back</button>
        <h1>{caseData.case_number}</h1>
        <span className={`status-badge ${caseData.status.toLowerCase()}`}>{caseData.status}</span>
      </header>

      {showRoom && roomInfo ? (
        <div className="mediation-room">
          <div className="room-toolbar">
            <div className="session-timer">
              <span className="timer-label">Session</span>
              <span className="timer-value">{formatDuration(sessionTimer)}</span>
            </div>
            <div className="room-actions">
              {!isRecording ? (
                <button onClick={handleStartRecording} className="btn-record">Start Recording</button>
              ) : (
                <button onClick={handleStopRecording} className="btn-record active">Stop Recording</button>
              )}
              <button onClick={() => openCaucus('party_a')} className="btn-caucus">Caucus Party A</button>
              <button onClick={() => openCaucus('party_b')} className="btn-caucus">Caucus Party B</button>
              <button onClick={endSession} className="leave-btn">End Session</button>
            </div>
          </div>
          <JitsiEmbed
            roomName={roomInfo.roomName}
            domain={roomInfo.domain}
            displayName="Mediator"
          />
        </div>
      ) : (
        <>
          <section>
            <p><strong>Dispute category:</strong> {caseData.dispute_category || '-'}</p>
          </section>
          <section>
            <h3>Documents</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.target.querySelector('input[type="file"]');
              if (!input?.files?.[0]) return;
              setUploadingDoc(true);
              try {
                const fd = new FormData();
                fd.append('file', input.files[0]);
                fd.append('case_id', id);
                await documents.upload(fd);
                input.value = '';
              } catch (err) {
                alert(err.response?.data?.detail || 'Upload failed');
              } finally {
                setUploadingDoc(false);
              }
            }}>
              <input type="file" accept=".pdf,.docx,.doc,.txt" />
              <button type="submit" disabled={uploadingDoc}>Upload</button>
            </form>
          </section>
          {sessionList.length > 0 && (
            <section>
              <h3>Session History</h3>
              <ul className="session-list">
                {sessionList.map((s) => (
                  <li key={s.id}>
                    <span>{new Date(s.created_at).toLocaleString()}</span>
                    <span className={`status-badge ${s.status?.toLowerCase()}`}>{s.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <button onClick={startSession} className="primary">Start Mediation Session</button>
          </section>
        </>
      )}

      {showConsentModal && (
        <div className="modal-overlay" onClick={() => setShowConsentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Recording Consent</h3>
            <p>Before recording, all participants must consent. By starting the recording, you confirm that:</p>
            <ul>
              <li>All parties have been informed that the session will be recorded</li>
              <li>Consent has been obtained from all participants</li>
              <li>Recording will be stored securely and used only as permitted</li>
            </ul>
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              I confirm that all participants have consented to this recording
            </label>
            <div className="modal-actions">
              <button onClick={() => { setShowConsentModal(false); setConsentChecked(false); }}>Cancel</button>
              <button onClick={confirmRecording} disabled={!consentChecked} className="primary">Start Recording</button>
            </div>
          </div>
        </div>
      )}

      {showCaucusModal && caucusRoom && (
        <div className="modal-overlay" onClick={() => setShowCaucusModal(false)}>
          <div className="modal modal-caucus" onClick={(e) => e.stopPropagation()}>
            <h3>Caucus Room</h3>
            <p>Share this room with the party for private discussion. You can join as mediator.</p>
            <div className="caucus-room-embed">
              <JitsiEmbed
                roomName={caucusRoom.roomName}
                domain={caucusRoom.domain}
                displayName="Mediator"
              />
            </div>
            <button onClick={() => { setShowCaucusModal(false); setCaucusRoom(null); }} className="leave-btn">Close Caucus</button>
          </div>
        </div>
      )}
    </div>
  );
}
