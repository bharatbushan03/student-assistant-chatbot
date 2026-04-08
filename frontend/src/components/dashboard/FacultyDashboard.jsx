import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Database,
  FileUp,
  Filter,
  LoaderCircle,
  Save,
  Search,
  Users,
} from 'lucide-react';
import {
  bulkUploadStudentRecords,
  fetchStudentRecord,
  fetchStudentRecords,
  upsertStudentRecord,
} from '../../utils/academicsApi';

function parseOptionalNumber(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return null;
  }
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export default function FacultyDashboard() {
  const [filters, setFilters] = useState({
    student_id: '',
    semester: '',
    section: '',
  });
  const [students, setStudents] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    studentId: '',
    semester: '',
    sgpa: '',
    cgpa: '',
    attendanceOverall: '',
    subjectName: '',
    subjectCode: '',
    marks: '',
    grade: '',
    subjectAttendance: '',
    pendingTask: '',
    taskPriority: 'medium',
  });

  const [saving, setSaving] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);

  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const filterPayload = useMemo(() => {
    const payload = {};
    if (filters.student_id.trim()) payload.student_id = filters.student_id.trim();
    if (filters.semester.trim()) payload.semester = filters.semester.trim();
    if (filters.section.trim()) payload.section = filters.section.trim();
    return payload;
  }, [filters]);

  const loadStudentList = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const data = await fetchStudentRecords(filterPayload);
      setStudents(data.students || []);
    } catch (error) {
      setListError(error.response?.data?.detail || 'Could not load student records.');
    } finally {
      setListLoading(false);
    }
  }, [filterPayload]);

  useEffect(() => {
    loadStudentList();
  }, [loadStudentList]);

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    await loadStudentList();
  };

  const handleSelectStudent = async (studentId) => {
    setSelectedStudentId(studentId);
    setRecordLoading(true);
    setSaveMessage({ type: '', text: '' });

    try {
      const record = await fetchStudentRecord(studentId);
      const latestSemester = (record.semester_results || [])[0] || null;
      const firstSubject = latestSemester?.subjects?.[0] || null;
      const firstTask = (record.pending_tasks || [])[0] || null;

      setForm({
        studentId: record.student_id || studentId,
        semester: latestSemester?.semester || record.semester || '',
        sgpa: latestSemester?.sgpa ?? '',
        cgpa: record.cgpa ?? '',
        attendanceOverall: record.attendance_overall ?? '',
        subjectName: firstSubject?.name || '',
        subjectCode: firstSubject?.code || '',
        marks: firstSubject?.marks ?? '',
        grade: firstSubject?.grade || '',
        subjectAttendance: firstSubject?.attendance ?? '',
        pendingTask: firstTask?.title || '',
        taskPriority: firstTask?.priority || 'medium',
      });
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to load selected student record.',
      });
    } finally {
      setRecordLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.studentId.trim()) {
      return 'Student ID is required.';
    }

    const marks = parseOptionalNumber(form.marks);
    if (marks !== null && (marks < 0 || marks > 100)) {
      return 'Marks must be between 0 and 100.';
    }

    const sgpa = parseOptionalNumber(form.sgpa);
    if (sgpa !== null && (sgpa < 0 || sgpa > 10)) {
      return 'SGPA must be between 0 and 10.';
    }

    const cgpa = parseOptionalNumber(form.cgpa);
    if (cgpa !== null && (cgpa < 0 || cgpa > 10)) {
      return 'CGPA must be between 0 and 10.';
    }

    const attendance = parseOptionalNumber(form.attendanceOverall);
    if (attendance !== null && (attendance < 0 || attendance > 100)) {
      return 'Attendance must be between 0 and 100.';
    }

    const subjectAttendance = parseOptionalNumber(form.subjectAttendance);
    if (subjectAttendance !== null && (subjectAttendance < 0 || subjectAttendance > 100)) {
      return 'Subject attendance must be between 0 and 100.';
    }

    if ((form.subjectName.trim() || form.marks !== '') && !form.semester.trim()) {
      return 'Semester is required when adding subject marks.';
    }

    if (form.subjectName.trim() && form.marks === '') {
      return 'Marks are required when a subject name is provided.';
    }

    if (form.marks !== '' && !form.subjectName.trim()) {
      return 'Subject name is required when marks are provided.';
    }

    return '';
  };

  const handleSaveRecord = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      setSaveMessage({ type: 'error', text: validationMessage });
      return;
    }

    const sgpa = parseOptionalNumber(form.sgpa);
    const cgpa = parseOptionalNumber(form.cgpa);
    const attendanceOverall = parseOptionalNumber(form.attendanceOverall);
    const marks = parseOptionalNumber(form.marks);
    const subjectAttendance = parseOptionalNumber(form.subjectAttendance);

    const subjects = [];
    if (form.subjectName.trim() && marks !== null) {
      subjects.push({
        name: form.subjectName.trim(),
        code: form.subjectCode.trim() || null,
        marks,
        grade: form.grade.trim() || null,
        attendance: subjectAttendance,
      });
    }

    const semesterResults = [];
    if (form.semester.trim()) {
      semesterResults.push({
        semester: form.semester.trim(),
        sgpa,
        subjects,
      });
    }

    const payload = {
      semester_results: semesterResults,
      sgpa_trend: form.semester.trim() && sgpa !== null
        ? [{ semester: form.semester.trim(), sgpa }]
        : [],
      cgpa,
      attendance_overall: attendanceOverall,
      pending_tasks: form.pendingTask.trim()
        ? [{
            title: form.pendingTask.trim(),
            priority: form.taskPriority,
          }]
        : [],
    };

    setSaving(true);
    setSaveMessage({ type: '', text: '' });

    try {
      await upsertStudentRecord(form.studentId.trim(), payload);
      setSaveMessage({ type: 'success', text: 'Student record saved successfully.' });
      setSelectedStudentId(form.studentId.trim());
      await loadStudentList();
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save student record.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setBulkResult({ error: 'Please select a CSV file before upload.' });
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);
    try {
      const result = await bulkUploadStudentRecords(bulkFile);
      setBulkResult(result);
      await loadStudentList();
    } catch (error) {
      setBulkResult({
        error: error.response?.data?.detail || 'Bulk upload failed.',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Faculty/Admin Panel</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">Student Academic Management</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage results, performance analytics, and attendance records in one workspace.
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

        <section className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
          <form onSubmit={handleFilterSubmit} className="grid gap-3 md:grid-cols-4">
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Student ID</span>
              <input
                type="text"
                value={filters.student_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, student_id: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="2024A6R009"
              />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Semester</span>
              <input
                type="text"
                value={filters.semester}
                onChange={(event) => setFilters((prev) => ({ ...prev, semester: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="4"
              />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Section</span>
              <input
                type="text"
                value={filters.section}
                onChange={(event) => setFilters((prev) => ({ ...prev, section: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                placeholder="A"
              />
            </label>
            <div className="flex items-end gap-2 md:col-span-1">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Search size={14} />
                Apply Filters
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Student Records</h2>
            </div>

            {listError && (
              <p className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-sm text-destructive">
                {listError}
              </p>
            )}

            {listLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle size={14} className="animate-spin" />
                Loading records...
              </div>
            ) : (
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {students.map((student) => (
                  <button
                    key={student.student_id}
                    type="button"
                    onClick={() => handleSelectStudent(student.student_id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedStudentId === student.student_id
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{student.student_id}</p>
                    <p className="text-xs text-muted-foreground">{student.student_name || student.student_email || 'Unknown student'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      CGPA: {student.cgpa ?? 'N/A'} · Attendance: {student.attendance_overall ?? 'N/A'}
                    </p>
                  </button>
                ))}
                {!students.length && (
                  <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No records found for the selected filters.
                  </p>
                )}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm lg:col-span-3">
            <div className="mb-3 flex items-center gap-2">
              <Database size={18} className="text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Update Student Record</h2>
            </div>

            {saveMessage.text && (
              <p className={`mb-3 rounded-lg border p-2 text-sm ${
                saveMessage.type === 'success'
                  ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-600'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'
              }`}>
                {saveMessage.text}
              </p>
            )}

            {recordLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle size={14} className="animate-spin" />
                Loading selected student...
              </div>
            ) : (
              <form onSubmit={handleSaveRecord} className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Student ID</span>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Student ID"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Semester</span>
                  <input
                    type="text"
                    value={form.semester}
                    onChange={(event) => setForm((prev) => ({ ...prev, semester: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="4"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">SGPA</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={form.sgpa}
                    onChange={(event) => setForm((prev) => ({ ...prev, sgpa: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">CGPA</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={form.cgpa}
                    onChange={(event) => setForm((prev) => ({ ...prev, cgpa: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall Attendance (%)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.attendanceOverall}
                    onChange={(event) => setForm((prev) => ({ ...prev, attendanceOverall: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject Name</span>
                  <input
                    type="text"
                    value={form.subjectName}
                    onChange={(event) => setForm((prev) => ({ ...prev, subjectName: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Operating Systems"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject Code</span>
                  <input
                    type="text"
                    value={form.subjectCode}
                    onChange={(event) => setForm((prev) => ({ ...prev, subjectCode: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="CSE401"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Marks</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.marks}
                    onChange={(event) => setForm((prev) => ({ ...prev, marks: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Grade</span>
                  <input
                    type="text"
                    value={form.grade}
                    onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="A"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject Attendance (%)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.subjectAttendance}
                    onChange={(event) => setForm((prev) => ({ ...prev, subjectAttendance: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Task</span>
                  <input
                    type="text"
                    value={form.pendingTask}
                    onChange={(event) => setForm((prev) => ({ ...prev, pendingTask: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    placeholder="Submit lab report"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Task Priority</span>
                  <select
                    value={form.taskPriority}
                    onChange={(event) => setForm((prev) => ({ ...prev, taskPriority: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
                  >
                    {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving...' : 'Save Student Record'}
                  </button>
                </div>
              </form>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileUp size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Bulk CSV Upload</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Required columns: student_id, semester, subject_name, marks. Optional: subject_code, grade, attendance, sgpa, cgpa.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setBulkFile(event.target.files?.[0] || null)}
              className="max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleBulkUpload}
              disabled={bulkLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {bulkLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Filter size={14} />}
              {bulkLoading ? 'Uploading...' : 'Upload CSV'}
            </button>
          </div>

          {bulkResult?.error && (
            <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-sm text-destructive">
              {bulkResult.error}
            </p>
          )}

          {bulkResult && !bulkResult.error && (
            <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="text-foreground">Processed rows: {bulkResult.processed_count}</p>
              <p className="text-foreground">Updated records: {bulkResult.updated_records}</p>
              {!!bulkResult.errors?.length && (
                <div>
                  <p className="font-medium text-destructive">Validation issues:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-destructive">
                    {bulkResult.errors.slice(0, 8).map((rowError) => (
                      <li key={`${rowError.row}-${rowError.message}`}>
                        Row {rowError.row}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Audit metadata is automatically tracked with each update (updated_by and updated_at).
          </div>
        </footer>
      </div>
    </div>
  );
}
