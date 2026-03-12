import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileText, Download, Upload } from 'lucide-react';
import { cases, sessions, recordings, caucus, documents } from '../api/client';
import JitsiEmbed from '../components/JitsiEmbed';

const PREFERRED_FORMAT_LABELS = { in_person: 'In-person', video: 'Video', phone: 'Phone', hybrid: 'Hybrid' };
const DESIRED_OUTCOME_LABELS = { settlement: 'Settlement', apology: 'Apology', restitution: 'Restitution', relationship_repair: 'Relationship repair', other: 'Other' };
const DURATION_LABELS = { '1_session': '1 session', '2_3_sessions': '2–3 sessions', '4_plus_sessions': '4+ sessions', ongoing: 'Ongoing' };
const CONFIDENTIALITY_LABELS = { public: 'Public', parties_only: 'Parties Only', mediator_only: 'Mediator Only' };

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

  const loadCase = () => cases.get(id).then(({ data }) => {
    setCaseData(data);
    setCaseDocuments(data.documents || []);
  }).catch(() => setCaseData(null));
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
      setRoomInfo({ roomName: roomRes.data.room_name, domain: roomRes.data.jitsi_domain, jwt: roomRes.data.jwt, jaasAppId: roomRes.data.jaas_app_id, sessionId: data.id });
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

  const handleDocumentClick = async (doc) => {
    try {
      const { data } = await documents.download(doc.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      const isPdf = (doc.mime_type || '').includes('pdf');
      if (isPdf) {
        window.open(url, '_blank');
      } else {
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to download');
    }
  };

  const openCaucus = async (party) => {
    try {
      const { data } = await caucus.getRoom(roomInfo.sessionId, party);
      setCaucusRoom({ roomName: data.room_name, domain: data.jitsi_domain, jwt: data.jwt, jaasAppId: data.jaas_app_id });
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
        {caseData.status?.toLowerCase() === 'draft' && (
          <Link to={`/cases/${id}/edit`} className="edit-draft-btn">Edit</Link>
        )}
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
            jwt={roomInfo.jwt}
            jaasAppId={roomInfo.jaasAppId}
            displayName="Mediator"
          />
        </div>
      ) : (
        <div className="case-detail-layout">
          {/* Documents sidebar - left */}
          <aside className="case-documents-sidebar">
            <div className="documents-box">
              <h3>Documents</h3>
              <div className="doc-upload-area">
                <label className="doc-upload-label">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.csv"
                    className="doc-upload-input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingDoc(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('case_id', id);
                        const { data } = await documents.upload(fd);
                        setCaseDocuments((prev) => [...prev, { id: data.id, file_name: data.filename, mime_type: file.type || 'application/octet-stream', created_at: new Date().toISOString() }]);
                      } catch (err) {
                        alert(err.response?.data?.detail || 'Upload failed');
                      } finally {
                        setUploadingDoc(false);
                        e.target.value = '';
                      }
                    }}
                    disabled={uploadingDoc}
                  />
                  <span className="doc-upload-btn"><Upload size={16} /> {uploadingDoc ? 'Uploading...' : 'Add document'}</span>
                </label>
              </div>
              <ul className="doc-list">
                {caseDocuments.length > 0 ? (
                  caseDocuments.map((d) => (
                    <li key={d.id}>
                      <button type="button" className="doc-link" onClick={() => handleDocumentClick(d)} title="Click to view or download">
                        <FileText size={16} />
                        <span>{d.file_name}</span>
                        <Download size={14} className="doc-download-icon" />
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="doc-empty">No documents yet</li>
                )}
              </ul>
            </div>
          </aside>

          {/* Case information - right */}
          <main className="case-detail-main">
            <section className="case-info-section">
              <h3>Case Details</h3>
              <dl className="case-info-grid">
                <dt>Internal reference</dt>
                <dd>{caseData.internal_reference || '—'}</dd>
                <dt>Title</dt>
                <dd>{caseData.title || caseData.case_number}</dd>
                <dt>Case type</dt>
                <dd>{caseData.case_type || caseData.dispute_category || '—'}{caseData.case_type_other ? ` (${caseData.case_type_other})` : ''}</dd>
                <dt>Description</dt>
                <dd>{caseData.short_description || '—'}</dd>
                <dt>Priority</dt>
                <dd>{caseData.priority_level ? caseData.priority_level.charAt(0).toUpperCase() + caseData.priority_level.slice(1) : '—'}</dd>
                <dt>Jurisdiction</dt>
                <dd>{[caseData.jurisdiction_country, caseData.jurisdiction_region, caseData.jurisdiction_county_state].filter(Boolean).join(' / ') || '—'}</dd>
                <dt>Confidentiality</dt>
                <dd>{caseData.confidentiality_level ? (CONFIDENTIALITY_LABELS[caseData.confidentiality_level] || caseData.confidentiality_level) : '—'}</dd>
                <dt>Estimated duration</dt>
                <dd>{caseData.estimated_duration ? (DURATION_LABELS[caseData.estimated_duration] || caseData.estimated_duration) : '—'}</dd>
                <dt>Preferred format</dt>
                <dd>{caseData.preferred_format?.length ? caseData.preferred_format.map((f) => PREFERRED_FORMAT_LABELS[f] || f).join(', ') : '—'}</dd>
                {caseData.tags?.length > 0 && (
                  <>
                    <dt>Tags</dt>
                    <dd><span className="case-tags">{caseData.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span></dd>
                  </>
                )}
              </dl>
            </section>

            {caseData.detailed_narrative && (
              <section className="case-info-section">
                <h3>Detailed narrative</h3>
                <p className="case-narrative">{caseData.detailed_narrative}</p>
              </section>
            )}

            {((caseData.desired_outcome && caseData.desired_outcome.trim()) || (caseData.desired_outcome_structured?.length > 0)) && (
              <section className="case-info-section">
                <h3>Desired outcome</h3>
                {caseData.desired_outcome && <p>{caseData.desired_outcome}</p>}
                {caseData.desired_outcome_structured?.length > 0 && (
                  <ul className="outcome-list">
                    {caseData.desired_outcome_structured.map((o) => (
                      <li key={o}>{DESIRED_OUTCOME_LABELS[o] || o}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {caseData.applicable_laws && (
              <section className="case-info-section">
                <h3>Applicable laws</h3>
                <p>{caseData.applicable_laws}</p>
              </section>
            )}

            {caseData.cultural_considerations && (
              <section className="case-info-section">
                <h3>Cultural considerations</h3>
                <p>{caseData.cultural_considerations}</p>
              </section>
            )}

            {caseData.parties?.length > 0 && (
              <section className="case-info-section">
                <h3>Parties involved</h3>
                <ul className="party-list">
                  {caseData.parties.map((p, i) => (
                    <li key={i} className="party-item">
                      <strong>{p.name}</strong> <span className="party-role">({p.role})</span>
                      {(p.email || p.phone || p.whatsapp || p.country_location) && (
                        <div className="party-contact">
                          {p.email && <span>{p.email}</span>}
                          {p.phone && <span>{p.phone}</span>}
                          {p.whatsapp && <span>WhatsApp: {p.whatsapp}</span>}
                          {p.country_location && <span>{p.country_location}</span>}
                          {p.language_preference && <span>Lang: {p.language_preference}</span>}
                          {p.relationship_to_case && <span>Relationship: {p.relationship_to_case}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {caseData.timeline?.length > 0 && (
              <section className="case-info-section">
                <h3>Timeline</h3>
                <ul className="timeline-list">
                  {caseData.timeline.map((e, i) => (
                    <li key={i}>
                      <strong>{e.event_date}</strong>: {e.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {caseData.external_links?.length > 0 && (
              <section className="case-info-section">
                <h3>External links</h3>
                <ul className="link-list">
                  {caseData.external_links.map((l, i) => (
                    <li key={i}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label || l.url}</a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {caseData.additional_notes && (
              <section className="case-info-section">
                <h3>Additional notes</h3>
                <p>{caseData.additional_notes}</p>
              </section>
            )}

            {sessionList.length > 0 && (
              <section className="case-info-section">
                <h3>Session history</h3>
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

            <section className="case-actions">
              <button onClick={startSession} className="primary btn-start-session">Start Mediation Session</button>
            </section>
          </main>
        </div>
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
                jwt={caucusRoom.jwt}
                jaasAppId={caucusRoom.jaasAppId}
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
