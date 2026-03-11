import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarApi } from '../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = last.getDate();
  const pad = Array(startPad).fill(null);
  return [...pad, ...Array.from({ length: days }, (_, i) => i + 1)];
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [mediators, setMediators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add-slot' | 'book' | null
  const [form, setForm] = useState({ slot_date: '', start_time: '09:00', end_time: '10:00', mediator_id: '', meeting_type: 'consultation' });

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
    } catch { setUser(null); }
  }, []);

  const isMediator = user?.role && ['mediator', 'trainee', 'super_admin'].includes(user.role);
  const isClient = user?.role && ['client_corporate', 'client_individual'].includes(user.role);

  useEffect(() => {
    const from = new Date(current.year, current.month, 1);
    const to = new Date(current.year, current.month + 1, 0);
    Promise.all([
      calendarApi.listAvailability({ from_date: formatDate(from), to_date: formatDate(to) }).then(r => r.data).catch(() => []),
      calendarApi.listBookings({ from_date: formatDate(from), to_date: formatDate(to) }).then(r => r.data).catch(() => []),
      isClient ? calendarApi.listMediators().then(r => r.data).catch(() => []) : Promise.resolve([]),
    ]).then(([av, bk, med]) => {
      setAvailability(av);
      setBookings(bk);
      setMediators(med);
    }).finally(() => setLoading(false));
  }, [current.year, current.month, isClient]);

  const handlePrevMonth = () => {
    setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  };
  const handleNextMonth = () => {
    setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!form.slot_date || !form.start_time || !form.end_time) return;
    try {
      await calendarApi.createAvailability({
        slot_date: form.slot_date,
        start_time: form.start_time,
        end_time: form.end_time,
      });
      setModal(null);
      setForm({ slot_date: '', start_time: '09:00', end_time: '10:00' });
      const from = new Date(current.year, current.month, 1);
      const to = new Date(current.year, current.month + 1, 0);
      calendarApi.listAvailability({ from_date: formatDate(from), to_date: formatDate(to) }).then(r => setAvailability(r.data));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add slot');
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!form.slot_date || !form.start_time || !form.end_time || !form.mediator_id) return;
    try {
      await calendarApi.createBooking({
        mediator_id: form.mediator_id,
        slot_date: form.slot_date,
        start_time: form.start_time,
        end_time: form.end_time,
        meeting_type: form.meeting_type,
      });
      setModal(null);
      setForm({ mediator_id: '', slot_date: '', start_time: '09:00', end_time: '10:00', meeting_type: 'consultation' });
      const from = new Date(current.year, current.month, 1);
      const to = new Date(current.year, current.month + 1, 0);
      calendarApi.listBookings({ from_date: formatDate(from), to_date: formatDate(to) }).then(r => setBookings(r.data));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to book');
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!confirm('Remove this availability slot?')) return;
    try {
      await calendarApi.deleteAvailability(id);
      setAvailability(availability.filter(a => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const days = getDaysInMonth(current.year, current.month);
  const availByDate = availability.reduce((acc, a) => {
    if (!acc[a.slot_date]) acc[a.slot_date] = [];
    acc[a.slot_date].push(a);
    return acc;
  }, {});
  const bookingsByDate = bookings.reduce((acc, b) => {
    if (!acc[b.slot_date]) acc[b.slot_date] = [];
    acc[b.slot_date].push(b);
    return acc;
  }, {});

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <div className="calendar-brand">
          <Link to={user?.role === 'super_admin' ? '/admin' : isMediator ? '/dashboard' : '/client'}><ArrowLeft size={16} /> Back</Link>
          <h1>Calendar</h1>
        </div>
        <div className="calendar-actions">
          {isMediator && (
            <button className="btn-primary" onClick={() => setModal('add-slot')}>
              <CalendarPlus size={16} /> Add availability
            </button>
          )}
          {isClient && mediators.length > 0 && (
            <button className="btn-primary" onClick={() => setModal('book')}>
              <CalendarCheck size={16} /> Book a session
            </button>
          )}
        </div>
      </header>

      <div className="calendar-nav">
        <button onClick={handlePrevMonth}><ChevronLeft size={20} /></button>
        <h2>{MONTHS[current.month]} {current.year}</h2>
        <button onClick={handleNextMonth}><ChevronRight size={20} /></button>
      </div>

      {loading ? (
        <div className="calendar-loading"><div className="loading-spinner" /> Loading...</div>
      ) : (
        <div className="calendar-grid">
          {DAYS.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
          {days.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="calendar-cell empty" />;
            const d = new Date(current.year, current.month, day);
            const key = formatDate(d);
            const av = availByDate[key] || [];
            const bk = bookingsByDate[key] || [];
            const isToday = formatDate(new Date()) === key;
            return (
              <div key={key} className={`calendar-cell ${isToday ? 'today' : ''}`}>
                <span className="cell-date">{day}</span>
                <div className="cell-slots">
                  {av.map(a => (
                    <div key={a.id} className="slot avail">
                      {a.start_time}–{a.end_time}
                      {isMediator && (
                        <button className="slot-delete" onClick={() => handleDeleteSlot(a.id)} title="Remove">×</button>
                      )}
                    </div>
                  ))}
                  {bk.map(b => (
                    <div key={b.id} className={`slot booking ${b.status}`}>
                      {b.start_time} {b.meeting_type}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="calendar-legend">
        <span><span className="legend-dot avail" /> Available</span>
        <span><span className="legend-dot booking" /> Booked</span>
      </div>

      {modal === 'add-slot' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card calendar-modal" onClick={e => e.stopPropagation()}>
            <h3>Add availability</h3>
            <form onSubmit={handleAddSlot}>
              <label>Date</label>
              <input type="date" value={form.slot_date} onChange={e => setForm({ ...form, slot_date: e.target.value })} required />
              <label>Start</label>
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              <label>End</label>
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="primary">Add slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'book' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card calendar-modal" onClick={e => e.stopPropagation()}>
            <h3>Book a session</h3>
            <form onSubmit={handleBook}>
              <label>Mediator</label>
              <select value={form.mediator_id} onChange={e => setForm({ ...form, mediator_id: e.target.value })} required>
                <option value="">Select mediator</option>
                {mediators.map(m => <option key={m.id} value={m.id}>{m.display_name || m.email}</option>)}
              </select>
              <label>Date</label>
              <input type="date" value={form.slot_date} onChange={e => setForm({ ...form, slot_date: e.target.value })} required />
              <label>Start</label>
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              <label>End</label>
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              <label>Type</label>
              <select value={form.meeting_type} onChange={e => setForm({ ...form, meeting_type: e.target.value })}>
                <option value="consultation">Consultation</option>
                <option value="mediation">Mediation</option>
                <option value="training">Training</option>
              </select>
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="primary">Book</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
