import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Send } from "lucide-react";
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

const contactCards = [
  { icon: Phone, title: "Helpline", description: "1800-123-4567, available Monday to Friday between 9:00 AM and 6:00 PM.", to: "/faq" },
  { icon: Mail, title: "Email Support", description: "support@recruitment.gov.in for technical and application related assistance.", to: "/faq" },
  { icon: MapPin, title: "Office", description: "Recruitment Portal Helpdesk, New Delhi, India.", to: "/about" },
  { icon: Send, title: "Candidate Ticket", description: "Login to submit a tracked support ticket for your application.", to: "/candidate/support" },
];

const Contact = () => (
  <PageFrame>
    <PageHero
      eyebrow="Support"
      title="Contact the Recruitment Helpdesk"
      description="Use the official support channels for application, payment, document, and portal access queries. Logged-in candidates can also raise support tickets from their dashboard."
    />

    <section className={`${publicContainer} py-8 lg:py-10`}>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5 md:grid-cols-2">
          {contactCards.map((card, i) => (
            <motion.div
              key={card.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="h-full"
            >
              <ResourceCard icon={card.icon} title={card.title} description={card.description} to={card.to} />
            </motion.div>
          ))}
        </div>

        <motion.aside
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-5"
        >
          <HelpPanel />
          <Link
            to="/auth/candidate-login"
            className="flex h-12 items-center justify-center rounded bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16] transition-colors"
          >
            Login for Ticket Support
          </Link>
        </motion.aside>
      </div>
    </section>
  </PageFrame>
);

export default Contact;


