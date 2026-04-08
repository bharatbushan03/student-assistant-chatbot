import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BookCheck,
  CalendarClock,
  ChevronRight,
  LineChart,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { fetchStudentDashboard } from '../../utils/academicsApi';

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${Number(value).toFixed(2)}${suffix}`;
}

function buildTrendPath(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return '';
  }

  const width = 420;
  const height = 180;
  const paddingX = 28;
  const paddingY = 20;

  const values = points.map((point) => point.sgpa);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(maxValue - minValue, 0.01);

  const coordinates = points.map((point, index) => {
    const x = paddingX + ((width - (paddingX * 2)) * index) / Math.max(points.length - 1, 1);
    const normalizedY = (point.sgpa - minValue) / span;
    const y = height - paddingY - (normalizedY * (height - (paddingY * 2)));
    return `${x},${y}`;
  });

  return coordinates.join(' ');
}

function StatCard({ title, value, icon, accentClass }) {
  const IconComponent = icon;

  return (
    <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={`rounded-xl p-2 ${accentClass}`}>
          <IconComponent size={18} />
        </div>
      </div>
    </article>
  );
}

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStudentDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const trendPath = useMemo(() => buildTrendPath(dashboard?.analytics?.sgpa_trend || []), [dashboard]);

  const latestSubjects = dashboard?.results_summary?.subjects || [];
  const attendance = dashboard?.analytics?.attendance_summary?.overall_percentage;
  const pendingTasks = dashboard?.pending_tasks || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-8 w-72 rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="h-72 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-destructive/25 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto text-destructive" size={28} />
          <p className="mt-3 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
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
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Student Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">
                {dashboard?.profile?.name || 'Student'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                College ID: {dashboard?.profile?.college_id || 'Not set'}
                {' · '}
                Semester: {dashboard?.profile?.semester || 'Not set'}
              </p>
            </div>

            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-lg border border-border px-3 py-2 hover:bg-muted" to="/">Chat</Link>
              <Link className="rounded-lg border border-border px-3 py-2 hover:bg-muted" to="/projects">Projects</Link>
              <Link className="rounded-lg border border-border px-3 py-2 hover:bg-muted" to="/groups">Groups</Link>
              <Link className="rounded-lg border border-border px-3 py-2 hover:bg-muted" to="/profile">Profile</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Latest SGPA"
            value={formatMetric(dashboard?.results_summary?.latest_sgpa)}
            icon={TrendingUp}
            accentClass="bg-emerald-500/15 text-emerald-600"
          />
          <StatCard
            title="CGPA"
            value={formatMetric(dashboard?.results_summary?.cgpa)}
            icon={Target}
            accentClass="bg-sky-500/15 text-sky-600"
          />
          <StatCard
            title="Attendance"
            value={attendance === null || attendance === undefined ? 'N/A' : `${attendance.toFixed(1)}%`}
            icon={Activity}
            accentClass="bg-amber-500/15 text-amber-600"
          />
          <StatCard
            title="Pending Tasks"
            value={String(pendingTasks.length)}
            icon={CalendarClock}
            accentClass="bg-rose-500/15 text-rose-600"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Performance Trend</h2>
                <p className="text-sm text-muted-foreground">Semester-wise SGPA progression</p>
              </div>
              <LineChart className="text-primary" size={20} />
            </div>

            {dashboard?.empty_states?.analytics ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Performance analytics will appear once semester SGPA data is available.
              </p>
            ) : (
              <div className="space-y-3">
                <svg viewBox="0 0 420 180" className="h-52 w-full rounded-xl border border-border/70 bg-muted/20 p-2">
                  <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={trendPath}
                  />
                  {(dashboard?.analytics?.sgpa_trend || []).map((point, index) => {
                    const x = 28 + ((420 - 56) * index) / Math.max((dashboard.analytics.sgpa_trend.length - 1), 1);
                    const values = dashboard.analytics.sgpa_trend.map((item) => item.sgpa);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const span = Math.max(max - min, 0.01);
                    const y = 180 - 20 - (((point.sgpa - min) / span) * (180 - 40));

                    return (
                      <g key={`${point.semester}-${index}`}>
                        <circle cx={x} cy={y} r="4" fill="hsl(var(--primary))" />
                        <text x={x} y="170" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
                          {point.semester}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Insights</h2>
            <p className="mb-3 text-sm text-muted-foreground">Actionable academic recommendations</p>

            {dashboard?.insights?.length ? (
              <div className="space-y-3">
                {dashboard.insights.map((insight, index) => (
                  <div key={`${insight.title}-${index}`} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
                    {insight.action && (
                      <p className="mt-2 text-xs font-medium text-primary">{insight.action}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No alerts yet. Keep updating your academic profile for richer insights.
              </p>
            )}
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Subject Comparison</h2>
            <p className="mb-3 text-sm text-muted-foreground">Latest semester subject-level performance</p>

            {dashboard?.empty_states?.results ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No results uploaded yet. Ask faculty/admin to publish your subject marks.
              </p>
            ) : (
              <div className="space-y-3">
                {latestSubjects.map((subject) => (
                  <div key={subject.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{subject.name}</span>
                      <span className="text-muted-foreground">{subject.marks}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, Math.min(100, subject.marks))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Pending Tasks</h2>
            <p className="mb-3 text-sm text-muted-foreground">Assignments, submissions, and prep reminders</p>

            {pendingTasks.length ? (
              <ul className="space-y-2">
                {pendingTasks.map((task, index) => (
                  <li key={`${task.title}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">Due: {task.due_date || 'Not specified'}</p>
                    </div>
                    <span className="rounded-full bg-primary/12 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {task.priority}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No pending tasks right now. Keep this panel updated from faculty-admin announcements.
              </div>
            )}

            <Link
              to="/profile"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Update profile details
              <ChevronRight size={14} />
            </Link>
          </article>
        </section>

        <footer className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookCheck size={16} />
            Academic dashboard refreshes with latest records maintained by faculty/admin.
          </div>
        </footer>
      </div>
    </div>
  );
}
