import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "../components/common/ProtectedRoute";

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span className="text-gray-600">Loading...</span>
    </div>
  </div>
);

// Import Home directly for better performance
import Home from "../app/public/Home";

// Lazy load all other components
const Login = lazy(() => import("../app/auth/Login"));
const CandidateLogin = lazy(() => import("../app/auth/CandidateLogin"));
const AdminLogin = lazy(() => import("../app/auth/AdminLogin"));
const EmployeeLogin = lazy(() => import("../app/auth/EmployeeLogin"));
const Register = lazy(() => import("../app/auth/Register"));
const ForgotPassword = lazy(() => import("../app/auth/ForgotPassword"));
const VerifyOTP = lazy(() => import("../app/auth/VerifyOTP"));

// Application Flow Pages
const PersonalDetails = lazy(
  () => import("../app/application/PersonalDetails"),
);
const Education = lazy(() => import("../app/application/Education"));
const AdditionalInfo = lazy(() => import("../app/application/AdditionalInfo"));
const Address = lazy(() => import("../app/application/Address"));
const DynamicFormFields = lazy(
  () => import("../app/application/DynamicFormFields"),
);
const ApplicationDocuments = lazy(() => import("../app/application/Documents"));
const Review = lazy(() => import("../app/application/Review"));
const PostSelection = lazy(() => import("../app/application/PostSelection"));
const Payment = lazy(() => import("../app/application/Payment"));
const Success = lazy(() => import("../app/application/Success"));

// Public Pages
const About = lazy(() => import("../app/public/About"));
const Jobs = lazy(() => import("../app/public/Jobs"));
const JobDetails = lazy(() => import("../app/public/JobDetails"));
const EligibleJobs = lazy(() => import("../app/public/EligibleJobs"));
const Results = lazy(() => import("../app/public/Results"));
const Notices = lazy(() => import("../app/public/Notices"));
const AdmitCards = lazy(() => import("../app/public/AdmitCards"));
const Downloads = lazy(() => import("../app/public/Downloads"));
const FAQ = lazy(() => import("../app/public/FAQ"));
const Contact = lazy(() => import("../app/public/Contact"));
const HowToApply = lazy(() => import("../app/public/HowToApply"));
const HelpCenter = lazy(() => import("../app/public/HelpCenter"));
const TechnicalSupport = lazy(() => import("../app/public/TechnicalSupport"));

// Admin Pages
const AdminDashboard = lazy(() => import("../app/admin/Dashboard"));
const PaymentSettings = lazy(() => import("../app/admin/PaymentSettings"));
const GatewayConfig = lazy(() => import("../app/admin/GatewayConfig"));
const AddPaymentGateway = lazy(() => import("../app/admin/AddPaymentGateway"));
const Projects = lazy(() => import("../app/admin/Projects"));
const CreateProject = lazy(() => import("../app/admin/CreateProject"));
const ProjectDetails = lazy(() => import("../app/admin/ProjectDetails"));
const AdminJobs = lazy(() => import("../app/admin/Jobs"));
const JobCreate = lazy(() => import("../app/admin/JobCreate"));
const JobBasicInfo = lazy(() => import("../app/admin/JobBasicInfo"));
const JobEligibility = lazy(() => import("../app/admin/JobEligibility"));
const JobFormBuilder = lazy(() => import("../app/admin/JobFormBuilder"));
const JobDocuments = lazy(() => import("../app/admin/JobDocuments"));
const JobPayment = lazy(() => import("../app/admin/JobPayment"));
const JobReview = lazy(() => import("../app/admin/JobReview"));
const AdminApplications = lazy(() => import("../app/admin/Applications"));
const AdminAdmitCards = lazy(() => import("../app/admin/AdmitCards"));
const ActivityLogs = lazy(() => import("../app/admin/ActivityLogs"));
const EmployeeActivityDetails = lazy(
  () => import("../app/admin/EmployeeActivityDetails"),
);
const AddEmployee = lazy(() => import("../app/admin/AddEmployee"));
const EditEmployee = lazy(() => import("../app/admin/EditEmployee"));
const EmployeeActivity = lazy(() => import("../app/admin/EmployeeActivity"));
const CreateRole = lazy(() => import("../app/admin/CreateRole"));
const EditRole = lazy(() => import("../app/admin/EditRole"));
const ApplicationDetails = lazy(
  () => import("../app/admin/ApplicationDetails"),
);
const Analytics = lazy(() => import("../app/admin/Analytics"));
const FunnelAnalysis = lazy(() => import("../app/admin/FunnelAnalysis"));
const EmployeeActivityLog = lazy(
  () => import("../app/admin/EmployeeActivityLog"),
);
const AdminSupport = lazy(() => import("../app/admin/Support"));
const SupportKanban = lazy(() => import("../app/admin/SupportKanban"));
const SupportTicketDetails = lazy(
  () => import("../app/admin/SupportTicketDetails"),
);
const Employees = lazy(() => import("../app/admin/Employees"));
const Roles = lazy(() => import("../app/admin/Roles"));
const SettingsProfile = lazy(() => import("../app/admin/SettingsProfile"));
const AdminNotifications = lazy(
  () => import("../app/admin/AdminNotifications"),
);
const CmsHome = lazy(() => import("../app/admin/CmsHome"));
const CmsCreate = lazy(() => import("../app/admin/CmsCreate"));
const CmsEdit = lazy(() => import("../app/admin/CmsEdit"));

