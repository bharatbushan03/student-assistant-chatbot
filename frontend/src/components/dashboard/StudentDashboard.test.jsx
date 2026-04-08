import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudentDashboard from './StudentDashboard';
import { fetchStudentDashboard } from '../../utils/academicsApi';

vi.mock('../../utils/academicsApi', () => ({
  fetchStudentDashboard: vi.fn(),
}));

describe('StudentDashboard render states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty-state sections when no records are available', async () => {
    fetchStudentDashboard.mockResolvedValueOnce({
      profile: {
        id: 'student-1',
        email: 'student@mietjammu.in',
        role: 'student',
        name: 'Test Student',
        college_id: '2024A6R009',
        section: 'A',
        semester: '4',
      },
      results_summary: {
        latest_semester: null,
        latest_sgpa: null,
        cgpa: null,
        total_subjects: 0,
        subjects: [],
      },
      analytics: {
        sgpa_trend: [],
        strong_subjects: [],
        weak_subjects: [],
        attendance_summary: {
          overall_percentage: null,
          below_threshold: false,
          threshold: 75,
        },
      },
      insights: [],
      pending_tasks: [],
      empty_states: {
        results: true,
        analytics: true,
        insights: true,
      },
    });

    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No results uploaded yet. Ask faculty/admin to publish your subject marks.')).toBeInTheDocument();
    });

    expect(screen.getByText('Performance analytics will appear once semester SGPA data is available.')).toBeInTheDocument();
  });

  it('renders API error state when dashboard request fails', async () => {
    fetchStudentDashboard.mockRejectedValueOnce(new Error('Network unavailable'));

    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load student dashboard.')).toBeInTheDocument();
    });
  });
});
