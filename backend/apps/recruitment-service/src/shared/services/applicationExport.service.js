const fs = require("fs");
const path = require("path");
const { createZipBuffer } = require("../utils/zip");
const { buildFileManifest } = require("./fileStorage.service");

const EXPORT_ROOT = path.resolve(process.cwd(), "tmp", "exports");

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const csvEscape = (value) => {
  const raw = value === undefined || value === null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const toCsv = (rows, headers) => {
  const lines = [headers.map((item) => csvEscape(item.label)).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((item) => csvEscape(item.value(row))).join(","));
  });
  return `${lines.join("\n")}\n`;
};

const getCandidateName = (app) =>
  app.personalDetails?.fullName ||
  app.candidateId?.fullName ||
  app.candidate?.fullName ||
  "";

const getEmail = (app) =>
  app.contactEmail || app.candidateId?.email || app.candidate?.email || "";

const getMobile = (app) =>
  app.contactMobile ||
  app.personalDetails?.registeredMobile ||
  app.candidateId?.registeredMobile ||
  app.candidate?.registeredMobile ||
  "";

const getJob = (app) => app.jobId || app.job || {};

const getProject = (app) => getJob(app)?.projectId || getJob(app)?.project || {};

const getJobTitle = (app) => getJob(app)?.title || "";

const getJobCode = (app) => getJob(app)?.postCode || "";

const getProjectName = (app) => getProject(app)?.name || "";

const getExportScope = (applications) => {
  const first = applications[0] || {};
  return {
    jobTitle: getJobTitle(first) || "All Jobs",
    postCode: getJobCode(first) || "ALL",
    projectName: getProjectName(first) || "All Projects",
    department: getJob(first)?.department || "",
  };
};

const applicationRegisterHeaders = [
  { label: "Application ID", value: (app) => app.applicationId },
  { label: "Registration Number", value: (app) => app.registrationNumber },
  { label: "Candidate Name", value: getCandidateName },
  { label: "Email", value: getEmail },
  { label: "Mobile", value: getMobile },
  { label: "Gender", value: (app) => app.personalDetails?.gender },
  { label: "Category", value: (app) => app.personalDetails?.category },
  { label: "Date of Birth", value: (app) => formatDate(app.personalDetails?.dateOfBirth) },
  { label: "Job Title", value: (app) => getJob(app)?.title },
  { label: "Post Code", value: (app) => getJob(app)?.postCode },
  { label: "Department", value: (app) => getJob(app)?.department },
  { label: "Status", value: (app) => app.status },
  { label: "Payment Status", value: (app) => app.paymentStatus },
  { label: "Total Fee", value: (app) => app.totalFee },
  { label: "Transaction ID", value: (app) => app.transactionId },
  { label: "Submitted At", value: (app) => formatDate(app.submittedAt) },
  { label: "Storage Batch", value: (app) => app.fileStorage?.batchNumber },
  { label: "Storage Path", value: (app) => app.fileStorage?.basePath },
];

const paymentHeaders = [
  { label: "Application ID", value: (app) => app.applicationId },
  { label: "Registration Number", value: (app) => app.registrationNumber },
  { label: "Candidate Name", value: getCandidateName },
  { label: "Mobile", value: getMobile },
  { label: "Job Title", value: (app) => getJob(app)?.title },
  { label: "Payment Status", value: (app) => app.paymentStatus },
  { label: "Amount", value: (app) => app.totalFee },
  { label: "Transaction ID", value: (app) => app.transactionId },
  { label: "Submitted At", value: (app) => formatDate(app.submittedAt) },
];

const correctionHeaders = [
  { label: "Application ID", value: (app) => app.applicationId },
  { label: "Registration Number", value: (app) => app.registrationNumber },
  { label: "Candidate Name", value: getCandidateName },
  { label: "Correction Status", value: (app) => app.correction?.status },
  { label: "Correction Note", value: (app) => app.correction?.note },
  {
    label: "Issues",
    value: (app) =>
      (app.correction?.issues || [])
        .map((issue) => `${issue.section}:${issue.fieldLabel}:${issue.status}`)
        .join(" | "),
  },
  { label: "Requested At", value: (app) => formatDate(app.correction?.requestedAt) },
  { label: "Submitted At", value: (app) => formatDate(app.correction?.submittedAt) },
];

