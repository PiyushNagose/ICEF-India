import { useState } from "react";
import {
  ChevronDown,
  AlertCircle,
  Lock,
  FileText,
  Download,
  Eye,
  Smartphone,
  Monitor,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PageFrame,
  PageHero,
  SearchInput,
  HelpPanel,
  publicContainer,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.07 },
  }),
};

const TechnicalSupport = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const issues = [
    {
      category: "Login & Access",
      icon: Lock,
      problems: [
        {
          id: 1,
          title: "Cannot login to my account",
          solution:
            'Verify your email and password are correct. If you forgot your password, click "Forgot Password" on the login page. Check if your account is active. Clear browser cache and cookies, then try again.',
        },
        {
          id: 2,
          title: "Account locked after multiple login attempts",
          solution:
            'Your account is temporarily locked for security. Wait 30 minutes before trying again, or use the "Forgot Password" option to reset your password.',
        },
        {
          id: 3,
          title: "OTP not received",
          solution:
            'Check your spam/junk folder. Wait 2-3 minutes for the OTP to arrive. Click "Resend OTP" if needed. Ensure your email address is correct. Contact support if the issue persists.',
        },
        {
          id: 4,
          title: "Session expired unexpectedly",
          solution:
            "Sessions expire after 30 minutes of inactivity for security. Log in again to continue. Avoid keeping the page open for extended periods without activity.",
        },
      ],
    },
    {
      category: "Application Issues",
      icon: FileText,
      problems: [
        {
          id: 5,
          title: "Cannot submit application",
          solution:
            "Ensure all required fields are filled. Check that all documents are uploaded. Verify the application deadline has not passed. Try using a different browser or clearing cache.",
        },
        {
          id: 6,
          title: "Application shows as draft",
          solution:
            'You need to complete all steps and click the final "Submit" button. Saving as draft is different from submission. Review all steps and ensure you reach the final submission page.',
        },
        {
          id: 7,
          title: "Cannot upload documents",
          solution:
            "Check file size (max 5MB per file). Ensure file format is supported (PDF, JPG, PNG). Try uploading one document at a time. Disable browser extensions that might block uploads.",
        },
        {
          id: 8,
          title: "Document upload failed",
          solution:
            "Verify file size and format. Check internet connection. Try a different browser. Clear browser cache. If problem persists, contact technical support with your application ID.",
        },
      ],
    },
    {
      category: "Payment Issues",
      icon: Zap,
      problems: [
        {
          id: 9,
          title: "Payment gateway not loading",
          solution:
            "Check your internet connection. Disable ad blockers and browser extensions. Clear browser cache and cookies. Try a different browser. Ensure JavaScript is enabled.",
        },
        {
          id: 10,
          title: "Payment failed but amount deducted",
          solution:
            "The amount will be refunded within 5-7 business days. Check your bank account. If not refunded, contact support with your transaction ID and bank details.",
        },
        {
          id: 11,
          title: "Cannot see payment confirmation",
          solution:
            "Check your email for payment confirmation. Use the public application status page with your registration number and mobile OTP to verify payment status. Contact support if payment shows as pending after 24 hours.",
        },
        {
          id: 12,
          title: "Payment methods not available",
          solution:
            "Ensure your card/account is active and has sufficient balance. Check if your bank allows online transactions. Try a different payment method. Contact your bank if issue persists.",
        },
      ],
    },
    {
      category: "Browser & Device",
      icon: Monitor,
      problems: [
        {
          id: 13,
          title: "Page not loading properly",
          solution:
            "Refresh the page (Ctrl+R or Cmd+R). Clear browser cache and cookies. Try a different browser. Disable browser extensions. Check internet connection speed.",
        },
        {
          id: 14,
          title: "Website not working on mobile",
          solution:
            "Ensure you are using a modern browser (Chrome, Safari, Firefox, Edge). Check internet connection. Disable mobile data saver mode. Try landscape orientation. Clear app cache.",
        },
        {
          id: 15,
          title: "Slow website performance",
          solution:
            "Check your internet speed. Close unnecessary browser tabs. Disable browser extensions. Clear cache and cookies. Try during off-peak hours. Use a wired connection if possible.",
        },
        {
          id: 16,
          title: "Form fields not responding",
          solution:
            "Refresh the page. Clear browser cache. Disable browser extensions. Try a different browser. Ensure JavaScript is enabled. Check for browser compatibility.",
        },
      ],
    },
    {
      category: "File & Download",
      icon: Download,
      problems: [
        {
          id: 17,
          title: "Cannot download admit card",
          solution:
            "Ensure admit card is released by the recruitment authority. Check if you have completed payment. Try a different browser. Disable pop-up blockers. Check download folder.",
        },
        {
          id: 18,
          title: "Downloaded file is corrupted",
          solution:
            "Try downloading again. Use a different browser. Check internet connection during download. Ensure sufficient disk space. Contact support if issue persists.",
        },
        {
          id: 19,
          title: "Cannot open PDF files",
          solution:
            "Install or update PDF reader (Adobe Reader). Try opening in browser instead of downloading. Use a different browser. Check file permissions.",
        },
      ],
    },
  ];

  const filteredIssues = issues.map((cat) => ({
    ...cat,
    problems: cat.problems.filter(
      (problem) =>
        problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.solution.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  }));

  const totalProblems = filteredIssues.reduce(
    (sum, cat) => sum + cat.problems.length,
    0,
  );

  return (
    <PageFrame>
      <PageHero
        eyebrow="Support"
        title="Technical Support"
        description="Troubleshoot common technical issues with login, applications, payments, and browser compatibility."
      />

      <section className={`${publicContainer} py-8`}>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Search */}
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search technical issues..."
            />

            {/* Results count */}
            {searchQuery && (
              <div className="text-sm text-[#6d6761]">
                Found {totalProblems} issue{totalProblems !== 1 ? "s" : ""}{" "}
                matching your search
              </div>
            )}

            {/* Issues by Category */}
            <div className="space-y-4">
              {filteredIssues.map((category) => {
                const Icon = category.icon;
                const hasProblems = category.problems.length > 0;

                return (
                  <div key={category.category}>
                    {/* Category Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5 text-orange-600" />
                      <h2 className="text-lg font-black text-[#1f1d1b]">
                        {category.category}
                      </h2>
                      <span className="text-xs font-black text-[#8a8179] bg-[#faf7f2] px-2 py-1 rounded">
                        {category.problems.length}
                      </span>
                    </div>

                    {/* Problems */}
                    {hasProblems ? (
                      <div className="space-y-2 mb-6">
                        {category.problems.map((problem, idx) => (
                          <details
                            key={problem.id}
                            className="group bg-white border border-[#e0d7cd] rounded-lg p-4"
                          >
                            <summary className="flex cursor-pointer items-center justify-between gap-4 font-black text-[#1f1d1b]">
                              <span className="text-sm text-left">
                                {problem.title}
                              </span>
                              <ChevronDown className="w-5 h-5 text-orange-600 group-open:rotate-180 transition-transform flex-shrink-0" />
                            </summary>
                            <div className="mt-4 pt-4 border-t border-[#e0d7cd]">
                              <p className="text-sm leading-6 text-[#6d6761]">
                                {problem.solution}
                              </p>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-[#faf7f2] border border-[#e0d7cd] rounded-lg p-4 text-center text-[#6d6761] text-sm mb-6">
                        No issues found in this category
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* No results */}
            {totalProblems === 0 && searchQuery && (
              <div className="bg-white border border-[#e0d7cd] rounded-lg p-8 text-center">
                <AlertCircle className="w-10 h-10 text-[#c7bdb3] mx-auto mb-3" />
                <p className="font-black text-[#1f1d1b]">No issues found</p>
                <p className="text-sm text-[#6d6761] mt-1">
                  Try different keywords or contact support
                </p>
              </div>
            )}

            {/* System Requirements */}
            <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 mt-8">
              <h3 className="text-lg font-black text-[#1f1d1b] mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-600" />
                System Requirements
              </h3>
              <div className="space-y-4 text-sm text-[#6d6761]">
                <div>
                  <p className="font-black text-[#1f1d1b] mb-2">
                    Supported Browsers:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Chrome 90+</li>
                    <li>Firefox 88+</li>
                    <li>Safari 14+</li>
                    <li>Edge 90+</li>
                  </ul>
                </div>
                <div>
                  <p className="font-black text-[#1f1d1b] mb-2">
                    Internet Speed:
                  </p>
                  <p>Minimum 2 Mbps for smooth browsing</p>
                </div>
                <div>
                  <p className="font-black text-[#1f1d1b] mb-2">
                    Device Support:
                  </p>
                  <p>Desktop, Tablet, and Mobile devices</p>
                </div>
                <div>
                  <p className="font-black text-[#1f1d1b] mb-2">JavaScript:</p>
                  <p>Must be enabled for full functionality</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-28">
            <HelpPanel />
            <div className="bg-white border border-[#e0d7cd] rounded-lg p-5">
              <h3 className="font-black text-[#1f1d1b] mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-orange-600" />
                Quick Tips
              </h3>
              <ul className="space-y-3 text-sm text-[#6d6761]">
                <li className="flex gap-2">
                  <span className="text-orange-600 font-black">â€¢</span>
                  <span>Clear cache regularly</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-orange-600 font-black">â€¢</span>
                  <span>Use latest browser version</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-orange-600 font-black">â€¢</span>
                  <span>Disable browser extensions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-orange-600 font-black">â€¢</span>
                  <span>Check internet connection</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-orange-600 font-black">â€¢</span>
                  <span>Try incognito/private mode</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </PageFrame>
  );
};

export default TechnicalSupport;


