import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import { FixedSizeList } from 'react-window';
import { LayoutDashboard, Users, Building2, BookOpen, Calendar, LogOut, BarChart3, UserPlus, Upload, Trash2, UserCog, MapPin, FileText, Download, X, GraduationCap, Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, FolderOpen, Search, Plus, MoreVertical, ArrowLeft, UserCircle } from 'lucide-react';
import GlobalSearch from '../components/GlobalSearch';
import { tenantsApi, usersApi, analyticsApi, knowledge, calendarApi, cases, auditApi, auth } from '../api/client';

const STATUS_BADGES = {
  active: { label: 'Active', class: 'badge-active' },
  pending: { label: 'Pending', class: 'badge-pending' },
  inactive: { label: 'Inactive', class: 'badge-inactive' },
};

const USER_TYPE_BADGES = {
  client_individual: { label: 'Individual', class: 'badge-teal' },
  client_corporate: { label: 'Corporate', class: 'badge-indigo' },
  mediator: { label: 'Mediator', class: 'badge-purple' },
  trainee: { label: 'Trainee', class: 'badge-pending' },
};

const DEACTIVATION_REASONS = [
  { value: 'inactive_user', label: 'Inactive user' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'user_requested', label: 'Requested by user' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Added' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'last_active', label: 'Last Active' },
];

const COUNTRIES = [
  { value: 'KE', label: 'Kenya (+254)', prefix: '254' },
  { value: 'NG', label: 'Nigeria (+234)', prefix: '234' },
  { value: 'ZA', label: 'South Africa (+27)', prefix: '27' },
  { value: 'GH', label: 'Ghana (+233)', prefix: '233' },
  { value: 'TZ', label: 'Tanzania (+255)', prefix: '255' },
  { value: 'UG', label: 'Uganda (+256)', prefix: '256' },
];

const REASSIGN_REASONS = [
  { value: 'conflict_of_interest', label: 'Conflict of Interest' },
  { value: 'user_request', label: 'User Request' },
  { value: 'workload', label: 'Workload' },
  { value: 'other', label: 'Other' },
];

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('dashboard');
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [mediators, setMediators] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [mediatorPerformance, setMediatorPerformance] = useState([]);
  const [geographic, setGeographic] = useState([]);
  const [unresolved, setUnresolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    user_type: 'individual',
    country: 'KE',
    password: '',
    invite_via_link: false,
  });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignUser, setReassignUser] = useState(null);
  const [reassignForm, setReassignForm] = useState({ mediator_id: '', reason: '', note: '', notify: true });
  const [orgDocs, setOrgDocs] = useState([]);
  const [orgUploadFile, setOrgUploadFile] = useState(null);
  const [orgUploadTitle, setOrgUploadTitle] = useState('');
  const [orgUploading, setOrgUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [viewDocContent, setViewDocContent] = useState(null);
  const [addTraineeOpen, setAddTraineeOpen] = useState(false);
  const [traineeForm, setTraineeForm] = useState({ email: '', password: '', display_name: '' });
  // Dashboard controls
  const [dateRange, setDateRange] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drillMode, setDrillMode] = useState(null);
  const [drillData, setDrillData] = useState([]);
  const [analyticsFilterRegion, setAnalyticsFilterRegion] = useState('');
  const [analyticsFilterCaseType, setAnalyticsFilterCaseType] = useState('');
  const [analyticsFilterMediator, setAnalyticsFilterMediator] = useState('');
  const [caseDistribution, setCaseDistribution] = useState([]);
  const [caseList, setCaseList] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailTab, setUserDetailTab] = useState('overview');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userSortFilter, setUserSortFilter] = useState('created_at');
  const [userDateFrom, setUserDateFrom] = useState('');
  const [userDateTo, setUserDateTo] = useState('');
  const [usersSkip, setUsersSkip] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [userCases, setUserCases] = useState([]);
  const [userActionsOpen, setUserActionsOpen] = useState(null);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserForm, setEditUserForm] = useState({ display_name: '', email: '', phone: '', country: '', assigned_mediator_id: '', status: '', is_active: true });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditResourceFilter, setAuditResourceFilter] = useState('');
  const [securityStatus, setSecurityStatus] = useState(null);
  const navigate = useNavigate();

  const DATE_RANGES = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: 'This Year' },
  ];

  const refreshDashboard = useCallback(() => {
    setLoading(true);
    const params = { days: dateRange };
    const filterParams = {
      days: dateRange,
      country: analyticsFilterRegion || undefined,
      mediator_id: analyticsFilterMediator || undefined,
    };
    Promise.allSettled([
      analyticsApi.getDashboard(params).then(({ data }) => data),
      analyticsApi.getTimeseries(Math.ceil(dateRange / 30) || 12).then(({ data }) => data),
      analyticsApi.getMediators().then(({ data }) => data),
      analyticsApi.getGeographic().then(({ data }) => data),
      analyticsApi.getUnresolvedCases(dateRange).then(({ data }) => data),
      analyticsApi.getCaseDistribution(filterParams).then(({ data }) => data),
    ]).then(([a, ts, m, g, u, cd]) => {
      setAnalytics(a.status === 'fulfilled' ? a.value : null);
      setTimeseries(ts.status === 'fulfilled' ? ts.value || [] : []);
      setMediatorPerformance(m.status === 'fulfilled' ? m.value || [] : []);
      setGeographic(g.status === 'fulfilled' ? g.value || [] : []);
      setUnresolved(u.status === 'fulfilled' ? u.value || [] : []);
      setCaseDistribution(cd.status === 'fulfilled' ? cd.value || [] : []);
      setLastUpdated(new Date());
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dateRange, analyticsFilterRegion, analyticsFilterMediator]);

  useEffect(() => {
    if (tab === 'users') {
      calendarApi.listMediators().then(({ data }) => setMediators(data || [])).catch(() => setMediators([]));
    }
  }, [tab]);

  useEffect(() => {
    usersApi.pendingApprovals().then(({ data }) => setPendingApprovals(data || [])).catch(() => setPendingApprovals([]));
  }, []);

  useEffect(() => {
    if (tab === 'orgkb') {
      setLoading(true);
      knowledge.listOrgDocuments()
        .then(({ data }) => setOrgDocs(data || []))
        .catch(() => setOrgDocs([]))
        .finally(() => setLoading(false));
    } else if (tab === 'tenants') {
      tenantsApi.list()
        .then(({ data }) => setTenants(data || []))
        .catch(() => setTenants([]))
        .finally(() => setLoading(false));
    } else if (tab === 'users') {
      const params = {
        search: searchQuery?.trim() || undefined,
        role: userRoleFilter || undefined,
        status: userStatusFilter || undefined,
        sort: userSortFilter || undefined,
        date_from: userDateFrom || undefined,
        date_to: userDateTo || undefined,
        skip: 0,
        limit: 50,
      };
      usersApi.list(params)
        .then(({ data }) => { setUsers(data || []); setUsersSkip(0); setUsersHasMore((data || []).length >= 50); })
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    } else if (tab === 'cases') {
      setLoading(true);
      cases.list({ limit: 100 })
        .then(({ data }) => setCaseList(data || []))
        .catch(() => setCaseList([]))
        .finally(() => setLoading(false));
    } else if (tab === 'approvals') {
      setLoading(true);
      usersApi.pendingApprovals()
        .then(({ data }) => setPendingApprovals(data || []))
        .catch(() => setPendingApprovals([]))
        .finally(() => setLoading(false));
    } else if (tab === 'trainees') {
      usersApi.list({ role: 'trainee' })
        .then(({ data }) => setUsers(data || []))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    } else if (tab === 'audit') {
      setLoading(true);
      Promise.allSettled([
        auditApi.listLogs({ resource_type: auditResourceFilter || undefined, limit: 100 }),
        auditApi.getSecurityStatus(),
      ])
        .then(([logsRes, statusRes]) => {
          setAuditLogs(logsRes.status === 'fulfilled' ? logsRes.value?.data || [] : []);
          setSecurityStatus(statusRes.status === 'fulfilled' ? statusRes.value?.data : null);
        })
        .catch(() => setAuditLogs([]))
        .finally(() => setLoading(false));
    } else {
      refreshDashboard();
    }
  }, [tab, dateRange, userRoleFilter, userStatusFilter, userSortFilter, userDateFrom, userDateTo, searchQuery, auditResourceFilter, analyticsFilterRegion, analyticsFilterCaseType, analyticsFilterMediator]);

  useEffect(() => {
    if (tab !== 'users') return;
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [tab, searchInput]);

  useEffect(() => {
    if (userDetailTab === 'cases' && selectedUser?.id) {
      usersApi.getClientCases(selectedUser.id)
        .then(({ data }) => setUserCases(data || []))
        .catch(() => setUserCases([]));
    } else {
      setUserCases([]);
    }
  }, [userDetailTab, selectedUser?.id]);

  useEffect(() => {
    if (!autoRefresh || tab !== 'dashboard') return;
    const id = setInterval(refreshDashboard, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, tab]);

  const openDrill = async (mode) => {
    setDrillMode(mode);
    const filterParams = {
      days: dateRange,
      country: analyticsFilterRegion || undefined,
      case_type: analyticsFilterCaseType || undefined,
      mediator_id: analyticsFilterMediator || undefined,
      role: analyticsFilterRegion ? undefined : undefined,
    };
    try {
      if (mode === 'active_cases') {
        const { data } = await analyticsApi.getActiveCases(filterParams);
        setDrillData(data || []);
      } else if (mode === 'new_users') {
        const { data } = await analyticsApi.getNewUsers({ days: dateRange, country: analyticsFilterRegion || undefined });
        setDrillData(data || []);
      } else if (mode === 'trainees') {
        const { data } = await analyticsApi.getActiveTrainees();
        setDrillData(data || []);
      } else {
        setDrillData([]);
      }
    } catch {
      setDrillData([]);
    }
  };

  const exportToCsv = () => {
    if (!analytics) return;
    const rows = [
      ['Metric', 'Value'],
      ['Active Cases', analytics.active_cases ?? 0],
      ['Total Cases', analytics.total_cases ?? 0],
      ['Resolution Rate %', analytics.resolution_rate ?? 0],
      ['Total Users', analytics.total_users ?? 0],
      ['New Users', analytics.new_users_30d ?? 0],
      ['Active Mediators', analytics.active_mediators ?? 0],
      ['Active Trainees', analytics.active_trainees ?? 0],
      ['Training Completed', analytics.training_completed ?? 0],
      ['Revenue (units)', (analytics.revenue_minor_units ?? 0) / 100],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TrendPill = ({ value, label }) => {
    if (value == null || value === 0) return <span className="trend-pill neutral"><Minus size={12} /> —</span>;
    const isUp = value > 0;
    return (
      <span className={`trend-pill ${isUp ? 'up' : 'down'}`}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(value)} vs prev
      </span>
    );
  };

  const KPI_CARD = ({ value, label, tooltip, trend, onClick }) => (
    <div
      className="widget-card widget-card-clickable"
      onClick={() => onClick?.()}
      title={tooltip}
    >
      <span className="widget-value">{value}</span>
      <span className="widget-label">{label}</span>
      {trend != null && <TrendPill value={trend} label={label} />}
    </div>
  );

  const handleToggleActive = async (u) => {
    try {
      await usersApi.updateStatus(u.id, { is_active: !u.is_active, status: u.is_active ? 'inactive' : 'active' });
      const updated = { ...u, is_active: !u.is_active, status: u.is_active ? 'inactive' : 'active' };
      setUsers(users.map(x => x.id === u.id ? updated : x));
      setSelectedUser((prev) => (prev?.id === u.id ? updated : prev));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportUserData = (u) => {
    const blob = new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-${u.email || u.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    const countryMeta = COUNTRIES.find((c) => c.value === onboardForm.country);
    const prefix = countryMeta?.prefix || '';
    const digits = onboardForm.phone.replace(/\D/g, '');
    const phone = onboardForm.phone.startsWith('+') ? onboardForm.phone : `+${prefix}${digits}`;
    const payload = {
      full_name: onboardForm.full_name,
      email: onboardForm.email,
      phone,
      user_type: onboardForm.user_type,
      country: onboardForm.country,
      invite_via_link: onboardForm.invite_via_link,
    };
    if (!onboardForm.invite_via_link) payload.password = onboardForm.password;
    try {
      await usersApi.intake(payload);
      setOnboardOpen(false);
      setOnboardForm({ full_name: '', email: '', phone: '', user_type: 'individual', country: 'KE', password: '', invite_via_link: false });
      if (tab === 'users') usersApi.list().then(({ data }) => setUsers(data || []));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleAddTrainee = async (e) => {
    e.preventDefault();
    if (!traineeForm.email || !traineeForm.password || !traineeForm.display_name) {
      alert('Please fill in all fields');
      return;
    }
    try {
      await usersApi.onboard({
        email: traineeForm.email,
        password: traineeForm.password,
        display_name: traineeForm.display_name,
        role: 'trainee',
      });
      setAddTraineeOpen(false);
      setTraineeForm({ email: '', password: '', display_name: '' });
      if (tab === 'trainees') usersApi.list({ role: 'trainee' }).then(({ data }) => setUsers(data || []));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create trainee');
    }
  };

  const openEditUser = (u) => {
    setEditUserForm({
      display_name: u.display_name || '',
      email: u.email || '',
      phone: u.phone || '',
      country: u.country || 'KE',
      assigned_mediator_id: u.assigned_mediator_id || '',
      status: u.status || 'active',
      is_active: u.is_active ?? true,
    });
    setEditUserOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const payload = {
        display_name: editUserForm.display_name || undefined,
        email: editUserForm.email || undefined,
        phone: editUserForm.phone || undefined,
        country: editUserForm.country || undefined,
        status: editUserForm.status || undefined,
        is_active: editUserForm.is_active,
      };
      if (selectedUser.role === 'client_individual' || selectedUser.role === 'client_corporate') {
        payload.assigned_mediator_id = editUserForm.assigned_mediator_id || null;
      }
      const { data } = await usersApi.update(selectedUser.id, payload);
      setSelectedUser(data);
      setUsers(users.map((u) => (u.id === selectedUser.id ? data : u)));
      setEditUserOpen(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignUser || !reassignForm.mediator_id) return;
    try {
      await usersApi.reassignMediator(reassignUser.id, {
        mediator_id: reassignForm.mediator_id,
        reason: reassignForm.reason || undefined,
        note: reassignForm.note || undefined,
        notify_user_and_mediator: reassignForm.notify,
      });
      setReassignOpen(false);
      setReassignUser(null);
      setReassignForm({ mediator_id: '', reason: '', note: '', notify: true });
      if (tab === 'users') {
        const params = { search: searchQuery?.trim(), role: userRoleFilter, status: userStatusFilter, sort: userSortFilter, date_from: userDateFrom, date_to: userDateTo, skip: 0, limit: 50 };
        usersApi.list(params).then(({ data }) => { setUsers(data || []); setUsersSkip(0); });
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reassign');
    }
  };

  const loadMoreUsers = () => {
    const nextSkip = usersSkip + 50;
    const params = {
      search: searchQuery?.trim() || undefined,
      role: userRoleFilter || undefined,
      status: userStatusFilter || undefined,
      sort: userSortFilter || undefined,
      date_from: userDateFrom || undefined,
      date_to: userDateTo || undefined,
      skip: nextSkip,
      limit: 50,
    };
    usersApi.list(params)
      .then(({ data }) => {
        if (data?.length) {
          setUsers((prev) => [...prev, ...data]);
          setUsersSkip(nextSkip);
          setUsersHasMore(data.length >= 50);
        } else {
          setUsersHasMore(false);
        }
      })
      .catch(() => setUsersHasMore(false));
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await usersApi.updateStatus(deactivateUser.id, {
        is_active: false,
        status: 'inactive',
        deactivation_reason: deactivateReason || undefined,
      });
      const updated = { ...deactivateUser, is_active: false, status: 'inactive' };
      setUsers(users.map((x) => (x.id === deactivateUser.id ? updated : x)));
      setSelectedUser((prev) => (prev?.id === deactivateUser.id ? updated : prev));
      setDeactivateModalOpen(false);
      setDeactivateUser(null);
      setDeactivateReason('');
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to deactivate');
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteUser) return;
    try {
      await usersApi.softDelete(deleteUser.id);
      setUsers(users.filter((x) => x.id !== deleteUser.id));
      if (selectedUser?.id === deleteUser.id) setSelectedUser(null);
      setDeleteConfirmOpen(false);
      setDeleteUser(null);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleImpersonate = async (u) => {
    try {
      const { data } = await auth.impersonate(u.id);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to impersonate');
    }
  };

  const isClient = (u) => u?.role === 'client_individual' || u?.role === 'client_corporate';

  return (
    <div className="dashboard admin-dashboard admin-dashboard-split">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-card">
          <div className="admin-sidebar-brand">
            <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
            <h1>Admin Dashboard</h1>
          </div>
          <nav className="admin-sidebar-nav">
            <button className={tab === 'dashboard' ? 'nav-active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard size={16} /> Dashboard</button>
            <button className={tab === 'cases' ? 'nav-active' : ''} onClick={() => setTab('cases')}><FolderOpen size={16} /> Cases</button>
            <button className={tab === 'users' ? 'nav-active' : ''} onClick={() => setTab('users')}><Users size={16} /> Users{pendingApprovals.length > 0 && <span className="nav-badge">{pendingApprovals.length}</span>}</button>
            <button className={tab === 'approvals' ? 'nav-active' : ''} onClick={() => setTab('approvals')}><UserPlus size={16} /> Approvals{pendingApprovals.length > 0 && <span className="nav-badge">{pendingApprovals.length}</span>}</button>
            <button className={tab === 'tenants' ? 'nav-active' : ''} onClick={() => setTab('tenants')}><Building2 size={16} /> Tenants</button>
            <button className={tab === 'orgkb' ? 'nav-active' : ''} onClick={() => setTab('orgkb')}><BookOpen size={16} /> Org KB</button>
            <button className={tab === 'trainees' ? 'nav-active' : ''} onClick={() => setTab('trainees')}><GraduationCap size={16} /> Trainees</button>
            <button className={tab === 'audit' ? 'nav-active' : ''} onClick={() => setTab('audit')}><FileText size={16} /> Audit Log</button>
            <Link to="/admin/training-academy" className="nav-training-academy"><Sparkles size={16} /> Training Academy</Link>
            <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
            <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }}><LogOut size={16} /> Sign out</Link>
          </nav>
        </div>
      </aside>
      <main className="admin-main">
      <div className="admin-main-search">
        <GlobalSearch className="admin-global-search" />
      </div>
      {tab === 'dashboard' && (
        <section className="admin-dashboard-section">
          <div className="dashboard-controls">
            <h2 className="icon-text"><BarChart3 size={22} /> Analytics</h2>
            <div className="controls-row">
              <div className="date-range-picker">
                <span className="control-label">Period:</span>
                <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))}>
                  {DATE_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="analytics-filters">
                <select value={analyticsFilterRegion} onChange={(e) => setAnalyticsFilterRegion(e.target.value)} title="Region">
                  <option value="">Region</option>
                  <option value="KE">Kenya</option>
                  <option value="NG">Nigeria</option>
                  <option value="ZA">South Africa</option>
                  <option value="GH">Ghana</option>
                  <option value="TZ">Tanzania</option>
                  <option value="UG">Uganda</option>
                </select>
                <select value={analyticsFilterCaseType} onChange={(e) => setAnalyticsFilterCaseType(e.target.value)} title="Case type">
                  <option value="">Case type</option>
                  <option value="family">Family</option>
                  <option value="commercial">Commercial</option>
                  <option value="employment">Employment</option>
                  <option value="land_property">Land/Property</option>
                  <option value="community_dispute">Community</option>
                  <option value="other">Other</option>
                </select>
                <select value={analyticsFilterMediator} onChange={(e) => setAnalyticsFilterMediator(e.target.value)} title="Mediator">
                  <option value="">Mediator</option>
                  {mediatorPerformance?.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="refresh-controls">
                <label className="auto-refresh-toggle">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                  Auto-refresh (5 min)
                </label>
                <button className="btn-refresh" onClick={refreshDashboard} disabled={loading} title="Refresh">
                  <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
                {lastUpdated && (
                  <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
                )}
              </div>
              <button className="btn-export" onClick={exportToCsv} disabled={!analytics}>
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
          {loading ? <p>Loading...</p> : analytics ? (
            <>
              <div className="analytics-widgets">
                <KPI_CARD
                  value={analytics.active_cases ?? 0}
                  label="Active Cases"
                  tooltip="Cases currently in mediation"
                  onClick={() => openDrill('active_cases')}
                />
                <KPI_CARD
                  value={analytics.total_cases ?? 0}
                  label="Total Cases"
                  tooltip="All cases in the system"
                />
                <KPI_CARD
                  value={`${analytics.resolution_rate ?? 0}%`}
                  label="Resolution Rate"
                  tooltip="% of cases resolved or closed"
                />
                <KPI_CARD
                  value={analytics.total_users ?? 0}
                  label="Total Users"
                  tooltip="All platform users"
                />
                <KPI_CARD
                  value={analytics.new_users_30d ?? 0}
                  label={`New Users (${dateRange}d)`}
                  tooltip="Users joined in selected period"
                  trend={analytics.new_users_trend}
                  onClick={() => openDrill('new_users')}
                />
                <KPI_CARD
                  value={analytics.active_mediators ?? 0}
                  label="Active Mediators"
                  tooltip="Mediators only (excludes trainees)"
                  onClick={() => setDrillMode('mediators')}
                />
                <KPI_CARD
                  value={analytics.active_trainees ?? 0}
                  label="Active Trainees"
                  tooltip="Trainees in training (not yet mediators)"
                  onClick={() => openDrill('trainees')}
                />
                <KPI_CARD
                  value={analytics.training_completed ?? 0}
                  label="Training Completed"
                  tooltip="Completed training modules"
                />
                <KPI_CARD
                  value={(analytics.revenue_minor_units ?? 0) / 100}
                  label="Revenue (units)"
                  tooltip="Total paid revenue"
                />
              </div>

              <div className="charts-grid">
                {timeseries?.length > 0 && (
                  <div className="analytics-chart-card chart-main">
                    <h3 className="analytics-chart-title">Cases Created vs Resolved</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={timeseries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend />
                        <Bar dataKey="created" name="Created" fill="#b45309" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#34d399" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {caseDistribution?.length > 0 && (
                  <div className="analytics-chart-card chart-pie">
                    <h3 className="analytics-chart-title">Case Distribution by Type</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={caseDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {caseDistribution.map((_, i) => (
                            <Cell key={i} fill={['#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fde68a'][i % 5]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {mediatorPerformance?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title">Mediator Workload</h3>
                  <ResponsiveContainer width="100%" height={Math.min(300, mediatorPerformance.length * 48)}>
                    <BarChart data={mediatorPerformance} layout="vertical" margin={{ top: 4, right: 24, left: 80, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="cases_handled" name="Cases" fill="#b45309" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {geographic?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title"><MapPin size={18} /> Cases & Users by Country</h3>
                  <div className="geographic-grid">
                    {geographic.map(({ country, cases, users }) => (
                      <div key={country} className="geographic-item">
                        <span className="geo-country">{country}</span>
                        <span className="geo-cases">{cases} cases</span>
                        <span className="geo-users">{users} users</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unresolved?.length > 0 && (
                <div className="analytics-chart-card">
                  <h3 className="analytics-chart-title"><FileText size={18} /> Unresolved Cases (&gt;{dateRange}d)</h3>
                  <div className="unresolved-list">
                    {unresolved.slice(0, 10).map((c) => (
                      <Link key={c.id} to={`/cases/${c.id}`} className="unresolved-item unresolved-link">
                        <span className="unresolved-title">{c.case_number} – {c.title}</span>
                        <span className="unresolved-meta">{c.days_unresolved}d · {c.status}</span>
                      </Link>
                    ))}
                    {unresolved.length > 10 && <p className="unresolved-more">+{unresolved.length - 10} more</p>}
                  </div>
                </div>
              )}

              {drillMode && (
                <div className="modal-overlay" onClick={() => setDrillMode(null)}>
                  <div className="modal-card modal-drill" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-drill-header">
                      <h3>
                        {drillMode === 'active_cases' && 'Active Cases'}
                        {drillMode === 'new_users' && 'New Users'}
                        {drillMode === 'mediators' && 'Mediator Performance'}
                        {drillMode === 'trainees' && 'Active Trainees'}
                      </h3>
                      <button className="btn-close" onClick={() => setDrillMode(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-drill-body">
                      {drillMode === 'active_cases' && (
                        <div className="drill-table-wrap">
                          <table className="drill-table">
                            <thead>
                              <tr><th>Case #</th><th>Title</th><th>Type</th><th>Status</th><th>Days Active</th></tr>
                            </thead>
                            <tbody>
                              {drillData.map((c) => (
                                <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="drill-row-clickable">
                                  <td>{c.case_number}</td>
                                  <td>{c.title}</td>
                                  <td>{c.case_type}</td>
                                  <td>{c.status}</td>
                                  <td>{c.days_active}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {drillData.length === 0 && <p className="empty-msg">No active cases in period.</p>}
                        </div>
                      )}
                      {drillMode === 'new_users' && (
                        <div className="drill-table-wrap">
                          <table className="drill-table">
                            <thead>
                              <tr><th>Name</th><th>Email</th><th>Role</th><th>Country</th><th>Joined</th></tr>
                            </thead>
                            <tbody>
                              {drillData.map((u) => (
                                <tr key={u.id}>
                                  <td>{u.display_name || '-'}</td>
                                  <td>{u.email}</td>
                                  <td>{u.role}</td>
                                  <td>{u.country || '-'}</td>
                                  <td>{u.created_at?.slice(0, 10)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {drillData.length === 0 && <p className="empty-msg">No new users in period.</p>}
                        </div>
                      )}
                      {drillMode === 'mediators' && (
                        <div className="drill-table-wrap">
                          <table className="drill-table">
                            <thead>
                              <tr><th>Mediator</th><th>Cases</th><th>Resolution Rate</th></tr>
                            </thead>
                            <tbody>
                              {mediatorPerformance.map((m) => (
                                <tr key={m.id}>
                                  <td>{m.name}</td>
                                  <td>{m.cases_handled}</td>
                                  <td>{m.resolution_rate}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {drillMode === 'trainees' && (
                        <div className="drill-table-wrap">
                          <table className="drill-table">
                            <thead>
                              <tr><th>Name</th><th>Email</th><th>Country</th><th>Joined</th><th>Last Login</th></tr>
                            </thead>
                            <tbody>
                              {drillData.map((t) => (
                                <tr key={t.id}>
                                  <td>{t.display_name || '-'}</td>
                                  <td>{t.email}</td>
                                  <td>{t.country || '-'}</td>
                                  <td>{t.created_at?.slice(0, 10)}</td>
                                  <td>{t.last_login_at ? t.last_login_at.slice(0, 10) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {drillData.length === 0 && <p className="empty-msg">No active trainees.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : <p>No analytics data.</p>}
        </section>
      )}

      {tab === 'cases' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><FolderOpen size={22} /> Cases</h2>
            <Link to="/cases/new" className="primary"><Plus size={16} /> New Case</Link>
          </div>
          {loading ? <p>Loading...</p> : (
            <div className="case-cards-grid">
              {caseList.map((c) => (
                <div key={c.id} className="case-card" onClick={() => navigate(`/cases/${c.id}`)}>
                  <div className="case-card-header">
                    <span className="case-number">{c.case_number}</span>
                    <span className={`badge ${STATUS_BADGES[c.status?.toLowerCase()]?.class || c.status?.toLowerCase() || ''}`}>{c.status}</span>
                  </div>
                  <div className="case-card-title">{c.title || c.case_number}</div>
                  <div className="case-card-meta">{c.case_type || c.dispute_category || '-'}</div>
                  <div className="case-card-actions">
                    <Link to={`/cases/${c.id}`} className="btn-sm" onClick={(e) => e.stopPropagation()}>View</Link>
                    <Link to={`/cases/${c.id}/edit`} className="btn-sm" onClick={(e) => e.stopPropagation()}>Edit</Link>
                  </div>
                </div>
              ))}
              {caseList.length === 0 && <p className="empty-msg">No cases yet.</p>}
            </div>
          )}
        </section>
      )}

      {tab === 'approvals' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><UserPlus size={22} /> Pending Approvals</h2>
          </div>
          {loading ? <p>Loading...</p> : pendingApprovals.length === 0 ? (
            <p className="empty-msg">No pending approvals.</p>
          ) : (
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Phone</th>
                    <th>Country</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((u) => (
                    <tr key={u.id}>
                      <td>{u.display_name || '-'}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge ${USER_TYPE_BADGES[u.role]?.class || ''}`}>{USER_TYPE_BADGES[u.role]?.label || u.role}</span></td>
                      <td>{u.phone || '-'}</td>
                      <td>{u.country || '-'}</td>
                      <td>
                        <span className={`badge ${u.approval_status === 'on_hold' ? 'badge-pending' : 'badge-active'}`}>
                          {u.approval_status === 'on_hold' ? 'On Hold' : 'Pending'}
                        </span>
                      </td>
                      <td>{u.created_at?.slice(0, 10)}</td>
                      <td>
                        <button className="btn-sm primary" onClick={async () => {
                          try {
                            await usersApi.approve(u.id);
                            usersApi.pendingApprovals().then(({ data }) => setPendingApprovals(data || []));
                          } catch (err) { alert(err.response?.data?.detail || 'Failed'); }
                        }}>Approve</button>
                        <button className="btn-sm" onClick={async () => {
                          const notes = prompt('What information do you need from the mediator?');
                          if (!notes?.trim()) return;
                          try {
                            await usersApi.requestInfo(u.id, notes.trim());
                            usersApi.pendingApprovals().then(({ data }) => setPendingApprovals(data || []));
                          } catch (err) { alert(err.response?.data?.detail || 'Failed'); }
                        }}>Request Info</button>
                        <button className="btn-sm" onClick={async () => {
                          const reason = prompt('Rejection reason (optional):');
                          try {
                            await usersApi.reject(u.id, reason || undefined);
                            usersApi.pendingApprovals().then(({ data }) => setPendingApprovals(data || []));
                          } catch (err) { alert(err.response?.data?.detail || 'Failed'); }
                        }}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'users' && (
        <section className="admin-dashboard-section split-view-section">
          <div className="section-header">
            <h2 className="icon-text"><Users size={22} /> User Management</h2>
            <button className="primary" onClick={() => setOnboardOpen(true)}><UserPlus size={16} /> New User</button>
          </div>
          <div className="split-view">
            <aside className="split-view-left">
              <div className="split-view-search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="split-view-filters">
                <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
                  <option value="">Role</option>
                  <option value="client_individual">Individual</option>
                  <option value="client_corporate">Corporate</option>
                  <option value="mediator">Mediator</option>
                  <option value="trainee">Trainee</option>
                </select>
                <select value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)}>
                  <option value="">Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select value={userSortFilter} onChange={(e) => setUserSortFilter(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="split-view-filters split-view-filters-row2">
                <input type="date" placeholder="From" value={userDateFrom} onChange={(e) => setUserDateFrom(e.target.value)} className="split-view-date-input" />
                <input type="date" placeholder="To" value={userDateTo} onChange={(e) => setUserDateTo(e.target.value)} className="split-view-date-input" />
              </div>
              <div className="split-view-list" style={{ height: 360 }}>
                {loading ? <p>Loading...</p> : users.length === 0 ? (
                  <p className="empty-msg">No users yet.</p>
                ) : (
                  <FixedSizeList
                    height={360}
                    itemCount={users.length}
                    itemSize={72}
                    width="100%"
                    overscanCount={5}
                  >
                    {({ index, style }) => {
                      const u = users[index];
                      return (
                        <div
                          key={u.id}
                          style={style}
                          role="button"
                          tabIndex={0}
                          className={`split-view-item ${selectedUser?.id === u.id ? 'selected' : ''}`}
                          onClick={() => setSelectedUser(u)}
                          onKeyDown={(e) => e.key === 'Enter' && setSelectedUser(u)}
                        >
                          <div className="split-view-item-header">
                            <span className="split-view-item-name">{u.display_name || u.email || '—'}</span>
                            <span className={`badge ${STATUS_BADGES[u.status]?.class || 'badge-pending'}`}>
                              {STATUS_BADGES[u.status]?.label || u.status}
                            </span>
                          </div>
                          <div className="split-view-item-meta">
                            {USER_TYPE_BADGES[u.role]?.label || u.role} • {u.user_id || '—'}
                          </div>
                        </div>
                      );
                    }}
                  </FixedSizeList>
                )}
              </div>
              {users.length >= 50 && usersHasMore && (
                <button type="button" className="btn-sm split-view-load-more" onClick={loadMoreUsers}>
                  Load more
                </button>
              )}
            </aside>
            <div className="split-view-right">
              {selectedUser ? (
                <>
                  <button type="button" className="split-view-back" onClick={() => setSelectedUser(null)}>
                    <ArrowLeft size={16} /> Back to list
                  </button>
                  <div className="split-view-detail-header">
                    <h3 className="split-view-detail-name">{(selectedUser.display_name || selectedUser.email || '—').toUpperCase()}</h3>
                    <p className="split-view-detail-id">{selectedUser.user_id || '—'}</p>
                    <div className="split-view-detail-actions">
                      <span className={`badge ${STATUS_BADGES[selectedUser.status]?.class || ''}`}>{STATUS_BADGES[selectedUser.status]?.label || selectedUser.status}</span>
                      <button className="btn-sm" onClick={() => openEditUser(selectedUser)}>Edit</button>
                      <div className="dropdown-wrap">
                        <button type="button" className="btn-sm btn-icon" onClick={() => setUserActionsOpen(userActionsOpen === selectedUser.id ? null : selectedUser.id)}>
                          <MoreVertical size={18} />
                        </button>
                        {userActionsOpen === selectedUser.id && (
                          <div className="dropdown-menu">
                            <button type="button" onClick={() => { openEditUser(selectedUser); setUserActionsOpen(null); }}>Edit User</button>
                            {isClient(selectedUser) && (
                              <button type="button" onClick={() => { setReassignUser(selectedUser); setReassignForm({ mediator_id: selectedUser.assigned_mediator_id || '', reason: '', note: '', notify: true }); setReassignOpen(true); setUserActionsOpen(null); }}>Reassign Mediator</button>
                            )}
                            <button type="button" onClick={() => { window.location.href = `mailto:${selectedUser.email || ''}`; setUserActionsOpen(null); }}>Send Message</button>
                            <button type="button" onClick={() => { if (selectedUser.is_active) { setDeactivateUser(selectedUser); setDeactivateModalOpen(true); } else { handleToggleActive(selectedUser); } setUserActionsOpen(null); }}>{selectedUser.is_active ? 'Deactivate Account' : 'Activate Account'}</button>
                            <button type="button" onClick={() => { handleImpersonate(selectedUser); setUserActionsOpen(null); }}><UserCircle size={14} /> Impersonate</button>
                            <button type="button" onClick={() => { handleExportUserData(selectedUser); setUserActionsOpen(null); }}>Export Data</button>
                            <button type="button" className="dropdown-menu-danger" onClick={() => { setDeleteUser(selectedUser); setDeleteConfirmOpen(true); setUserActionsOpen(null); }}><Trash2 size={14} /> Delete (soft)</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="split-view-tabs">
                    <button className={userDetailTab === 'overview' ? 'active' : ''} onClick={() => setUserDetailTab('overview')}>Overview</button>
                    <button className={userDetailTab === 'cases' ? 'active' : ''} onClick={() => setUserDetailTab('cases')}>Cases</button>
                    <button className={userDetailTab === 'activity' ? 'active' : ''} onClick={() => setUserDetailTab('activity')}>Activity</button>
                  </div>
                  <div className="split-view-detail-body">
                    {userDetailTab === 'overview' && (
                      <div className="split-view-form">
                        <div className="split-view-form-section">
                          <h4>Personal Information</h4>
                          <div className="form-row"><label>Full Name</label><span>{selectedUser.display_name || '—'}</span></div>
                          <div className="form-row"><label>Email</label><span>{selectedUser.email || '—'}</span></div>
                          <div className="form-row"><label>Phone</label><span>{selectedUser.phone || '—'}</span></div>
                          <div className="form-row"><label>Country</label><span>{selectedUser.country || '—'}</span></div>
                        </div>
                        <div className="split-view-form-section">
                          <h4>Professional Details</h4>
                          <div className="form-row"><label>User ID</label><span>{selectedUser.user_id || '—'}</span></div>
                          <div className="form-row"><label>Role</label><span>{USER_TYPE_BADGES[selectedUser.role]?.label || selectedUser.role}</span></div>
                          {isClient(selectedUser) && (
                            <div className="form-row"><label>Assigned Mediator</label><span>{selectedUser.assigned_mediator_id ? (mediators.find((m) => m.id === selectedUser.assigned_mediator_id)?.display_name || mediators.find((m) => m.id === selectedUser.assigned_mediator_id)?.email || 'Assigned') : 'Unassigned'}</span></div>
                          )}
                        </div>
                        <div className="split-view-form-section">
                          <h4>Account Status</h4>
                          <div className="form-row"><label>Status</label><span className={`badge ${STATUS_BADGES[selectedUser.status]?.class || ''}`}>{STATUS_BADGES[selectedUser.status]?.label || selectedUser.status}</span></div>
                          <div className="form-row"><label>Approval</label><span>{selectedUser.approval_status || '—'}</span></div>
                          <div className="form-row"><label>Active</label>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={selectedUser.is_active} onChange={() => handleToggleActive(selectedUser)} />
                              <span className="toggle-slider" />
                            </label>
                          </div>
                          <div className="form-row"><label>Created</label><span>{selectedUser.created_at?.slice(0, 10)}</span></div>
                          <div className="form-row"><label>Last Login</label><span>{selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : '—'}</span></div>
                          <div className="form-row"><label>Onboarded</label><span>{selectedUser.onboarded_at ? new Date(selectedUser.onboarded_at).toLocaleString().slice(0, 10) : '—'}</span></div>
                        </div>
                        <div className="split-view-form-actions">
                          {(selectedUser.role === 'client_individual' || selectedUser.role === 'client_corporate') && (
                            <button className="btn-sm primary" onClick={() => { setReassignUser(selectedUser); setReassignForm({ mediator_id: selectedUser.assigned_mediator_id || '', reason: '', note: '', notify: true }); setReassignOpen(true); }}><UserCog size={14} /> Reassign Mediator</button>
                          )}
                          <button className="btn-sm" onClick={() => handleToggleActive(selectedUser)}>{selectedUser.is_active ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      </div>
                    )}
                    {userDetailTab === 'cases' && (
                      <div className="split-view-cases">
                        {userCases.length === 0 ? (
                          <p className="empty-msg">No cases for this user.</p>
                        ) : (
                          <ul className="user-cases-list">
                            {userCases.map((c) => (
                              <li key={c.id}>
                                <Link to={`/cases/${c.id}`} className="user-case-link">
                                  <span className="user-case-name">{c.case_number} – {c.title}</span>
                                  <span className="badge badge-sm">{c.status}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {userDetailTab === 'activity' && <p className="empty-msg">Activity log.</p>}
                  </div>
                </>
              ) : (
                <div className="split-view-empty">
                  <p>Select a user from the list to view details.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'orgkb' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><BookOpen size={22} /> Organization Knowledge Base</h2>
          </div>
          <p className="section-desc">Documents here are visible to all mediators. Mediators can also contribute by marking their uploads as &quot;Share with organization&quot;.</p>
          <div className="orgkb-upload">
            <input
              type="text"
              placeholder="Title (optional)"
              value={orgUploadTitle}
              onChange={e => setOrgUploadTitle(e.target.value)}
            />
            <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={e => setOrgUploadFile(e.target.files?.[0])} />
            <button
              className="primary"
              disabled={!orgUploadFile || orgUploading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={async () => {
                if (!orgUploadFile) return;
                setOrgUploading(true);
                try {
                  await knowledge.ingestOrg(orgUploadFile, orgUploadTitle || undefined);
                  setOrgUploadFile(null);
                  setOrgUploadTitle('');
                  knowledge.listOrgDocuments().then(({ data }) => setOrgDocs(data || []));
                } catch (err) {
                  alert(err.response?.data?.detail || 'Upload failed');
                } finally {
                  setOrgUploading(false);
                }
              }}
            >
              <Upload size={16} /> {orgUploading ? 'Uploading…' : 'Upload to Org KB'}
            </button>
          </div>
          {loading ? <p>Loading...</p> : (
            <ul className="orgkb-list">
              {orgDocs.map((d) => (
                <li key={d.id} className="orgkb-item">
                  <button
                    type="button"
                    className="orgkb-title-btn"
                    onClick={async () => {
                      setViewDoc(d);
                      setViewDocContent(null);
                      try {
                        const { data } = await knowledge.getDocumentContent(d.id);
                        setViewDocContent(data);
                      } catch (err) {
                        setViewDocContent({ error: err.response?.data?.detail || 'Failed to load' });
                      }
                    }}
                  >
                    {d.title}
                  </button>
                  <span className="orgkb-badge">{d.is_org ? 'Org' : 'Shared'}</span>
                  <button
                    className="btn-sm"
                    title="Download"
                    onClick={async () => {
                      try {
                        const { data } = await knowledge.downloadDocument(d.id);
                        const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = d.original_filename || `${d.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert(err.response?.data?.detail || 'Download failed');
                      }
                    }}
                  >
                    <Download size={14} />
                  </button>
                  {d.is_org && (
                    <button
                      className="btn-sm btn-danger"
                      onClick={async () => {
                        if (!confirm('Delete this document from the organization knowledge base?')) return;
                        try {
                          await knowledge.deleteDocument(d.id);
                          setOrgDocs(orgDocs.filter(x => x.id !== d.id));
                          if (viewDoc?.id === d.id) setViewDoc(null);
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Delete failed');
                        }
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </li>
              ))}
              {orgDocs.length === 0 && <p className="empty-msg">No organization documents yet.</p>}
            </ul>
          )}
          {viewDoc && (
            <div className="modal-overlay" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
              <div className="modal-card modal-doc-view" onClick={e => e.stopPropagation()}>
                <div className="modal-doc-header">
                  <h3>{viewDoc.title}</h3>
                  <button type="button" className="btn-close" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-doc-body">
                  {viewDocContent === null ? (
                    <p>Loading...</p>
                  ) : viewDocContent.error ? (
                    <p className="doc-error">{viewDocContent.error}</p>
                  ) : (
                    <pre className="doc-content">{viewDocContent.content_text || '(No content)'}</pre>
                  )}
                </div>
                <div className="modal-doc-actions">
                  {viewDocContent && !viewDocContent.error && (
                    <button
                      className="primary"
                      onClick={async () => {
                        try {
                          const { data } = await knowledge.downloadDocument(viewDoc.id);
                          const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = viewDoc.original_filename || `${viewDoc.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          alert(err.response?.data?.detail || 'Download failed');
                        }
                      }}
                    >
                      <Download size={16} /> Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'trainees' && (
        <section className="admin-dashboard-section">
          <div className="section-header">
            <h2 className="icon-text"><GraduationCap size={22} /> Trainee Management</h2>
            <button className="primary" onClick={() => setAddTraineeOpen(true)}><UserPlus size={16} /> Add Trainee</button>
          </div>
          <p className="section-desc">Add new mediator trainees and manage access to the Trainee Academy training program.</p>
          {loading ? <p>Loading...</p> : (
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter((u) => u.role === 'trainee').map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.display_name || '-'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGES[u.status]?.class || 'badge-pending'}`}>
                          {STATUS_BADGES[u.status]?.label || u.status}
                        </span>
                      </td>
                      <td>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={u.is_active} onChange={() => handleToggleActive(u)} />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td>
                        <Link to="/training/trainee-academy" className="btn-sm">View Academy</Link>
                        <button className="btn-sm" onClick={() => handleToggleActive(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.filter((u) => u.role === 'trainee').length === 0 && (
                <p className="empty-msg">No trainees yet. Click Add Trainee to create one.</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'tenants' && (
        <section className="admin-dashboard-section">
          <h2 className="icon-text"><Building2 size={22} /> Tenants</h2>
          {loading ? <p>Loading...</p> : tenants.length === 0 ? (
            <p>No tenants yet.</p>
          ) : (
            <ul className="tenant-list">
              {tenants.map((t) => (
                <li key={t.id}>
                  <div className="tenant-card">
                    <span className="tenant-name">{t.name}</span>
                    <span className="tenant-region">{t.data_residency_region}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'audit' && (
        <section className="admin-dashboard-section audit-section">
          <h2 className="icon-text"><FileText size={22} /> Audit Log</h2>
          <p className="section-desc audit-section-desc">Security and compliance audit trail. Super-admin only.</p>

          {securityStatus && (
            <div className="security-compliance-card">
              <h3>Phase 5.4: Security Compliance</h3>
              <div className="compliance-checklist">
                {(securityStatus.compliance_checklist || []).map((item, i) => (
                  <div key={i} className={`compliance-item status-${item.status}`}>
                    <span className="compliance-status">{item.status === 'ok' ? '✓' : item.status === 'warning' ? '!' : 'i'}</span>
                    <span className="compliance-label">{item.item}</span>
                    <span className="compliance-detail">{item.detail}</span>
                  </div>
                ))}
              </div>
              <div className="compliance-meta">
                <p><strong>Audit logs:</strong> {securityStatus.audit_logs?.recent_7_days ?? 0} in last 7 days</p>
                <p><strong>Key rotation:</strong> {securityStatus.key_rotation?.recommendation}</p>
              </div>
            </div>
          )}

          <div className="audit-controls">
            <div className="audit-filter">
              <label>Resource type:</label>
              <select value={auditResourceFilter} onChange={(e) => setAuditResourceFilter(e.target.value)}>
                <option value="">All</option>
                <option value="case">Case</option>
                <option value="user">User</option>
                <option value="session">Session</option>
                <option value="document">Document</option>
                <option value="recording">Recording</option>
                <option value="tenant">Tenant</option>
              </select>
            </div>
          </div>
          {loading ? <p>Loading...</p> : auditLogs.length === 0 ? (
            <p className="empty-msg">No audit logs yet.</p>
          ) : (
            <div className="audit-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Resource ID</th>
                    <th>User ID</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td><span className="audit-action">{log.action}</span></td>
                      <td>{log.resource_type}</td>
                      <td><code>{log.resource_id || '—'}</code></td>
                      <td><code>{log.user_id || '—'}</code></td>
                      <td>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      </main>

      {onboardOpen && (
        <div className="modal-overlay" onClick={() => setOnboardOpen(false)}>
          <div className="modal-card modal-intake" onClick={e => e.stopPropagation()}>
            <h3>New User – Minimal Intake</h3>
            <form onSubmit={handleOnboard} className="intake-form">
              <label>
                Full name <span className="required">*</span>
                <input
                  type="text"
                  placeholder="Full name or organization name"
                  value={onboardForm.full_name}
                  onChange={e => setOnboardForm({ ...onboardForm, full_name: e.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Email <span className="required">*</span>
                <input
                  type="email"
                  placeholder="Email"
                  value={onboardForm.email}
                  onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                  required
                />
              </label>
              <label>
                User type <span className="required">*</span>
                <div className="user-type-toggle">
                  <button
                    type="button"
                    className={onboardForm.user_type === 'individual' ? 'active teal' : ''}
                    onClick={() => setOnboardForm({ ...onboardForm, user_type: 'individual' })}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    className={onboardForm.user_type === 'corporate' ? 'active indigo' : ''}
                    onClick={() => setOnboardForm({ ...onboardForm, user_type: 'corporate' })}
                  >
                    Corporate
                  </button>
                </div>
              </label>
              <label>
                Country of residence <span className="required">*</span>
                <select
                  value={onboardForm.country}
                  onChange={e => setOnboardForm({ ...onboardForm, country: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Phone <span className="required">*</span>
                <div className="phone-input">
                  <span className="phone-prefix">+{COUNTRIES.find((c) => c.value === onboardForm.country)?.prefix || ''}</span>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={onboardForm.phone}
                    onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    required
                  />
                </div>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={onboardForm.invite_via_link}
                  onChange={e => setOnboardForm({ ...onboardForm, invite_via_link: e.target.checked })}
                />
                Invite via link (no password)
              </label>
              {!onboardForm.invite_via_link && (
                <label>
                  Password <span className="required">*</span>
                  <input
                    type="password"
                    placeholder="Set password"
                    value={onboardForm.password}
                    onChange={e => setOnboardForm({ ...onboardForm, password: e.target.value })}
                    required={!onboardForm.invite_via_link}
                  />
                </label>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setOnboardOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addTraineeOpen && (
        <div className="modal-overlay" onClick={() => setAddTraineeOpen(false)}>
          <div className="modal-card modal-intake" onClick={e => e.stopPropagation()}>
            <h3>Add Trainee</h3>
            <p className="section-desc" style={{ marginBottom: '1rem' }}>Create a new trainee account. They will have access to the Trainee Academy training program.</p>
            <form onSubmit={handleAddTrainee} className="intake-form">
              <label>
                Full name <span className="required">*</span>
                <input
                  type="text"
                  placeholder="Full name"
                  value={traineeForm.display_name}
                  onChange={e => setTraineeForm({ ...traineeForm, display_name: e.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Email <span className="required">*</span>
                <input
                  type="email"
                  placeholder="Email"
                  value={traineeForm.email}
                  onChange={e => setTraineeForm({ ...traineeForm, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Password <span className="required">*</span>
                <input
                  type="password"
                  placeholder="Set password"
                  value={traineeForm.password}
                  onChange={e => setTraineeForm({ ...traineeForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setAddTraineeOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Create Trainee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUserOpen && selectedUser && (
        <div className="modal-overlay" onClick={() => setEditUserOpen(false)}>
          <div className="modal-card modal-intake" onClick={e => e.stopPropagation()}>
            <h3>Edit User – {selectedUser.display_name || selectedUser.email}</h3>
            <form onSubmit={handleEditUser} className="intake-form">
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Full name"
                  value={editUserForm.display_name}
                  onChange={e => setEditUserForm({ ...editUserForm, display_name: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  placeholder="Email"
                  value={editUserForm.email}
                  onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  placeholder="Phone"
                  value={editUserForm.phone}
                  onChange={e => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                />
              </label>
              <label>
                Country
                <select
                  value={editUserForm.country}
                  onChange={e => setEditUserForm({ ...editUserForm, country: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              {(selectedUser.role === 'client_individual' || selectedUser.role === 'client_corporate') && (
                <label>
                  Assigned Mediator
                  <select
                    value={editUserForm.assigned_mediator_id}
                    onChange={e => setEditUserForm({ ...editUserForm, assigned_mediator_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {mediators.map((m) => (
                      <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Status
                <select
                  value={editUserForm.status}
                  onChange={e => setEditUserForm({ ...editUserForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editUserForm.is_active}
                  onChange={e => setEditUserForm({ ...editUserForm, is_active: e.target.checked })}
                />
                Account active
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditUserOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deactivateModalOpen && deactivateUser && (
        <div className="modal-overlay" onClick={() => { setDeactivateModalOpen(false); setDeactivateUser(null); setDeactivateReason(''); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Deactivate Account – {deactivateUser.display_name || deactivateUser.email}</h3>
            <p className="section-desc" style={{ marginBottom: '1rem' }}>The user will not be able to log in. You can reactivate later.</p>
            <label>
              Reason (optional)
              <select value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)}>
                <option value="">Select reason</option>
                {DEACTIVATION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" onClick={() => { setDeactivateModalOpen(false); setDeactivateUser(null); setDeactivateReason(''); }}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDeactivate}>Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && deleteUser && (
        <div className="modal-overlay" onClick={() => { setDeleteConfirmOpen(false); setDeleteUser(null); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Delete User – {deleteUser.display_name || deleteUser.email}</h3>
            <p className="section-desc" style={{ marginBottom: '1rem' }}>This will soft-delete the user. They will not be able to log in. Data is retained.</p>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteUser(null); }}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleSoftDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {reassignOpen && reassignUser && (
        <div className="modal-overlay" onClick={() => setReassignOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Reassign Mediator – {reassignUser.display_name || reassignUser.email}</h3>
            <form onSubmit={handleReassign}>
              <label>
                Mediator
                <select
                  value={reassignForm.mediator_id}
                  onChange={e => setReassignForm({ ...reassignForm, mediator_id: e.target.value })}
                  required
                >
                  <option value="">Select mediator</option>
                  {mediators.map((m) => (
                    <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <select
                  value={reassignForm.reason}
                  onChange={e => setReassignForm({ ...reassignForm, reason: e.target.value })}
                >
                  <option value="">Select</option>
                  {REASSIGN_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <textarea
                  placeholder="Optional note"
                  value={reassignForm.note}
                  onChange={e => setReassignForm({ ...reassignForm, note: e.target.value })}
                  rows={2}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={reassignForm.notify}
                  onChange={e => setReassignForm({ ...reassignForm, notify: e.target.checked })}
                />
                Notify user & new mediator
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setReassignOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Reassign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