const flattenDocumentRows = (applications) =>
  applications.flatMap((app) =>
    buildFileManifest(app).map((file) => ({
      applicationId: app.applicationId,
      registrationNumber: app.registrationNumber,
      candidateName: getCandidateName(app),
      mobile: getMobile(app),
      jobTitle: getJob(app)?.title,
      storageBatch: app.fileStorage?.batchNumber,
      storagePath: app.fileStorage?.basePath,
      ...file,
    })),
  );

const documentHeaders = [
  { label: "Application ID", value: (row) => row.applicationId },
  { label: "Registration Number", value: (row) => row.registrationNumber },
  { label: "Candidate Name", value: (row) => row.candidateName },
  { label: "Mobile", value: (row) => row.mobile },
  { label: "Job Title", value: (row) => row.jobTitle },
  { label: "Document Type", value: (row) => row.type },
  { label: "Document Name", value: (row) => row.label },
  { label: "Original File", value: (row) => row.originalName },
  { label: "Mime Type", value: (row) => row.mimeType },
  { label: "Size KB", value: (row) => row.sizeKB },
  { label: "Status", value: (row) => row.status },
  { label: "Provider", value: (row) => row.provider },
  { label: "Public ID", value: (row) => row.publicId },
  { label: "URL", value: (row) => row.url },
  { label: "Storage Batch", value: (row) => row.storageBatch },
  { label: "Storage Path", value: (row) => row.storagePath },
  { label: "Uploaded At", value: (row) => formatDate(row.uploadedAt) },
];

const buildReadme = ({ applications, generatedAt = new Date() }) => {
  const submitted = applications.filter((app) => app.status !== "draft").length;
  const paid = applications.filter((app) => app.paymentStatus === "paid").length;
  const documents = flattenDocumentRows(applications).length;
  const scope = getExportScope(applications);
  return [
    "Government Recruitment Portal - Handover Bundle",
    "",
    `Generated At: ${formatDate(generatedAt)}`,
    `Scope: ${scope.jobTitle} (${scope.postCode})`,
    `Project: ${scope.projectName}`,
    `Department: ${scope.department}`,
    `Total Applications: ${applications.length}`,
    `Submitted Applications: ${submitted}`,
    `Paid Applications: ${paid}`,
    `Document Records: ${documents}`,
    "",
    "Files:",
    "- application-register.csv: Candidate/application master register.",
    "- payment-register.csv: Payment and transaction register.",
    "- correction-register.csv: Admin clarification and correction register.",
    "- document-manifest.csv: Document storage locations and statuses.",
    "- printable-application-register.html: A4-friendly hard-copy register for printing.",
    "",
    "Use the document manifest URLs/Public IDs to fetch source documents from the configured storage provider.",
  ].join("\n");
};

