import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, FileCheck2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import {
  HelpPanel,
  PageFrame,
  PageHero,
  ResourceCard,
  fadeUp,
  publicContainer,
} from "./PublicPageShell";

const steps = [
  {
    icon: ShieldCheck,
    title: "Verify Your Contact",
    description:
      "Start from an active job and verify your email and mobile OTP. No candidate account is required.",
  },
  {
    icon: FileCheck2,
    title: "Choose an Active Job",
    description:
      "Open the job detail page, review eligibility, documents, fee, and deadline.",
  },
  {
    icon: CheckCircle2,
    title: "Complete Application",
    description:
      "Fill personal, education, address, document, and post preference sections.",
  },
  {
    icon: CreditCard,
    title: "Submit and Track",
    description:
      "Pay the applicable fee, submit the form, and track status using registration number plus mobile OTP.",
  },
];

const HowToApply = () => (
  <PageFrame>
    <PageHero
      eyebrow="Candidate Guide"
      title="How to Apply"
      description="Follow the official application flow from OTP verification to final submission. The same steps are used by every active job published on this portal."
    />

    <section className={`${publicContainer} py-8 lg:py-10`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start">
        <div className="space-y-5">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              custom={index}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="bg-white border border-[#e0d7cd] rounded-lg p-6 flex gap-5"
            >
              <div className="w-12 h-12 rounded bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <step.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] font-black text-[#9a8f86]">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 text-[24px] font-black leading-tight text-[#1f1d1b]">
                  {step.title}
                </h2>
                <p className="mt-2 text-[14px] leading-[26px] text-[#5f5752] font-medium">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <ResourceCard
              title="Back to Recruitment"
              description="Return to the project public URL and choose the published post you want to apply for."
              to="/"
            />
          </motion.div>
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <HelpPanel />
          </motion.div>
          <motion.div
            variants={fadeUp}
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Link
              to="/"
              className="flex h-12 items-center justify-center rounded bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16] transition-colors"
            >
              Open Recruitment
            </Link>
          </motion.div>
        </aside>
      </div>
    </section>
  </PageFrame>
);

export default HowToApply;
