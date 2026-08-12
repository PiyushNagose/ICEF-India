import { useState } from "react";
import {
  ChevronDown,
  BookOpen,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PageFrame,
  PageHero,
  SearchInput,
  ResourceCard,
  HelpPanel,
  publicContainer,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.08 },
  }),
};

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(0);

  const categories = [
    {
      id: 1,
      title: "Getting Started",
      icon: BookOpen,
      articles: [
        {
          id: 1,
          title: "How to Register on the Portal",
          content:
            "Step-by-step guide to create your account and complete your profile.",
          readTime: "5 min",
        },
        {
          id: 2,
          title: "Understanding Job Categories",
          content:
            "Learn about different job categories and how to find jobs matching your profile.",
          readTime: "4 min",
        },
        {
          id: 3,
          title: "Smart Eligibility Filter Explained",
          content:
            "How to use the smart eligibility filter to find jobs you are qualified for.",
          readTime: "3 min",
        },
      ],
    },
    {
      id: 2,
      title: "Application Process",
      icon: CheckCircle,
      articles: [
        {
          id: 4,
          title: "Applying for a Job",
          content:
            "Complete walkthrough of the 9-step application process with tips.",
          readTime: "8 min",
        },
        {
          id: 5,
          title: "Document Upload Requirements",
          content:
            "What documents you need to upload and accepted file formats.",
          readTime: "5 min",
        },
        {
          id: 6,
          title: "Application Payment Guide",
          content: "How to pay application fees and available payment methods.",
          readTime: "4 min",
        },
        {
          id: 7,
          title: "Saving Draft Applications",
          content: "How to save your application as draft and continue later.",
          readTime: "3 min",
        },
      ],
    },
    {
      id: 3,
      title: "Account & Profile",
      icon: HelpCircle,
      articles: [
        {
          id: 8,
          title: "Updating Your Profile",
          content: "How to update personal information and profile details.",
          readTime: "4 min",
        },
        {
          id: 9,
          title: "Password Reset & Security",
          content: "Steps to reset your password and secure your account.",
          readTime: "3 min",
        },
        {
          id: 10,
          title: "Managing Multiple Applications",
          content: "How to track and manage applications for different jobs.",
          readTime: "5 min",
        },
      ],
    },
    {
      id: 4,
      title: "Results & Admit Cards",
      icon: AlertCircle,
      articles: [
        {
          id: 11,
          title: "Checking Your Results",
          content: "How to view your exam results and merit list status.",
          readTime: "3 min",
        },
        {
          id: 12,
          title: "Downloading Admit Cards",
          content: "Steps to download and print your admit card for the exam.",
          readTime: "2 min",
        },
        {
          id: 13,
          title: "Understanding Result Status",
          content: "What different result statuses mean and next steps.",
          readTime: "4 min",
        },
      ],
    },
  ];

  const faqs = [
    {
      question: "What is the Smart Eligibility Filter?",
      answer:
        "The Smart Eligibility Filter helps you find jobs you are qualified for based on your education, age, and category. Simply enter your qualification, age, and category on the home page, and the system will show all matching job opportunities.",
    },
    {
      question: "How do I know if I am eligible for a job?",
      answer:
        "Each job has specific eligibility criteria including age limits, educational qualifications, and experience requirements. The system automatically checks your profile against these criteria. You can also see detailed eligibility requirements on each job posting.",
    },
    {
      question: "Can I apply for multiple jobs?",
      answer:
        "Yes, you can apply for multiple jobs. Each application is separate and gets its own registration number after submission. Track each application from the public status page using that registration number and registered mobile OTP.",
    },
    {
      question: "What if I made a mistake in my application?",
      answer:
        "Once submitted, applications cannot be edited. However, you can save your application as a draft before submission and make corrections. After submission, you can contact support for assistance.",
    },
    {
      question: "How long does it take to process my application?",
      answer:
        "Applications are processed according to the recruitment timeline. You will receive email/SMS updates where enabled, and you can check status from the public status page using your registration number and mobile OTP.",
    },
    {
      question: "What payment methods are accepted?",
      answer:
        "We accept payments through Razorpay, PayU, CCAvenue, and BillDesk. You can use credit cards, debit cards, net banking, and UPI for payment.",
    },
    {
      question: "How do I reset my password?",
      answer:
        'Click on "Forgot Password" on the login page, enter your email, and follow the instructions sent to your email to reset your password.',
    },
    {
      question: "Can I download my admit card before the exam date?",
      answer:
        'Admit cards are available only after the official release window opens. You can download and print them from the public "Admit Cards" page using your registration number and registered mobile OTP.',
    },
  ];

  const filteredCategories = categories.map((cat) => ({
    ...cat,
    articles: cat.articles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  }));

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <PageFrame>
      <PageHero
        eyebrow="Support"
        title="Help Center"
        description="Find answers to your questions and get support for registration, applications, payments, and more."
      />

      <section className={`${publicContainer} py-8`}>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Search */}
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search help articles and FAQs..."
            />

            {/* Knowledge Base */}
            <div>
              <h2 className="text-2xl font-black text-[#1f1d1b] mb-4">
                Knowledge Base
              </h2>

              <div className="space-y-3">
                {filteredCategories.map((category, index) => {
                  const Icon = category.icon;
                  const hasArticles = category.articles.length > 0;

                  return (
                    <motion.div
                      key={category.id}
                      custom={index}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.1 }}
                      className="bg-white border border-[#e0d7cd] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === index ? -1 : index,
                          )
                        }
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#faf7f2] transition"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-orange-600" />
                          <div className="text-left">
                            <h3 className="font-black text-[#1f1d1b]">
                              {category.title}
                            </h3>
                            <p className="text-xs text-[#8a8179]">
                              {category.articles.length} articles
                            </p>
                          </div>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`text-[#8a8179] transition-transform ${
                            expandedCategory === index ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedCategory === index && hasArticles && (
                        <div className="border-t border-[#e0d7cd] bg-[#faf7f2] p-4 space-y-3">
                          {category.articles.map((article) => (
                            <div
                              key={article.id}
                              className="bg-white p-4 rounded border border-[#e0d7cd] hover:border-orange-300 transition cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h4 className="font-black text-[#1f1d1b] text-sm">
                                    {article.title}
                                  </h4>
                                  <p className="text-xs text-[#6d6761] mt-1">
                                    {article.content}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-[#8a8179] mt-2">
                                    <Clock size={12} />
                                    {article.readTime}
                                  </div>
                                </div>
                                <ArrowRight
                                  size={16}
                                  className="text-orange-600 flex-shrink-0"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {expandedCategory === index && !hasArticles && (
                        <div className="border-t border-[#e0d7cd] bg-[#faf7f2] p-4 text-center text-[#6d6761] text-sm">
                          No articles found
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* FAQs */}
            <div>
              <h2 className="text-2xl font-black text-[#1f1d1b] mb-4">
                Frequently Asked Questions
              </h2>

              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <motion.details
                    key={index}
                    custom={index}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.1 }}
                    className="group bg-white border border-[#e0d7cd] rounded-lg p-5"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-black text-[#1f1d1b]">
                      <span className="text-sm">{faq.question}</span>
                      <ChevronDown className="w-5 h-5 text-orange-600 group-open:rotate-180 transition-transform flex-shrink-0" />
                    </summary>
                    <p className="mt-4 text-sm leading-6 text-[#6d6761]">
                      {faq.answer}
                    </p>
                  </motion.details>
                ))}
              </div>

              {filteredFaqs.length === 0 && (
                <div className="bg-white border border-[#e0d7cd] rounded-lg p-8 text-center">
                  <AlertCircle className="w-10 h-10 text-[#c7bdb3] mx-auto mb-3" />
                  <p className="font-black text-[#1f1d1b]">No FAQs found</p>
                  <p className="text-sm text-[#6d6761] mt-1">
                    Try adjusting your search
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-28">
            <HelpPanel />
            <ResourceCard
              icon={Phone}
              title="Call Us"
              description="1800-123-4567, Mon-Fri 9 AM - 6 PM"
              to="/contact"
            />
            <ResourceCard
              icon={Mail}
              title="Email Support"
              description="support@recruitment.gov.in"
              to="/contact"
            />
            <button
              onClick={() => navigate("/contact")}
              className="w-full h-11 rounded bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16] transition"
            >
              Contact Support
            </button>
          </aside>
        </div>
      </section>
    </PageFrame>
  );
};

export default HelpCenter;