const htmlEscape = (value) =>
  String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildPrintableRegisterHtml = (applications) => {
  const generatedAt = new Date();
  const scope = getExportScope(applications);
  const rows = applications
    .map(
      (app, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${htmlEscape(getCandidateName(app))}</strong><br />
            <span>${htmlEscape(app.registrationNumber || "-")}</span>
          </td>
          <td>${htmlEscape(app.applicationId || "-")}</td>
          <td>${htmlEscape(getMobile(app))}<br /><span>${htmlEscape(getEmail(app))}</span></td>
          <td>${htmlEscape(app.personalDetails?.category || "-")}</td>
          <td>${htmlEscape(formatDate(app.personalDetails?.dateOfBirth) || "-")}</td>
          <td>${htmlEscape(app.status || "-")}</td>
          <td>${htmlEscape(app.paymentStatus || "-")}</td>
          <td>${htmlEscape(formatDate(app.submittedAt) || "-")}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Government Handover Register</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .sheet { width: 100%; }
    .header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
    .eyebrow { color: #ea580c; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    h1 { margin: 4px 0 6px; font-size: 22px; line-height: 1.2; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .meta div { border: 1px solid #d1d5db; padding: 8px; min-height: 44px; }
    .label { display: block; font-size: 9px; color: #6b7280; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .value { display: block; margin-top: 3px; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; font-size: 10px; line-height: 1.35; word-break: break-word; }
    th { background: #f8fafc; color: #374151; font-size: 9px; letter-spacing: .7px; text-transform: uppercase; text-align: left; }
    td span { color: #6b7280; font-size: 9px; }
    .footer { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; color: #374151; }
    .signature { width: 240px; border-top: 1px solid #111827; padding-top: 6px; text-align: center; }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="header">
      <div class="eyebrow">Government Handover Register</div>
      <h1>${htmlEscape(scope.jobTitle)} - Candidate Application Register</h1>
      <div class="meta">
        <div><span class="label">Project</span><span class="value">${htmlEscape(scope.projectName)}</span></div>
        <div><span class="label">Post Code</span><span class="value">${htmlEscape(scope.postCode)}</span></div>
        <div><span class="label">Department</span><span class="value">${htmlEscape(scope.department || "-")}</span></div>
        <div><span class="label">Generated</span><span class="value">${htmlEscape(formatDate(generatedAt))}</span></div>
      </div>
    </section>
    <table>
      <thead>
        <tr>
          <th style="width: 38px;">Sl.</th>
          <th>Candidate / Reg. No.</th>
          <th>Application ID</th>
          <th>Contact</th>
          <th style="width: 80px;">Category</th>
          <th style="width: 95px;">DOB</th>
          <th style="width: 90px;">Status</th>
          <th style="width: 80px;">Payment</th>
          <th style="width: 105px;">Submitted</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9" style="text-align:center;padding:24px;">No applications found for this export scope.</td></tr>`}
      </tbody>
    </table>
    <section class="footer">
      <div>Total Applications: <strong>${applications.length}</strong></div>
      <div class="signature">Authorized Officer Signature</div>
    </section>
  </main>
</body>
</html>`;
};

const writeExportFile = async ({ filename, content, contentType }) => {
  await fs.promises.mkdir(EXPORT_ROOT, { recursive: true });
  const filePath = path.join(EXPORT_ROOT, filename);
  await fs.promises.writeFile(filePath, content);
  return { filePath, filename, contentType };
};

const buildExportContent = (type, applications) => {
  if (type === "documents") {
    return toCsv(flattenDocumentRows(applications), documentHeaders);
  }
  if (type === "payments") {
    return toCsv(applications, paymentHeaders);
  }
  if (type === "corrections") {
    return toCsv(applications, correctionHeaders);
  }
  if (type === "print") {
    return buildPrintableRegisterHtml(applications);
  }
  return toCsv(applications, applicationRegisterHeaders);
};

const buildGovernmentBundle = async (applications) => {
  const generatedAt = new Date();
  const zip = createZipBuffer([
    {
      name: "README.txt",
      content: buildReadme({ applications, generatedAt }),
      date: generatedAt,
    },
    {
      name: "application-register.csv",
      content: toCsv(applications, applicationRegisterHeaders),
      date: generatedAt,
    },
    {
      name: "payment-register.csv",
      content: toCsv(applications, paymentHeaders),
      date: generatedAt,
    },
    {
      name: "correction-register.csv",
      content: toCsv(applications, correctionHeaders),
      date: generatedAt,
    },
    {
      name: "document-manifest.csv",
      content: toCsv(flattenDocumentRows(applications), documentHeaders),
      date: generatedAt,
    },
    {
      name: "printable-application-register.html",
      content: buildPrintableRegisterHtml(applications),
      date: generatedAt,
    },
  ]);

  return writeExportFile({
    filename: `government-handover-${Date.now()}.zip`,
    content: zip,
    contentType: "application/zip",
  });
};

module.exports = {
  buildExportContent,
  buildGovernmentBundle,
  buildPrintableRegisterHtml,
  writeExportFile,
  
  // For streaming
  applicationRegisterHeaders,
  paymentHeaders,
  correctionHeaders,
  documentHeaders,
  flattenDocumentRows,
  csvEscape
};
