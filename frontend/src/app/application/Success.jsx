import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Calendar,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  LayoutDashboard,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { candidateService } from "../../services/candidate.service";
import ApplicationAcknowledgement from "../../components/application/ApplicationAcknowledgement";
import {
  readApplicationDraft,
  isCorrectionMode,
  persistApplicationDraft,
} from "../../utils/applicationFlow";
import logo from "../../assets/logo.png";

const Success = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = readApplicationDraft();
  const rawApplicationId = location.state?.applicationId || draft.applicationId;
  const transactionId = location.state?.transactionId || "-";
  const amount = location.state?.amount || 0;
  const selectedPostsFromState = location.state?.selectedPosts || [];
  const submittedAtFromState = location.state?.submittedAt;
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);

  const { data: appData, isLoading } = useQuery({
    queryKey: ["application-success", rawApplicationId],
    queryFn: () => candidateService.getApplication(rawApplicationId),
    enabled: Boolean(rawApplicationId),
    staleTime: 30000,
  });

  const app = appData?.application || appData;
  const correctionMode =
    isCorrectionMode(app) ||
    draft.correctionMode === true ||
    location.state?.correctionMode === true;
  const applicationId = app?.applicationId || rawApplicationId || "-";
  const selectedPosts =
    app?.appliedPosts?.length > 0 ? app.appliedPosts : selectedPostsFromState;
  const submittedAt = app?.submittedAt || submittedAtFromState;
  const formattedDate = submittedAt
    ? new Date(submittedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  const totalAmount = app?.totalFee || amount;

  // Clear draft and fire correction toast on mount
  useEffect(() => {
    if (app && !correctionMode) {
      sessionStorage.removeItem("app_draft");
    }
    if (app && correctionMode) {
      persistApplicationDraft({ correctionMode: false });
      // Small top-right toast — the only success signal in correction mode
      toast.success(
        `✅ Application ${app.applicationId || ""} corrections submitted — admin notified.`,
        { duration: 6000, position: "top-right" },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  const handleDownloadAcknowledgement = () => {
    setShowAcknowledgement(true);
    window.setTimeout(() => window.print(), 120);
  };

  const closeAcknowledgement = () => setShowAcknowledgement(false);

  const handleBackToTicket = () => {
    if (draft.supportTicketId) {
      navigate(`/candidate/support/${draft.supportTicketId}`);
    } else {
      navigate("/candidate/support");
    }
  };

  // Show correction success message
  if (correctionMode) {
    return (
      <div className="customer-motion-root h-screen overflow-hidden bg-gray-50 flex flex-col">
        {/* ── Top-right toast fired once on mount via useEffect in parent ── */}

        <header className="no-print border-b border-orange-200 bg-white px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center space-x-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f1d1b] overflow-hidden">
                <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
              </div>
              <div>
                <div className="font-bold text-gray-800">
                  Recruitment Portal
                </div>
                <div className="text-sm text-gray-600">GOVERNMENT OF INDIA</div>
              </div>
            </button>
          </div>
        </header>

        <main className="application-page-root hover-scroll flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          ) : (
            <>
              {/* Acknowledgement — the only content on this page */}
              {app && (
                <Card className="no-print mb-6 border-emerald-200 bg-emerald-50 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                          <FileText className="h-5 w-5 text-emerald-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-emerald-950">
                            Updated Acknowledgement Ready
                          </h3>
                          <p className="mt-1 text-sm text-emerald-800">
                            Application{" "}
                            <span className="font-mono font-semibold text-orange-600">
                              {applicationId}
                            </span>{" "}
                            — corrections submitted for re-review.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                          onClick={() => setShowAcknowledgement(true)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Acknowledgement
                        </Button>
                        <Button
                          className="bg-emerald-700 hover:bg-emerald-800"
                          onClick={handleDownloadAcknowledgement}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Acknowledgement
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBackToTicket}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Back to Support Ticket
                </Button>
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={() => navigate("/candidate/applications")}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  View All Applications
                </Button>
              </div>

              <AcknowledgementModal
                isOpen={showAcknowledgement}
                application={app}
                transactionId={transactionId}
                amount={totalAmount}
                onClose={closeAcknowledgement}
                onDownload={handleDownloadAcknowledgement}
              />
            </>
          )}
        </main>
      </div>
    );
  }

  // Normal submission success (not correction mode)
  return (
    <div className="customer-motion-root h-screen overflow-hidden bg-orange-50 flex flex-col">
      <header className="no-print border-b border-orange-200 bg-white px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center space-x-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f1d1b] overflow-hidden">
              <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
            </div>
            <div>
              <div className="font-bold text-gray-800">Recruitment Portal</div>
              <div className="text-sm text-gray-600">GOVERNMENT OF INDIA</div>
            </div>
          </button>
        </div>
      </header>

      <main className="application-page-root hover-scroll flex-1 min-h-0 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            <span className="ml-3 text-gray-600">
              Loading application details...
            </span>
          </div>
        ) : (
          <>
            <section className="no-print mb-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="mb-2 text-3xl font-bold text-gray-800">
                Application Submitted Successfully!
              </h1>
              <p className="text-lg text-gray-600">
                Your application has been submitted and payment has been
                processed successfully.
              </p>
            </section>

            <Card className="no-print mb-6 shadow-sm">
              <CardHeader className="pb-3">
                <h2 className="text-xl font-semibold text-gray-800">
                  Application Details
                </h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailBox label="Application ID">
                    <span className="font-mono text-lg font-semibold text-orange-600">
                      {applicationId}
                    </span>
                  </DetailBox>
                  {transactionId !== "-" && (
                    <DetailBox label="Transaction ID">
                      <span className="break-all font-mono text-base text-gray-800">
                        {transactionId}
                      </span>
                    </DetailBox>
                  )}
                  {Number(totalAmount) > 0 && (
                    <DetailBox label="Amount Paid">
                      <span className="text-lg font-semibold text-gray-800">
                        INR {Number(totalAmount).toLocaleString("en-IN")}
                      </span>
                    </DetailBox>
                  )}
                  <DetailBox label="Submitted On">
                    <span className="text-base text-gray-800">
                      {formattedDate}
                    </span>
                  </DetailBox>
                  <DetailBox label="Payment Status">
                    <span className="flex items-center gap-2 font-medium text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      Payment Successful
                    </span>
                  </DetailBox>
                  <DetailBox label="Application Status">
                    <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                      Submitted
                    </span>
                  </DetailBox>
                  {app?.jobId?.title && (
                    <DetailBox label="Job Applied For" className="md:col-span-2 xl:col-span-3">
                      <span className="block text-base font-medium text-gray-800">
                        {app.jobId.title}
                      </span>
                      {app.jobId.department && (
                        <span className="text-sm text-gray-500">
                          {app.jobId.department}
                        </span>
                      )}
                    </DetailBox>
                  )}
                </div>

                {selectedPosts.length > 0 && (
                  <div className="border-t border-gray-200 pt-5">
                    <p className="mb-2 block text-sm font-medium text-gray-600">
                      Applied Posts
                    </p>
                    <div className="space-y-2">
                      {selectedPosts.map((post, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-orange-600" />
                          <span className="text-gray-800">
                            {post.title || post.designation}
                            {post.department ? ` - ${post.department}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {app && (
              <Card className="no-print mb-6 border-emerald-200 bg-emerald-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                        <FileText className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-emerald-950">
                          Application Acknowledgement Ready
                        </h3>
                        <p className="mt-1 text-sm text-emerald-800">
                          View or save the official acknowledgement generated
                          from your submitted application details.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                        onClick={() => setShowAcknowledgement(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Acknowledgement
                      </Button>
                      <Button
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={handleDownloadAcknowledgement}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Acknowledgement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="no-print mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <ActionCard
                icon={FileText}
                iconClass="text-green-600"
                title="Track Application"
                description="Monitor your application status and updates"
                buttonLabel="View Applications"
                buttonClass="border-green-200 text-green-600 hover:bg-green-50"
                onClick={() => navigate("/candidate/applications")}
              />
              <ActionCard
                icon={Calendar}
                iconClass="text-blue-600"
                title="Notifications"
                description="Stay updated with exam dates and results"
                buttonLabel="View Notifications"
                buttonClass="border-blue-200 text-blue-600 hover:bg-blue-50"
                onClick={() => navigate("/candidate/notifications")}
              />
              <ActionCard
                icon={LayoutDashboard}
                iconClass="text-orange-600"
                title="Dashboard"
                description="Go to your candidate dashboard"
                buttonLabel="Go to Dashboard"
                buttonVariant="primary"
                onClick={() => navigate("/candidate/dashboard")}
              />
            </div>

            <Card className="no-print mb-6 border-blue-200 bg-blue-50 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-3 font-semibold text-blue-800">
                  Important Information
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-sm text-blue-700">
                  <li>
                    Keep your Application ID{" "}
                    <strong className="font-mono">{applicationId}</strong> safe
                    for future reference.
                  </li>
                  <li>
                    Admit cards will be available 15 days before the examination
                    date.
                  </li>
                  <li>
                    Check your registered email and SMS for important updates.
                  </li>
                  <li>
                    Document verification will be conducted after the written
                    examination.
                  </li>
                  <li>Results will be published on the official website.</li>
                </ul>
              </CardContent>
            </Card>

            <AcknowledgementModal
              isOpen={showAcknowledgement}
              application={app}
              transactionId={transactionId}
              amount={totalAmount}
              onClose={closeAcknowledgement}
              onDownload={handleDownloadAcknowledgement}
            />
          </>
        )}
      </main>
    </div>
  );
};

const AcknowledgementModal = ({
  isOpen,
  application,
  transactionId,
  amount,
  onClose,
  onDownload,
}) => {
  if (!isOpen || !application) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm print:static print:block print:bg-transparent print:p-0 print:backdrop-blur-0">
      <div className="flex max-h-[94vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20 print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:bg-transparent print:shadow-none print:ring-0">
        <div className="no-print flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
              Application Acknowledgement
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              Official application summary
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              onClick={onDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close acknowledgement preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto bg-slate-100 p-4 print:overflow-visible print:bg-white print:p-0">
          <ApplicationAcknowledgement
            application={application}
            transactionId={transactionId}
            amount={amount}
          />
        </div>
      </div>
    </div>
  );
};

const Detail = ({ label, children }) => (
  <div>
    <p className="text-sm font-medium text-gray-600">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

const DetailBox = ({ label, children, className = "" }) => (
  <div className={`rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 ${className}`}>
    <p className="text-sm font-medium text-gray-600">{label}</p>
    <div className="mt-2 min-h-[28px]">{children}</div>
  </div>
);

const ActionCard = ({
  icon: Icon,
  iconClass,
  title,
  description,
  buttonLabel,
  buttonClass,
  buttonVariant = "outline",
  onClick,
}) => (
  <Card className="shadow-sm transition-shadow hover:shadow-md">
    <CardContent className="p-6 text-center">
      <Icon className={`mx-auto mb-3 h-8 w-8 ${iconClass}`} />
      <h3 className="mb-2 font-semibold text-gray-800">{title}</h3>
      <p className="mb-4 text-sm text-gray-600">{description}</p>
      <Button
        variant={buttonVariant}
        className={`w-full ${buttonClass || ""}`}
        onClick={onClick}
      >
        {buttonLabel}
      </Button>
    </CardContent>
  </Card>
);

export default Success;