// Candidate Pages (Dashboard only - no sidebar)
const CandidateDashboard = lazy(() => import("../app/candidate/Dashboard"));
const Profile = lazy(() => import("../app/candidate/Profile"));
const CandidateJobs = lazy(() => import("../app/candidate/Jobs"));
const CandidateApplications = lazy(
  () => import("../app/candidate/Applications"),
);
const ApplicationStatus = lazy(
  () => import("../app/candidate/ApplicationStatus"),
);
const CandidateDocuments = lazy(() => import("../app/candidate/Documents"));
const Payments = lazy(() => import("../app/candidate/Payments"));
const AdmitCard = lazy(() => import("../app/candidate/AdmitCard"));
const CandidateResults = lazy(() => import("../app/candidate/Results"));
const CandidateSupport = lazy(() => import("../app/candidate/Support"));
const CandidateSupportTicketDetail = lazy(
  () => import("../app/candidate/SupportTicketDetail"),
);
const Notifications = lazy(() => import("../app/candidate/Notifications"));

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Home Route */}
        <Route path="/" element={<Home />} />

        {/* Auth Routes */}
        <Route path="/auth/candidate-login" element={<CandidateLogin />} />
        <Route path="/auth/admin-login" element={<AdminLogin />} />
        <Route path="/auth/employee-login" element={<EmployeeLogin />} />
        <Route path="/auth/register" element={<Register />} />
        {/* Separate Forgot Password routes for each account type */}
        <Route
          path="/auth/forgot-password"
          element={<ForgotPassword accountType="candidate" />}
        />
        <Route
          path="/auth/admin/forgot-password"
          element={<ForgotPassword accountType="admin" />}
        />
        <Route
          path="/auth/employee/forgot-password"
          element={<ForgotPassword accountType="employee" />}
        />
        <Route path="/auth/verify-otp" element={<VerifyOTP />} />

        {/* Application Flow Routes (after OTP verification) */}
        <Route
          path="/application/personal-details"
          element={
            <ProtectedRoute role="candidate">
              <PersonalDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/education"
          element={
            <ProtectedRoute role="candidate">
              <Education />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/additional-info"
          element={
            <ProtectedRoute role="candidate">
              <AdditionalInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/address"
          element={
            <ProtectedRoute role="candidate">
              <Address />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/form-responses"
          element={
            <ProtectedRoute role="candidate">
              <DynamicFormFields />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/documents"
          element={
            <ProtectedRoute role="candidate">
              <ApplicationDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/review"
          element={
            <ProtectedRoute role="candidate">
              <Review />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/post-selection"
          element={
            <ProtectedRoute role="candidate">
              <PostSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/payment"
          element={
            <ProtectedRoute role="candidate">
              <Payment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/application/success"
          element={
            <ProtectedRoute role="candidate">
              <Success />
            </ProtectedRoute>
          }
        />

        {/* Public Routes */}
        <Route path="/about" element={<About />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/eligible-jobs" element={<EligibleJobs />} />
        <Route path="/results" element={<Results />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/admit-cards" element={<AdmitCards />} />
        <Route path="/admit-cards/verify/:token" element={<AdmitCards />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/how-to-apply" element={<HowToApply />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/technical-support" element={<TechnicalSupport />} />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payment-settings"
          element={
            <ProtectedRoute
              role="admin"
              permission={["paymentSettings", "view"]}
            >
              <PaymentSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payment-settings/add-gateway"
          element={
            <ProtectedRoute
              role="admin"
              permission={["paymentSettings", "create"]}
            >
              <AddPaymentGateway />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payment-settings/:name"
          element={
            <ProtectedRoute
              role="admin"
              permission={["paymentSettings", "edit"]}
            >
              <GatewayConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute role="admin" permission={["projects", "view"]}>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects/create"
          element={
            <ProtectedRoute role="admin" permission={["projects", "create"]}>
              <CreateProject />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects/:id"
          element={
            <ProtectedRoute role="admin" permission={["projects", "view"]}>
              <ProjectDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "view"]}>
              <AdminJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/basic-info"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobBasicInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/eligibility"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobEligibility />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/form-builder"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobFormBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/documents"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/payment"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobPayment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs/create/review"
          element={
            <ProtectedRoute role="admin" permission={["jobs", "create"]}>
              <JobReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/applications"
          element={
            <ProtectedRoute role="admin" permission={["applications", "view"]}>
              <AdminApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/applications/:id"
          element={
            <ProtectedRoute role="admin" permission={["applications", "view"]}>
              <ApplicationDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/admit-cards"
          element={
            <ProtectedRoute role="admin" permission={["admitCards", "view"]}>
              <AdminAdmitCards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute role="admin" permission={["analytics", "view"]}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics/funnel"
          element={
            <ProtectedRoute role="admin" permission={["analytics", "view"]}>
              <FunnelAnalysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity-logs"
          element={
            <ProtectedRoute role="admin" permission={["employees", "view"]}>
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity-logs/:id"
          element={
            <ProtectedRoute role="admin" permission={["employees", "view"]}>
              <EmployeeActivityDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute role="admin" permission={["employees", "view"]}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees/add"
          element={
            <ProtectedRoute role="admin" permission={["employees", "create"]}>
              <AddEmployee />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees/:id/edit"
          element={
            <ProtectedRoute role="admin" permission={["employees", "edit"]}>
              <EditEmployee />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees/:id/activity"
          element={
            <ProtectedRoute role="admin" permission={["employees", "view"]}>
              <EmployeeActivity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute role="admin" permission={["employees", "view"]}>
              <Roles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles/create"
          element={
            <ProtectedRoute role="admin" permission={["employees", "create"]}>
              <CreateRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles/:id/edit"
          element={
            <ProtectedRoute role="admin" permission={["employees", "edit"]}>
              <EditRole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <ProtectedRoute role="admin" permission={["support", "view"]}>
              <AdminSupport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support/kanban"
          element={
            <ProtectedRoute role="admin" permission={["support", "view"]}>
              <SupportKanban />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support/ticket/:id"
          element={
            <ProtectedRoute role="admin" permission={["support", "view"]}>
              <SupportTicketDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings-profile"
          element={
            <ProtectedRoute role="admin">
              <SettingsProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute role="admin">
              <AdminNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms"
          element={
            <ProtectedRoute role="admin" permission={["projects", "edit"]}>
              <CmsHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/create"
          element={
            <ProtectedRoute role="admin" permission={["projects", "edit"]}>
              <CmsCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/edit/:state"
          element={
            <ProtectedRoute role="admin" permission={["projects", "edit"]}>
              <CmsEdit />
            </ProtectedRoute>
          }
        />

        {/* Candidate Routes (Dashboard only - no application flow) */}
        <Route
          path="/candidate"
          element={<Navigate to="/candidate/dashboard" replace />}
        />
        <Route
          path="/candidate/dashboard"
          element={
            <ProtectedRoute role="candidate">
              <CandidateDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/profile"
          element={
            <ProtectedRoute role="candidate">
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/jobs"
          element={
            <ProtectedRoute role="candidate">
              <CandidateJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/applications"
          element={
            <ProtectedRoute role="candidate">
              <CandidateApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/applications/:id"
          element={
            <ProtectedRoute role="candidate">
              <ApplicationStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/documents"
          element={
            <ProtectedRoute role="candidate">
              <CandidateDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/payments"
          element={
            <ProtectedRoute role="candidate">
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/admit-card"
          element={
            <ProtectedRoute role="candidate">
              <AdmitCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/results"
          element={
            <ProtectedRoute role="candidate">
              <CandidateResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/support"
          element={
            <ProtectedRoute role="candidate">
              <CandidateSupport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/support/:id"
          element={
            <ProtectedRoute role="candidate">
              <CandidateSupportTicketDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidate/notifications"
          element={
            <ProtectedRoute role="candidate">
              <Notifications />
            </ProtectedRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
