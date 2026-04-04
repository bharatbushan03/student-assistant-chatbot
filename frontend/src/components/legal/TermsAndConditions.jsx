import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-full flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-ring">
            Miety AI
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-8">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileText size={24} className="text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Terms and Conditions
            </h1>
          </div>

          <p className="text-muted-foreground mb-8">
            Last updated: <span className="text-foreground">January 1, 2025</span>
          </p>

          {/* Sections */}
          <div className="space-y-8 text-foreground/90 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                1. Agreement to Terms
              </h2>
              <p className="mb-3">
                Welcome to MIETY AI. These Terms and Conditions ("Terms") govern your use of the MIETY AI chatbot service (the "Service") provided by MIET Jammu. By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                2. Eligibility
              </h2>
              <p className="mb-3">
                To use this Service, you must:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Be a currently enrolled student of MIET Jammu</li>
                <li>Have a valid @mietjammu.in email address</li>
                <li>Be at least 18 years of age</li>
                <li>Provide accurate and complete registration information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                3. Account Registration
              </h2>
              <p className="mb-3">
                To access the Service, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
                <li>Keeping your account information up to date</li>
              </ul>
              <p className="mt-3">
                We reserve the right to suspend or terminate accounts that violate these Terms or engage in suspicious activity.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                4. Acceptable Use
              </h2>
              <p className="mb-3">
                You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Use the Service for academic dishonesty, cheating, or plagiarism</li>
                <li>Submit false, misleading, or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the Service to harass, abuse, or harm others</li>
                <li>Reverse engineer, decompile, or disassemble the Service</li>
                <li>Use automated systems to access the Service without permission</li>
                <li>Share your account credentials with others</li>
                <li>Use the Service for commercial purposes without authorization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                5. AI-Generated Content Disclaimer
              </h2>
              <p className="mb-3">
                The Service uses artificial intelligence to generate responses. You acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>AI-generated responses may contain errors or inaccuracies</li>
                <li>The Service should not be relied upon for critical decisions</li>
                <li>You are responsible for verifying any information obtained</li>
                <li>The Service does not provide professional advice (legal, medical, financial, etc.)</li>
                <li>We do not guarantee the accuracy, completeness, or reliability of responses</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                6. Intellectual Property Rights
              </h2>
              <p className="mb-3">
                The Service and its original content, features, and functionality are owned by MIET Jammu and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="mt-3">
                You retain ownership of content you submit. However, by submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, and display that content for the purpose of operating and improving the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                7. Privacy
              </h2>
              <p className="mb-3">
                Your privacy is important to us. Please review our <button onClick={() => navigate('/privacy-policy')} className="text-primary hover:underline">Privacy Policy</button>, which explains how we collect, use, and protect your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                8. Service Availability
              </h2>
              <p className="mb-3">
                We strive to maintain the Service but:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>We do not guarantee uninterrupted or error-free operation</li>
                <li>We may modify or discontinue features without notice</li>
                <li>We may perform maintenance that temporarily affects availability</li>
                <li>We are not liable for any downtime or data loss</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                9. Disclaimer of Warranties
              </h2>
              <p className="mb-3">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Implied warranties of merchantability</li>
                <li>Implied warranties of fitness for a particular purpose</li>
                <li>Implied warranties of non-infringement</li>
                <li>Warranties of accuracy or completeness</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                10. Limitation of Liability
              </h2>
              <p className="mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, MIET JAMMU SHALL NOT BE LIABLE FOR:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Any indirect, incidental, special, or consequential damages</li>
                <li>Loss of profits, data, or business opportunities</li>
                <li>Personal injury or property damage</li>
                <li>Any damages resulting from reliance on AI-generated content</li>
                <li>Any damages exceeding the amount you paid for the Service (if any)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                11. Indemnification
              </h2>
              <p className="mb-3">
                You agree to indemnify, defend, and hold harmless MIET Jammu and its officers, employees, and agents from any claims, damages, losses, or expenses arising from:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Content you submit or share</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                12. Termination
              </h2>
              <p className="mb-3">
                We may terminate or suspend your access to the Service at any time, with or without cause, with or without notice. Upon termination:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your right to use the Service will immediately cease</li>
                <li>We may delete your account and associated data</li>
                <li>Provisions that should survive termination will remain in effect</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                13. Changes to Terms
              </h2>
              <p className="mb-3">
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Your continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                14. Governing Law
              </h2>
              <p className="mb-3">
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of courts in Jammu and Kashmir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                15. Contact Information
              </h2>
              <p className="mb-3">
                For questions about these Terms, please contact us:
              </p>
              <ul className="list-none space-y-1 ml-4">
                <li>Email: <a href="mailto:legal@mietjammu.in" className="text-primary hover:underline">legal@mietjammu.in</a></li>
                <li>Address: MIET Jammu, Legal Department</li>
              </ul>
            </section>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground text-center">
            By using MIETY AI, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsAndConditions;
