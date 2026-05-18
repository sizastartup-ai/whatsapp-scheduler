import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Calendar, Image as ImageIcon, Video, Clock,
  CheckCircle2, Trash2, QrCode, Loader2, Bell, BellRing,
  ClipboardCopy, Check, ExternalLink, Wifi, WifiOff
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const SERVER_BASE = import.meta.env.DEV ? 'http://localhost:5000' : '';
const API_BASE = `${SERVER_BASE}/api`;

const getMediaUrl = (mediaPath) => {
  if (!mediaPath) return '';
  const normalized = mediaPath.replace(/\\/g, '/');
  const webPath = normalized.startsWith('data/uploads/') 
    ? normalized.replace('data/uploads/', 'uploads/') 
    : normalized;
  return `${SERVER_BASE}/${webPath}`;
};

// Request browser notification permission
const requestNotifPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Fire a browser notification
const fireNotification = (title, body, icon) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon });
    n.onclick = () => window.focus();
  }
};

export default function App() {
  const [waStatus, setWaStatus] = useState({ connected: false, qr: null });
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [formData, setFormData] = useState({ caption: '', scheduledTime: '', type: 'image', media: null });
  const prevReadyIds = useRef(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/wa-status`);
      setWaStatus(res.data);
    } catch {}
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/schedules`);
      const data = res.data;

      // Detect newly-ready items and fire notifications
      const readyItems = data.filter(s => s.status === 'ready');
      readyItems.forEach(item => {
        if (!prevReadyIds.current.has(item.id)) {
          prevReadyIds.current.add(item.id);
          fireNotification(
            '⏰ Time to Post Your Status!',
            item.caption || 'Your scheduled WhatsApp Status is ready to post.',
            '/vite.svg'
          );
        }
      });

      setSchedules(data);
    } catch {}
  }, []);

  useEffect(() => {
    requestNotifPermission();
    fetchStatus();
    fetchSchedules();
    const interval = setInterval(() => {
      fetchStatus();
      fetchSchedules();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSchedules]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.media || !formData.scheduledTime) return;
    setLoading(true);
    const data = new FormData();
    data.append('caption', formData.caption);
    const isoTime = new Date(formData.scheduledTime).toISOString();
    data.append('scheduledTime', isoTime);
    data.append('type', formData.type);
    data.append('media', formData.media);
    try {
      await axios.post(`${API_BASE}/schedule`, data);
      setFormData({ caption: '', scheduledTime: '', type: 'image', media: null });
      fetchSchedules();
    } catch { alert('Failed to schedule'); }
    finally { setLoading(false); }
  };

  const deleteSchedule = async (id) => {
    if (!confirm('Delete this schedule?')) return;
    await axios.delete(`${API_BASE}/schedule/${id}`);
    fetchSchedules();
  };

  const markDone = async (id) => {
    await axios.patch(`${API_BASE}/schedule/${id}/done`);
    prevReadyIds.current.delete(id);
    fetchSchedules();
  };

  const copyCaption = (id, caption) => {
    navigator.clipboard.writeText(caption || '');
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const readyItems = schedules.filter(s => s.status === 'ready');
  const otherItems = schedules.filter(s => s.status !== 'ready').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ minHeight: '100vh', padding: '4rem 3rem', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div className="icon-badge icon-badge--primary float-icon">
              <Bell size={28} />
            </div>
            <h1 className="brand-title">Status<span style={{ color: 'var(--primary)' }}>Flow</span></h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Your smart WhatsApp status reminder system</p>
        </div>

        <div className={`status-pill ${waStatus.connected ? 'status-pill--online' : 'status-pill--offline'}`}>
          <div className={`status-dot ${waStatus.connected ? 'status-dot--online' : 'status-dot--offline'}`} />
          <span>{waStatus.connected ? 'System Online' : 'System Offline'}</span>
          {waStatus.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        </div>
      </header>

      {/* READY TO POST — Alert Banner */}
      {readyItems.length > 0 && (
        <div className="ready-banner">
          <div className="ready-banner__pulse" />
          <BellRing size={24} className="ready-banner__icon" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {readyItems.length} Status Update{readyItems.length > 1 ? 's' : ''} Ready to Post!
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8, marginTop: '0.25rem' }}>
              Copy the content below, then post it manually on your WhatsApp Status.
            </p>
          </div>
        </div>
      )}

      {/* Ready Cards */}
      {readyItems.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <div className="section-heading">
            <div className="section-heading__bar section-heading__bar--ready" />
            <BellRing size={18} style={{ color: 'var(--warning)' }} />
            <span>Post These Now</span>
          </div>

          {/* Step-by-step guide */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { n: '1', label: 'Download the media file below' },
              { n: '2', label: 'Copy the caption' },
              { n: '3', label: 'Open WhatsApp → Status → Add' },
              { n: '4', label: 'Upload file, paste caption, post!' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--warning)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, flexShrink: 0 }}>{step.n}</span>
                {step.label}
              </div>
            ))}
          </div>

          <div className="cards-grid">
            {readyItems.map(item => (
              <div key={item.id} className="card card--ready">
                <div className="card__media">
                  {item.type === 'image'
                    ? <img src={getMediaUrl(item.mediaPath)} alt="" className="card__img" />
                    : <video src={getMediaUrl(item.mediaPath)} className="card__img" muted autoPlay loop />
                  }
                  <div className="card__badge card__badge--ready">⏰ Post Now</div>
                </div>
                <div className="card__body">
                  <p className="card__caption">{item.caption || <em style={{ opacity: 0.4 }}>No caption</em>}</p>
                  <div className="card__actions">
                    {/* Download button */}
                    <a
                      href={getMediaUrl(item.mediaPath)}
                      download
                      className="btn btn--download"
                    >
                      ⬇ Download {item.type === 'image' ? 'Image' : 'Video'}
                    </a>
                    <button className="btn btn--copy" onClick={() => copyCaption(item.id, item.caption)}>
                      {copied === item.id ? <Check size={16} /> : <ClipboardCopy size={16} />}
                      {copied === item.id ? 'Copied!' : 'Copy Caption'}
                    </button>
                    <a
                      href="https://web.whatsapp.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--whatsapp"
                    >
                      <ExternalLink size={16} /> Open WhatsApp Web
                    </a>
                  </div>
                  <button className="btn btn--done" onClick={() => markDone(item.id)}>
                    <CheckCircle2 size={16} /> Mark as Posted
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left: Form */}
        <div className="sidebar">
          {/* QR Code or Offline State */}
          {!waStatus.connected && (
            <div className="glass-panel card--pad">
              <div className="section-heading" style={{ marginBottom: '1.5rem' }}>
                <div className="icon-badge icon-badge--primary"><QrCode size={18} /></div>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {waStatus.qr ? 'Scan to Link' : 'Connecting to Server...'}
                </span>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                {waStatus.qr ? (
                  <img src={waStatus.qr} alt="QR Code" style={{ width: '200px', height: '200px' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#64748b' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Please wait...</p>
                  </div>
                )}
              </div>
              {waStatus.qr && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
              )}
            </div>
          )}

          <div className="glass-panel card--pad">
            <div className="section-heading" style={{ marginBottom: '2rem' }}>
              <div className="icon-badge icon-badge--accent"><Plus size={18} /></div>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>New Reminder</span>
            </div>

            <form onSubmit={handleUpload} className="form-stack">
              <div>
                <label className="form-label">Media Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {['image', 'video'].map(t => (
                    <button key={t} type="button" onClick={() => setFormData({ ...formData, type: t })}
                      className={`type-btn ${formData.type === t ? 'type-btn--active' : ''}`}>
                      {t === 'image' ? <ImageIcon size={18} /> : <Video size={18} />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Caption / Text</label>
                <textarea rows={4} value={formData.caption}
                  onChange={e => setFormData({ ...formData, caption: e.target.value })}
                  placeholder="What's your status update?" className="form-textarea" />
              </div>

              <div>
                <label className="form-label">Schedule Time</label>
                <div style={{ position: 'relative' }}>
                  <input type="datetime-local" value={formData.scheduledTime}
                    onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="form-input form-input--icon" />
                  <Clock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>

              <div>
                <label className="form-label">Media File</label>
                <label className="file-drop">
                  <Plus size={22} style={{ color: 'var(--text-muted)' }} />
                  <span className="file-drop__text">
                    {formData.media ? formData.media.name : 'Choose image or video'}
                  </span>
                  <input type="file" className="file-input"
                    accept={formData.type === 'image' ? 'image/*' : 'video/*'}
                    onChange={e => setFormData({ ...formData, media: e.target.files[0] })} />
                </label>
              </div>

              <button type="submit" disabled={loading || !formData.media || !formData.scheduledTime}
                className="btn btn--primary btn--full">
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={18} />}
                Set Reminder
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                You'll get a browser notification when it's time to post ✓
              </p>
            </form>
          </div>
        </div>

        {/* Right: History */}
        <div className="feed">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div className="section-heading">
              <div className="section-heading__bar section-heading__bar--primary" />
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>Schedule History</h2>
            </div>
            <div className="count-badge">{schedules.length} TOTAL</div>
          </div>

          {otherItems.length === 0 && readyItems.length === 0 ? (
            <div className="glass-panel empty-state">
              <Clock size={52} style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
              <h3 style={{ margin: '1rem 0 0.5rem' }}>Nothing scheduled yet</h3>
              <p style={{ color: 'var(--text-muted)' }}>Add your first reminder using the form on the left.</p>
            </div>
          ) : (
            <div className="cards-grid">
              {otherItems.map((item, i) => (
                <div key={item.id} className="card" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="card__media">
                    {item.type === 'image'
                      ? <img src={getMediaUrl(item.mediaPath)} alt="" className="card__img" />
                      : <video src={getMediaUrl(item.mediaPath)} className="card__img" muted loop />
                    }
                    <div className={`card__badge ${
                      item.status === 'posted' ? 'card__badge--posted' :
                      item.status === 'pending' ? 'card__badge--pending' : 'card__badge--pending'
                    }`}>
                      {item.status === 'posted' ? '✓ Posted' : `⏳ ${format(new Date(item.scheduledTime), 'MMM d, HH:mm')}`}
                    </div>
                    <button onClick={() => deleteSchedule(item.id)} className="card__delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="card__body">
                    <p className="card__caption">{item.caption || <em style={{ opacity: 0.4 }}>No caption</em>}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} style={{ color: 'var(--primary)' }} />
                        {format(new Date(item.scheduledTime), 'MMM d, yyyy • HH:mm')}
                      </span>
                      {item.postedAt && (
                        <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Posted {formatDistanceToNow(new Date(item.postedAt))} ago
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        :root {
          --primary: #25D366;
          --primary-glow: rgba(37,211,102,0.3);
          --accent: #3b82f6;
          --accent-glow: rgba(59,130,246,0.3);
          --warning: #f59e0b;
          --warning-glow: rgba(245,158,11,0.3);
          --success: #10b981;
          --error: #f43f5e;
          --bg: #020617;
          --card-bg: rgba(15,23,42,0.8);
          --border: rgba(255,255,255,0.08);
          --text-muted: #94a3b8;
        }

        /* Layout */
        .main-layout { display: grid; grid-template-columns: 380px 1fr; gap: 3rem; align-items: start; }
        @media (max-width: 960px) { .main-layout { grid-template-columns: 1fr; } }
        .sidebar { display: flex; flex-direction: column; gap: 2rem; }
        .feed {}
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }

        /* Glass Panel */
        .glass-panel {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          backdrop-filter: blur(24px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .card--pad { padding: 2rem; }

        /* Brand */
        .brand-title { font-size: 3rem; font-weight: 900; color: white; letter-spacing: -0.03em; margin: 0; }

        /* Status Pill */
        .status-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; border-radius: 999px; border: 1px solid; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; backdrop-filter: blur(12px); }
        .status-pill--online { border-color: rgba(37,211,102,0.4); color: var(--primary); background: rgba(37,211,102,0.05); }
        .status-pill--offline { border-color: rgba(244,63,94,0.4); color: var(--error); background: rgba(244,63,94,0.05); }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; }
        .status-dot--online { background: var(--primary); box-shadow: 0 0 10px var(--primary-glow); animation: pulse 2s infinite; }
        .status-dot--offline { background: var(--error); }

        /* Ready Banner */
        .ready-banner {
          position: relative; display: flex; align-items: center; gap: 1rem;
          background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%);
          border: 1px solid rgba(245,158,11,0.4); border-radius: 20px; padding: 1.5rem 2rem;
          margin-bottom: 2rem; overflow: hidden; color: white;
        }
        .ready-banner__pulse { position: absolute; inset: 0; border-radius: 20px; animation: banner-pulse 2s ease-in-out infinite; }
        @keyframes banner-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); } 50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); } }
        .ready-banner__icon { color: var(--warning); flex-shrink: 0; }

        /* Section Heading */
        .section-heading { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: white; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.05em; }
        .section-heading__bar { width: 18px; height: 3px; border-radius: 2px; }
        .section-heading__bar--primary { background: var(--primary); }
        .section-heading__bar--ready { background: var(--warning); }

        /* Icon Badge */
        .icon-badge { padding: 0.6rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .icon-badge--primary { background: rgba(37,211,102,0.15); color: var(--primary); }
        .icon-badge--accent { background: rgba(59,130,246,0.15); color: var(--accent); }
        .float-icon { animation: float 4s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        /* Card */
        .card {
          background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px;
          overflow: hidden; transition: border-color 0.3s, box-shadow 0.3s;
          animation: fadeUp 0.5s ease-out both;
        }
        .card:hover { border-color: rgba(255,255,255,0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .card--ready { border-color: rgba(245,158,11,0.5) !important; box-shadow: 0 0 30px rgba(245,158,11,0.15) !important; }
        .card__media { position: relative; height: 200px; overflow: hidden; background: #0f172a; }
        .card__img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
        .card:hover .card__img { transform: scale(1.05); }
        .card__badge { position: absolute; bottom: 10px; left: 10px; padding: 4px 12px; border-radius: 999px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; backdrop-filter: blur(12px); }
        .card__badge--ready { background: rgba(245,158,11,0.25); border: 1px solid rgba(245,158,11,0.5); color: var(--warning); }
        .card__badge--posted { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: var(--success); }
        .card__badge--pending { background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); color: #60a5fa; }
        .card__delete { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); border: none; border-radius: 10px; padding: 8px; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .card__delete:hover { background: rgba(244,63,94,0.2); color: var(--error); }
        .card__body { padding: 1.25rem; }
        .card__caption { color: #e2e8f0; font-size: 0.95rem; line-height: 1.6; margin: 0 0 0.75rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .card__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.1rem; border-radius: 12px; font-size: 0.85rem; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; font-family: inherit; }
        .btn--primary { background: linear-gradient(135deg, #25D366, #128C7E); color: #000; box-shadow: 0 8px 20px -4px var(--primary-glow); }
        .btn--primary:hover { transform: translateY(-2px); box-shadow: 0 12px 25px -4px var(--primary-glow); }
        .btn--primary:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
        .btn--full { width: 100%; justify-content: center; padding: 0.9rem; font-size: 1rem; }
        .btn--copy { background: rgba(255,255,255,0.07); color: white; border: 1px solid var(--border); }
        .btn--copy:hover { background: rgba(255,255,255,0.12); }
        .btn--whatsapp { background: rgba(37,211,102,0.15); color: var(--primary); border: 1px solid rgba(37,211,102,0.3); text-decoration: none; }
        .btn--whatsapp:hover { background: rgba(37,211,102,0.25); }
        .btn--done { width: 100%; justify-content: center; margin-top: 0.75rem; background: rgba(16,185,129,0.1); color: var(--success); border: 1px solid rgba(16,185,129,0.3); padding: 0.75rem; }
        .btn--done:hover { background: rgba(16,185,129,0.2); }
        .btn--download { background: rgba(245,158,11,0.15); color: var(--warning); border: 1px solid rgba(245,158,11,0.35); text-decoration: none; }
        .btn--download:hover { background: rgba(245,158,11,0.25); }

        /* Form */
        .form-stack { display: flex; flex-direction: column; gap: 1.5rem; }
        .form-label { display: block; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; }
        .form-input, .form-textarea { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 14px; color: white; padding: 0.9rem 1rem; font-family: inherit; font-size: 0.95rem; transition: all 0.2s; box-sizing: border-box; }
        .form-input--icon { padding-left: 2.5rem; }
        .form-input:focus, .form-textarea:focus { outline: none; border-color: var(--primary); background: rgba(255,255,255,0.07); box-shadow: 0 0 0 3px var(--primary-glow); }
        .form-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
        .type-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem; border-radius: 14px; border: 2px solid var(--border); background: transparent; color: var(--text-muted); font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .type-btn--active { border-color: var(--primary); background: rgba(37,211,102,0.1); color: var(--primary); }
        .file-drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 1.5rem; border: 2px dashed var(--border); border-radius: 16px; cursor: pointer; transition: all 0.2s; }
        .file-drop:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.03); }
        .file-drop__text { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .file-input { display: none; }

        /* Empty State */
        .empty-state { padding: 6rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: white; }

        /* Counter Badge */
        .count-badge { padding: 0.4rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em; color: var(--text-muted); }

        /* Animations */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
