import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, FileCheck2, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import {
  HelpPanel,
  PageFrame,
  PageHero,
  ResourceCard,
  publicContainer,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};

const steps = [
  {
    icon: UserPlus,
    title: "Register or Login",
    description:
      "Create a candidate account, verify OTP, and keep your profile details updated.",
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
      "Pay the applicable fee, submit the form, and track status from the dashboard.",
  },
];

const HowToApply = () => (
  <PageFrame>
    <PageHero
      eyebrow="Candidate Guide"
      title="How to Apply"
      description="Follow the official application flow from registration to final submission. The same steps are used by every active job published on this portal."
    />

    <section className={`${publicContainer} py-8 lg:py-10`}>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
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
                <h2 className="mt-1 text-xl font-black text-[#1f1d1b]">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d6761]">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <ResourceCard
              title="Browse Active Jobs"
              description="Start from the dynamic job listing and select the recruitment you want to apply for."
              to="/jobs"
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
          >
            <Link
              to="/auth/register"
              className="flex h-12 items-center justify-center rounded bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16] transition-colors"
            >
              Register Now
            </Link>
          </motion.div>
        </aside>
      </div>
    </section>
  </PageFrame>
);

export default HowToApply;


