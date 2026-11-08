import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, MessageSquare, Shield } from 'lucide-react';

export function AuthFrame({ children }) {
  return (
    <div className="auth-screen">
      <aside className="auth-brand">
        <div>
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold">
              M
            </span>
            <div>
              <p className="text-sm font-medium text-white/70">MIET Jammu</p>
              <p className="text-lg font-semibold">MIETY AI</p>
            </div>
          </div>
          <h2 className="mt-10 max-w-md text-4xl font-semibold leading-tight">
            One campus workspace for study, projects, and student records.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
            Ask questions from college material, work in project rooms, and keep academic records in the same place.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-white/85">
          <li className="flex items-center gap-3">
            <MessageSquare size={16} />
            Study chat with college documents
          </li>
          <li className="flex items-center gap-3">
            <GraduationCap size={16} />
            Dashboards for students, faculty, and admins
          </li>
          <li className="flex items-center gap-3">
            <Shield size={16} />
            Accounts stay on @mietjammu.in email
          </li>
        </ul>
      </aside>

      <main className="auth-panel">
        <div className="w-full max-w-md">
          {children}
          <div className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/privacy-policy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <span className="px-2">|</span>
            <Link to="/terms-and-conditions" className="hover:text-foreground">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
