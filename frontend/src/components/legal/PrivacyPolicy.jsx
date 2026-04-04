import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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
              <Shield size={24} className="text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Privacy Policy
            </h1>
          </div>

          <p className="text-muted-foreground mb-8">
            Last updated: <span className="text-foreground">January 1, 2025</span>
          </p>

          {/* Sections */}
          <div className="space-y-8 text-foreground/90 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                1. Introduction
              </h2>
              <p className="mb-3">
                MIETY AI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered chatbot service for MIET Jammu students.
              </p>
              <p>
                By using our service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                2. Information We Collect
              </h2>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">
                2.1 Personal Information
              </h3>
              <p className="mb-3">When you register for an account, we collect:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                <li>Email address (must be a valid @mietjammu.in address)</li>
                <li>Name (optional)</li>
                <li>College ID (optional)</li>
                <li>Section and Semester information (optional)</li>
                <li>Profile picture (optional)</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">
                2.2 Usage Information
              </h3>
              <p className="mb-3">We automatically collect information about how you use our service:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                <li>Questions and queries submitted to the chatbot</li>
                <li>Chat history and conversation logs</li>
                <li>Interaction patterns and preferences</li>
                <li>Device and browser information</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">
                2.3 Technical Information
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>IP address and device identifiers</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Access times and pages viewed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                3. How We Use Your Information
              </h2>
              <p className="mb-3">We use the collected information for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>To provide, maintain, and improve our chatbot services</li>
                <li>To personalize your experience and deliver relevant content</li>
                <li>To respond to your questions and provide customer support</li>
                <li>To send you technical notices and updates</li>
                <li>To detect and prevent fraud, abuse, and security incidents</li>
                <li>To comply with legal obligations and enforce our terms</li>
                <li>To conduct research and analysis for service improvement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                4. Information Sharing and Disclosure
              </h2>
              <p className="mb-3">We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>With Service Providers:</strong> We share data with trusted third-party services that help us operate (e.g., hosting providers, API services)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect the rights and safety of others</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                5. Data Security
              </h2>
              <p className="mb-3">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Encryption of data in transit using HTTPS</li>
                <li>Secure storage of sensitive information</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Employee training on data protection</li>
              </ul>
              <p className="mt-3">
                However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                6. Your Rights and Choices
              </h2>
              <p className="mb-3">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Opt-out:</strong> Unsubscribe from non-essential communications</li>
                <li><strong>Data Portability:</strong> Request transfer of your data to another service</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, please contact us at <a href="mailto:privacy@mietjammu.in" className="text-primary hover:underline">privacy@mietjammu.in</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                7. Data Retention
              </h2>
              <p className="mb-3">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required by law. When you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                8. Children's Privacy
              </h2>
              <p className="mb-3">
                Our service is intended for students of MIET Jammu who are 18 years of age or older. We do not knowingly collect personal information from children under 18. If we become aware that we have collected information from a child under 18, we will take steps to delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                9. Changes to This Policy
              </h2>
              <p className="mb-3">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date. You are advised to review this policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                10. Contact Us
              </h2>
              <p className="mb-3">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none space-y-1 ml-4">
                <li>Email: <a href="mailto:privacy@mietjammu.in" className="text-primary hover:underline">privacy@mietjammu.in</a></li>
                <li>Address: MIET Jammu, Privacy Office</li>
              </ul>
            </section>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>This Privacy Policy is part of our Terms of Service.</p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
