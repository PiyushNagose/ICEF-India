import {
  BadgeCheck,
  CheckCircle,
  FileCheck2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { getJobDocumentRequirements } from "../../utils/applicationFlow";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const formatDate = (value, withTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const formatValue = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

const addressLine = (address = {}) =>
  [
    address.addressLine1,
    address.addressLine2,
    address.policeStation,
    address.district,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ") || "-";

const InfoCell = ({ label, value }) => (
  <div className="min-h-[42px] border-b border-r border-slate-200 px-2.5 py-1.5">
    <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-0.5 break-words text-[10px] font-medium leading-snug text-slate-900">
      {formatValue(value)}
    </p>
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="mb-1.5 flex items-center gap-1.5 border-b border-slate-300 pb-1">
    <Icon className="h-3 w-3 text-orange-600" />
    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
      {children}
    </h3>
  </div>
);

const getFieldLabels = (job) => {
  const labels = {};
  (job?.formSections || []).forEach((section) => {
    (section.fields || []).forEach((field) => {
      labels[String(field._id || field.id)] = {
        label: field.label,
        section: section.title,
      };
    });
  });
  return labels;
};

const getEducationRows = (education = {}) =>
  [
    {
      level: "10th Class",
      data: education.tenth,
      board: education.tenth?.board,
      year: education.tenth?.year,
      result: education.tenth?.percentage
        ? `${education.tenth.percentage}%`
        : undefined,
    },
    {
      level: "12th Class",
      data: education.twelfth,
      board: education.twelfth?.board,
      year: education.twelfth?.year,
      result: education.twelfth?.percentage
        ? `${education.twelfth.percentage}%`
        : undefined,
    },
    {
      level: "Graduation",
      data: education.graduation,
      board: education.graduation?.university || education.graduation?.degree,
      year: education.graduation?.year,
      result: education.graduation?.percentage
        ? `${education.graduation.percentage}%`
        : undefined,
    },
  ].filter((row) => row.data);

const ApplicationAcknowledgement = ({
  application,
  transactionId,
  amount,
}) => {
  const job = application?.jobId || {};
  const candidate = application?.candidateId || {};
  const personal = application?.personalDetails || {};
  const education = application?.education || {};
  const additional = application?.additionalInfo || {};
  const address = application?.address || {};
  const documents = Array.isArray(application?.documents)
    ? application.documents
    : [];
  const documentByType = new Map(documents.map((doc) => [doc.type, doc]));
  const requirements = getJobDocumentRequirements(job);
  const documentRows =
    requirements.length > 0
      ? requirements.map((requirement) => {
          const type = slugify(requirement.name);
          return {
            type,
            name: requirement.name,
            required: requirement.required !== false,
            document: documentByType.get(type),
          };
        })
      : documents.map((document) => ({
          type: document.type,
          name: document.name || document.type?.replace(/_/g, " "),
          required: true,
          document,
        }));

  const uploadedCount = documentRows.filter((row) =>
    ["uploaded", "verified"].includes(row.document?.status),
  ).length;
  const fieldLabels = getFieldLabels(job);
  const formResponses = application?.formResponses || {};
  const customRows = Object.entries(formResponses).map(([fieldId, value]) => ({
    fieldId,
    label: fieldLabels[fieldId]?.label || fieldId,
    section: fieldLabels[fieldId]?.section || "Additional Job Details",
    value,
  }));
  const photo =
    documentByType.get("passport_photo") ||
    documentRows.find((row) => /photo/i.test(row.name || ""))?.document;
  const signature =
    documentByType.get("signature") ||
    documentRows.find((row) => /signature/i.test(row.name || ""))?.document;
  const acknowledgementNumber = `ACK/${application?.applicationId || application?._id || "PENDING"}`;
  const submittedAt = application?.submittedAt || application?.updatedAt;
  const declaration =
    application?.declaration ||
    "I hereby declare that all information provided in this application is true, complete, and correct to the best of my knowledge and belief.";

  return (
    <div
      id="application-acknowledgement"
      className="ack-print-root mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white text-slate-950 shadow-xl ring-1 ring-slate-200"
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #application-acknowledgement, #application-acknowledgement * {
            visibility: visible !important;
          }
          #application-acknowledgement {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #application-acknowledgement section { break-inside: avoid; page-break-inside: avoid; }
          .no-print { display: none !important; }
          @page { margin: 8mm; size: A4; }
        }
      `}</style>

      <div className="border-t-[3px] border-orange-600 p-4 sm:p-5">
        <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-600 bg-orange-50">
              <ShieldCheck className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-700">
                Government Recruitment Portal
              </p>
              <h2 className="mt-0.5 text-sm font-extrabold uppercase tracking-wide text-slate-950">
                Official Application Acknowledgement
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Generated from the submitted candidate application record.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-orange-600">
              Application Acknowledgement
            </p>
            <p className="mt-1.5 text-[10px] font-semibold text-slate-700">
              Page 1 of 1
            </p>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-1 border border-slate-300 md:grid-cols-2">
          <InfoCell label="Application Number" value={application?.applicationId} />
          <InfoCell label="Acknowledgement Number" value={acknowledgementNumber} />
          <InfoCell label="Post Applied For" value={job?.title} />
          <InfoCell label="Submitted On" value={formatDate(submittedAt, true)} />
          <InfoCell label="Department" value={job?.department} />
          <InfoCell label="Post Code" value={job?.postCode} />
        </section>

        <section className="mt-4">
          <SectionTitle icon={FileText}>Personal Details</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_118px]">
            <div className="grid grid-cols-1 border border-slate-300 sm:grid-cols-2">
              <InfoCell
                label="Full Name"
                value={personal.fullName || candidate.fullName}
              />
              <InfoCell
                label="Date of Birth"
                value={formatDate(personal.dateOfBirth || candidate.dateOfBirth)}
              />
              <InfoCell label="Father's Name" value={personal.fatherName} />
              <InfoCell label="Mother's Name" value={personal.motherName} />
              <InfoCell label="Gender" value={personal.gender || candidate.gender} />
              <InfoCell label="Category" value={personal.category || candidate.category} />
              <InfoCell label="Religion" value={personal.religion} />
              <InfoCell label="Marital Status" value={personal.maritalStatus} />
              <InfoCell
                label="Identification Mark"
                value={personal.identificationMark}
              />
              <InfoCell
                label="Registered Mobile"
                value={personal.registeredMobile || candidate.registeredMobile}
              />
              <InfoCell label="Email" value={candidate.email} />
              <InfoCell
                label="Recruiting State Domicile"
                value={personal.isDomicileOfBihar}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex h-32 items-center justify-center border border-slate-300 bg-slate-50">
                {photo?.cloudinaryUrl ? (
                  <img
                    src={photo.cloudinaryUrl}
                    alt="Candidate"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-400">
                    PHOTO
                  </span>
                )}
              </div>
              <div className="flex h-12 items-center justify-center border border-slate-300 bg-slate-50">
                {signature?.cloudinaryUrl ? (
                  <img
                    src={signature.cloudinaryUrl}
                    alt="Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-400">
                    SIGNATURE
                  </span>
                )}
              </div>
              <p className="text-center text-[7px] font-bold uppercase tracking-wide text-slate-500">
                Applicant Signature
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle icon={BadgeCheck}>Educational Qualifications</SectionTitle>
          <div className="overflow-hidden border border-slate-300">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="bg-slate-100 text-[8px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-r border-slate-300 px-2.5 py-1.5">Level</th>
                  <th className="border-r border-slate-300 px-2.5 py-1.5">
                    Board / University
                  </th>
                  <th className="border-r border-slate-300 px-2.5 py-1.5">Year</th>
                  <th className="px-2.5 py-1.5">Result</th>
                </tr>
              </thead>
              <tbody>
                {getEducationRows(education).map((row) => (
                  <tr key={row.level}>
                    <td className="border-r border-t border-slate-200 px-2.5 py-1.5 font-medium">
                      {row.level}
                    </td>
                    <td className="border-r border-t border-slate-200 px-2.5 py-1.5">
                      {formatValue(row.board)}
                    </td>
                    <td className="border-r border-t border-slate-200 px-2.5 py-1.5">
                      {formatValue(row.year)}
                    </td>
                    <td className="border-t border-slate-200 px-2.5 py-1.5">
                      {formatValue(row.result)}
                    </td>
                  </tr>
                ))}
                {getEducationRows(education).length === 0 && (
                  <tr>
                    <td className="px-2.5 py-2 text-slate-500" colSpan="4">
                      No education details available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_0.48fr]">
          <div>
            <SectionTitle icon={FileCheck2}>Additional Information</SectionTitle>
            <div className="grid grid-cols-1 border border-slate-300 sm:grid-cols-2">
              <InfoCell label="Govt Employee" value={additional.isGovtEmployee} />
              <InfoCell label="Ex-Serviceman" value={additional.isExServiceman} />
              <InfoCell label="PwD Status" value={additional.isPwD} />
              <InfoCell label="Driving License" value={additional.drivingLicense} />
              <InfoCell
                label="Computer Certificate"
                value={additional.computerCertificate}
              />
              <InfoCell
                label="Subject Combination"
                value={additional.subjectCombination}
              />
              <InfoCell
                label="Permanent Address"
                value={addressLine(address.permanent)}
              />
              <InfoCell
                label="Correspondence Address"
                value={
                  address.sameAsPermanent
                    ? "Same as permanent address"
                    : addressLine(address.correspondence)
                }
              />
            </div>
          </div>
          <div>
            <SectionTitle icon={CheckCircle}>Documents Status</SectionTitle>
            <div className="flex min-h-[112px] items-center justify-center border border-slate-300 bg-slate-50 p-3">
              <div className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                {uploadedCount} of {documentRows.length} files uploaded
              </div>
            </div>
          </div>
        </section>

        {customRows.length > 0 && (
          <section className="mt-4">
            <SectionTitle icon={FileText}>Job Specific Responses</SectionTitle>
            <div className="grid grid-cols-1 border border-slate-300 sm:grid-cols-2">
              {customRows.map((row) => (
                <InfoCell
                  key={row.fieldId}
                  label={`${row.section} - ${row.label}`}
                  value={row.value}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-4">
          <SectionTitle icon={FileCheck2}>Uploaded Documents List</SectionTitle>
          <div className="grid grid-cols-1 border border-slate-300 md:grid-cols-2">
            {documentRows.map((row) => (
              <div
                key={row.type}
                className="flex min-h-[30px] items-center justify-between gap-3 border-b border-r border-slate-200 px-2.5 py-1.5 text-[10px]"
              >
                <span className="font-medium text-slate-800">
                  {row.name}
                  {row.required ? "" : " (Optional)"}
                </span>
                <span
                  className={
                    ["uploaded", "verified"].includes(row.document?.status)
                      ? "font-bold uppercase text-emerald-600"
                      : "font-bold uppercase text-amber-600"
                  }
                >
                  {["uploaded", "verified"].includes(row.document?.status)
                    ? "Success"
                    : "Pending"}
                </span>
              </div>
            ))}
            {documentRows.length === 0 && (
              <div className="px-2.5 py-2 text-[10px] text-slate-500">
                No documents were configured for this job.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle icon={ShieldCheck}>Final Declaration</SectionTitle>
          <div className="border border-slate-300 bg-slate-50 p-2.5 text-[10px] leading-relaxed text-slate-700">
            <span className="mr-2 inline-flex h-3.5 w-3.5 items-center justify-center border border-orange-500 text-[7px] font-bold text-orange-600">
              OK
            </span>
            {declaration}
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle icon={FileText}>Application Submission Summary</SectionTitle>
          <div className="grid grid-cols-1 border border-slate-300 md:grid-cols-4">
            <InfoCell label="Application ID" value={application?.applicationId} />
            <InfoCell label="Acknowledgement ID" value={acknowledgementNumber} />
            <InfoCell label="Submission Date" value={formatDate(submittedAt)} />
            <InfoCell label="Final Status" value={application?.status || "Submitted"} />
            <InfoCell
              label="Payment Status"
              value={application?.paymentStatus || "paid"}
            />
            <InfoCell
              label="Transaction ID"
              value={application?.transactionId || transactionId}
            />
            <InfoCell
              label="Amount Paid"
              value={
                Number(application?.totalFee || amount || 0) > 0
                  ? `INR ${Number(application?.totalFee || amount).toLocaleString("en-IN")}`
                  : "No fee"
              }
            />
            <InfoCell
              label="Applied Posts"
              value={
                application?.appliedPosts?.length
                  ? application.appliedPosts
                      .map((post) => post.title || post.designation)
                      .join(", ")
                  : job?.title
              }
            />
          </div>
        </section>

        <footer className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-300 pt-3 text-[8px] leading-relaxed text-slate-500 md:grid-cols-3">
          <div>
            <p className="font-bold text-slate-700">Disclaimer</p>
            <p>
              This is a computer generated acknowledgement. Keep the application
              number and acknowledgement number for future reference.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-700">For queries, contact</p>
            <p>support@recruitment.gov.in</p>
            <p>1800-123-4567</p>
          </div>
          <div className="text-right">
            <p>Generated on {formatDate(new Date(), true)}</p>
            <p className="mt-3 font-semibold text-slate-600">
              Government Recruitment Portal
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ApplicationAcknowledgement;
