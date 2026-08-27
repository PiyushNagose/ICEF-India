import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "../components/common/ProtectedRoute";
import GlobalPageLoader from "../components/common/GlobalPageLoader";

// Lazy load all other components
const AdminLogin = lazy(() => import("../app/auth/AdminLogin"));
const EmployeeLogin = lazy(() => import("../app/auth/EmployeeLogin"));
const ForgotPassword = lazy(() => import("../app/auth/ForgotPassword"));

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
const JobDetails = lazy(() => import("../app/public/JobDetails"));
const Results = lazy(() => import("../app/public/Results"));
const AdmitCards = lazy(() => import("../app/public/AdmitCards"));
const Contact = lazy(() => import("../app/public/Contact"));
const HowToApply = lazy(() => import("../app/public/HowToApply"));
const ProjectLanding = lazy(() => import("../app/public/ProjectLanding"));
const PublicRecruitments = lazy(
  () => import("../app/public/PublicRecruitments"),
);
const PublicApplyEntry = lazy(() => import("../app/public/PublicApplyEntry"));
const CheckStatus = lazy(() => import("../app/public/CheckStatus"));
const CorrectionRequest = lazy(() => import("../app/public/CorrectionRequest"));

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
const StandardsSettings = lazy(() => import("../app/admin/StandardsSettings"));
const AdminApplications = lazy(() => import("../app/admin/Applications"));
const AdminAdmitCards = lazy(() => import("../app/admin/AdmitCards"));
const AdminAdmitCardTemplates = lazy(() => import("../app/admin/AdmitCardTemplates"));
const ExamCenters = lazy(() => import("../app/admin/ExamCenters"));
const CenterWizard = lazy(() => import("../app/admin/CenterWizard"));
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

const AppRoutes = () => {
  return (
    <Suspense fallback={<GlobalPageLoader />}>
      <Routes>
        <Route path="/" element={<PublicRecruitments />} />

        {/* Auth Routes */}
        <Route path="/auth/admin-login" element={<AdminLogin />} />
        <Route path="/auth/employee-login" element={<EmployeeLogin />} />
        {/* Separate Forgot Password routes for internal account types */}
        <Route path="/auth/admin/forgot-password" element={<ForgotPassword accountType="admin" />} />
        <Route
          path="/auth/employee/forgot-password"
          element={<ForgotPassword accountType="employee" />}
        />

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
        <Route path="/jobs" element={<PublicRecruitments />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/about" element={<PublicRecruitments />} />
        <Route path="/eligible-jobs" element={<PublicRecruitments />} />
        <Route path="/results" element={<Results />} />
        <Route path="/notices" element={<PublicRecruitments />} />
        <Route path="/admit-cards" element={<AdmitCards />} />
        <Route path="/admit-cards/verify/:token" element={<AdmitCards />} />
        <Route path="/downloads" element={<PublicRecruitments />} />
        <Route path="/faq" element={<PublicRecruitments />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/how-to-apply" element={<HowToApply />} />
        <Route path="/help-center" element={<Contact />} />
        <Route path="/technical-support" element={<Contact />} />

        {/* Public project landing + OTP verified application entry */}
        <Route path="/apply/:slug" element={<ProjectLanding />} />
        <Route path="/apply/:slug/jobs/:id" element={<JobDetails />} />
        <Route path="/state/:stateSlug" element={<Navigate to="/jobs" replace />} />
        <Route path="/apply/:slug/start" element={<PublicApplyEntry />} />
        <Route path="/check-status" element={<CheckStatus />} />
        <Route path="/correction-request" element={<CorrectionRequest />} />

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
          path="/admin/projects/:id/edit"
          element={
            <ProtectedRoute role="admin" permission={["projects", "edit"]}>
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
          path="/admin/projects/:id/preview"
          element={
            <ProtectedRoute role="admin" permission={["projects", "view"]}>
              <ProjectLanding preview />
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
          path="/admin/centers"
          element={
            <ProtectedRoute role="admin" permission={["admitCards", "view"]}>
              <ExamCenters />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/centers/new"
          element={
            <ProtectedRoute role="admin" permission={["admitCards", "create"]}>
              <CenterWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/centers/:id/edit"
          element={
            <ProtectedRoute role="admin" permission={["admitCards", "edit"]}>
              <CenterWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/admit-card-templates"
          element={
            <ProtectedRoute role="admin" permission={["admitCards", "view"]}>
              <AdminAdmitCardTemplates />
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
            <ProtectedRoute role="admin" permission={["activityLogs", "view"]}>
              <ActivityLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/activity-logs/:id"
          element={
            <ProtectedRoute role="admin" permission={["activityLogs", "view"]}>
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
            <ProtectedRoute role="admin" permission={["cms", "view"]}>
              <CmsHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/create"
          element={
            <ProtectedRoute role="admin" permission={["cms", "create"]}>
              <CmsCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/edit/:state"
          element={
            <ProtectedRoute role="admin" permission={["cms", "edit"]}>
              <CmsEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/standards-settings"
          element={
            <ProtectedRoute role="admin" permission={["standardsSettings", "view"]}>
              <StandardsSettings />
            </ProtectedRoute>
          }
        />

        {/* Legacy candidate portal routes now resolve to public services */}
        <Route
          path="/candidate"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/dashboard"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/profile"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/jobs"
          element={<PublicRecruitments />}
        />
        <Route
          path="/candidate/applications"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/applications/:id"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/documents"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/payments"
          element={<Navigate to="/check-status" replace />}
        />
        <Route
          path="/candidate/admit-card"
          element={<Navigate to="/admit-cards" replace />}
        />
        <Route
          path="/candidate/results"
          element={<Navigate to="/results" replace />}
        />
        <Route
          path="/candidate/support"
          element={<Navigate to="/contact" replace />}
        />
        <Route
          path="/candidate/support/:id"
          element={<Navigate to="/contact" replace />}
        />
        <Route
          path="/candidate/notifications"
          element={<Navigate to="/check-status" replace />}
        />

        {/* Fallback Route */}
        <Route path="*" element={<PublicRecruitments />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
