import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import {
  createNotice,
  deleteNotice,
  fetchAdminOverview,
  fetchAdminStudents,
  fetchNotices,
  provisionStaffAccount,
} from '../../utils/academicsApi';

const STATUS_LABEL = {
  at_risk: 'At risk',
  missing_record: 'No record',
  on_track: 'On track',
};

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  return `${Number(value).toFixed(2)}${suffix}`;
}

function statusClass(status) {
  if (status === 'at_risk') {
    return 'bg-destructive/10 text-destructive';
  }
  if (status === 'missing_record') {
    return 'bg-amber-500/15 text-amber-700';
  }
  return 'bg-emerald-500/15 text-emerald-700';
}

function StatCard({ title, value, detail }) {
  return (
    <article className="panel-card p-5">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  );
}

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    semester: '',
    section: '',
    status: 'all',
  });
  const [listLoading, setListLoading] = useState(false);

  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', audience: 'students' });
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeSaving, setNoticeSaving] = useState(false);

  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'faculty',
  });
  const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });
  const [accountSaving, setAccountSaving] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, studentData, noticeData] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminStudents({ status: 'all' }),
        fetchNotices(),
      ]);
      setOverview(overviewData);
      setStudents(studentData.students || []);
      setNotices(noticeData.notices || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load the student oversight dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const applyFilters = async (event) => {
    event.preventDefault();
    setListLoading(true);
    try {
      const studentData = await fetchAdminStudents({
        q: filters.q.trim(),
        semester: filters.semester.trim(),
        section: filters.section.trim(),
        status: filters.status,
      });
      setStudents(studentData.students || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not filter students.');
    } finally {
      setListLoading(false);
    }
  };

  const handleCreateNotice = async (event) => {
    event.preventDefault();
    setNoticeSaving(true);
    setNoticeMessage('');
    try {
      await createNotice({
        title: noticeForm.title.trim(),
        body: noticeForm.body.trim(),
        audience: noticeForm.audience,
      });
      setNoticeForm({ title: '', body: '', audience: 'students' });
      setNoticeMessage('Notice published to student dashboards.');
      const noticeData = await fetchNotices();
      setNotices(noticeData.notices || []);
    } catch (err) {
      setNoticeMessage(err.response?.data?.detail || 'Could not publish the notice.');
    } finally {
      setNoticeSaving(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    try {
      await deleteNotice(noticeId);
      setNotices((current) => current.filter((notice) => notice.id !== noticeId));
    } catch (err) {
      setNoticeMessage(err.response?.data?.detail || 'Could not delete the notice.');
    }
  };

  const handleProvision = async (event) => {
    event.preventDefault();
    setAccountSaving(true);
    setAccountMessage({ type: '', text: '' });
    try {
      const created = await provisionStaffAccount({
        name: accountForm.name.trim() || null,
        email: accountForm.email.trim().toLowerCase(),
        password: accountForm.password,
        role: accountForm.role,
      });
      setAccountForm({ name: '', email: '', password: '', role: 'faculty' });
      setAccountMessage({
        type: 'success',
        text: `${created.role} account created for ${created.email}.`,
      });
    } catch (err) {
      setAccountMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Could not create the account.',
      });
    } finally {
      setAccountSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle size={16} className="animate-spin" />
          Loading student oversight...
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-destructive/25 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto text-destructive" size={28} />
          <p className="mt-3 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={loadOverview}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="panel-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {isAdmin ? 'Admin oversight' : 'Faculty oversight'}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">Student dashboards</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review every student the way they see their own results, attendance, and tasks.
              </p>
              {overview?.platform ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Answers use {overview.platform.llm_model} on NVIDIA NIM. Retrieval uses Pinecone index{' '}
                  {overview.platform.pinecone_index}.
                </p>
              ) : null}
            </div>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className="secondary-button !rounded-2xl !px-3 !py-2" to="/faculty/dashboard">Records</Link>
              <Link className="secondary-button !rounded-2xl !px-3 !py-2" to="/">Chat</Link>
              <Link className="secondary-button !rounded-2xl !px-3 !py-2" to="/projects">Projects</Link>
              <Link className="secondary-button !rounded-2xl !px-3 !py-2" to="/groups">Groups</Link>
            </nav>
          </div>
        </header>

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Students" value={String(overview?.total_students ?? 0)} detail="Accounts plus unmatched records" />
          <StatCard title="At risk" value={String(overview?.at_risk_count ?? 0)} detail="Attendance under 75% or score under 6.0" />
          <StatCard title="Missing records" value={String(overview?.missing_records ?? 0)} detail="Registered students with no marks file" />
          <StatCard
            title="Average CGPA"
            value={formatMetric(overview?.average_cgpa)}
            detail={`Attendance avg ${formatMetric(overview?.average_attendance, '%')}`}
          />
        </section>

        <section className="panel-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Students who need attention</h2>
          </div>
          {overview?.at_risk_students?.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {overview.at_risk_students.map((student) => (
                <button
                  key={student.student_id}
                  type="button"
                  onClick={() => navigate(`/admin/students/${encodeURIComponent(student.student_id)}`)}
                  className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold text-foreground">{student.name || student.student_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.student_id}
                    {' · '}
                    CGPA {formatMetric(student.cgpa)}
                    {' · '}
                    Attendance {student.attendance_overall == null ? 'N/A' : `${Number(student.attendance_overall).toFixed(1)}%`}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No students are currently below the attendance or score thresholds.
            </p>
          )}
        </section>

        <section className="panel-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Student directory</h2>
          </div>
          <form onSubmit={applyFilters} className="mb-4 grid gap-3 md:grid-cols-5">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Search</span>
              <input
                type="text"
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="Name, email, or college ID"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Semester</span>
              <input
                type="text"
                value={filters.semester}
                onChange={(event) => setFilters((prev) => ({ ...prev, semester: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="4"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Section</span>
              <input
                type="text"
                value={filters.section}
                onChange={(event) => setFilters((prev) => ({ ...prev, section: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="A"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="all">All</option>
                <option value="at_risk">At risk</option>
                <option value="missing_record">No record</option>
                <option value="on_track">On track</option>
              </select>
            </label>
            <div className="md:col-span-5">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {listLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                Apply
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Student</th>
                  <th className="px-2 py-2 font-medium">Semester</th>
                  <th className="px-2 py-2 font-medium">CGPA</th>
                  <th className="px-2 py-2 font-medium">Attendance</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Dashboard</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={`${student.student_id}-${student.email || ''}`} className="border-t border-border/70">
                    <td className="px-2 py-3">
                      <p className="font-medium text-foreground">{student.name || 'Unnamed student'}</p>
                      <p className="text-xs text-muted-foreground">{student.student_id}</p>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {student.semester || '—'}
                      {student.section ? ` / ${student.section}` : ''}
                    </td>
                    <td className="px-2 py-3">{formatMetric(student.cgpa)}</td>
                    <td className="px-2 py-3">
                      {student.attendance_overall == null ? 'N/A' : `${Number(student.attendance_overall).toFixed(1)}%`}
                    </td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass(student.status)}`}>
                        {STATUS_LABEL[student.status] || student.status}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/students/${encodeURIComponent(student.student_id)}`)}
                        className="text-sm font-medium text-primary"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!students.length ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No students match these filters.
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Bell size={18} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Campus notices</h2>
            </div>
            <form onSubmit={handleCreateNotice} className="space-y-3">
              <input
                type="text"
                value={noticeForm.title}
                onChange={(event) => setNoticeForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Notice title"
                required
              />
              <textarea
                value={noticeForm.body}
                onChange={(event) => setNoticeForm((prev) => ({ ...prev, body: event.target.value }))}
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="What should students see on their dashboard?"
                required
              />
              <select
                value={noticeForm.audience}
                onChange={(event) => setNoticeForm((prev) => ({ ...prev, audience: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="students">Students</option>
                <option value="all">Everyone</option>
              </select>
              <button
                type="submit"
                disabled={noticeSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
              >
                {noticeSaving ? <LoaderCircle size={14} className="animate-spin" /> : <Bell size={14} />}
                Publish notice
              </button>
            </form>
            {noticeMessage ? <p className="mt-3 text-sm text-muted-foreground">{noticeMessage}</p> : null}
            <div className="mt-4 space-y-2">
              {notices.map((notice) => (
                <div key={notice.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{notice.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{notice.body}</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                      aria-label={`Delete notice ${notice.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
              {!notices.length ? (
                <p className="text-sm text-muted-foreground">No notices published yet.</p>
              ) : null}
            </div>
          </article>

          {isAdmin ? (
            <article className="panel-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-foreground">Provision faculty or admin</h2>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Staff accounts use yourname.dept@mietjammu.in. Students still register themselves.
              </p>
              <form onSubmit={handleProvision} className="space-y-3">
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Full name"
                />
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="name.dept@mietjammu.in"
                  required
                />
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(event) => setAccountForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Temporary password"
                  minLength={8}
                  required
                />
                <select
                  value={accountForm.role}
                  onChange={(event) => setAccountForm((prev) => ({ ...prev, role: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={accountSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
                >
                  {accountSaving ? <LoaderCircle size={14} className="animate-spin" /> : <Shield size={14} />}
                  Create account
                </button>
              </form>
              {accountMessage.text ? (
                <p className={`mt-3 text-sm ${accountMessage.type === 'error' ? 'text-destructive' : 'text-emerald-700'}`}>
                  {accountMessage.text}
                </p>
              ) : null}
            </article>
          ) : (
            <article className="panel-card p-5 text-sm text-muted-foreground">
              Faculty can review dashboards and publish notices. Account provisioning stays with administrators.
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
