const axios = require("axios");

const required = ["API_BASE_URL", "ADMIN_TOKEN", "CANDIDATE_TOKEN"];
const missing = required.filter((key) => !process.env[key]);

if (process.env.SMOKE_RUN !== "1" || missing.length) {
  console.log(
    [
      "Production smoke flow is ready but not executed.",
      "Set SMOKE_RUN=1 plus API_BASE_URL, ADMIN_TOKEN, and CANDIDATE_TOKEN to run it.",
      missing.length ? `Missing: ${missing.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  process.exit(0);
}

const baseURL = process.env.API_BASE_URL.replace(/\/$/, "");
const admin = axios.create({
  baseURL,
  headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
});
const candidate = axios.create({
  baseURL,
  headers: { Authorization: `Bearer ${process.env.CANDIDATE_TOKEN}` },
});

const dataOf = (response) => response.data?.data || response.data;
const iso = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const run = async () => {
  const stamp = Date.now();
  const projectPayload = {
    name: `Smoke Recruitment ${stamp}`,
    description: "Production smoke test recruitment.",
    department: "Smoke Department",
    state: "Madhya Pradesh",
    startDate: iso(1),
    endDate: iso(60),
  };

  const project = dataOf(await admin.post("/admin/projects", projectPayload)).project;
  const projectId = project._id;

  await admin.post("/admin/cms", {
    projectId,
    heroTitle: projectPayload.name,
    heroSubtitle: projectPayload.description,
    status: "published",
  });

  const jobPayload = {
    projectId,
    title: `Smoke Job ${stamp}`,
    postCode: `SMK-${String(stamp).slice(-8)}`,
    department: "Smoke Department",
    category: "General",
    jobType: "Permanent",
    totalPosts: 1,
    posts: [
      {
        postCode: "P-01",
        title: "Smoke Post",
        designation: "Smoke Designation",
        vacancies: 1,
        department: "Smoke Department",
        status: "active",
      },
    ],
    applicationFee: { general: 0, obc: 0, scSt: 0, ews: 0, pwd: 0 },
    paymentConfig: { applicationFee: 0, processingFee: 0, paymentMethods: [] },
    applicationStartDate: iso(1),
    applicationDeadline: iso(20),
    correctionStartDate: iso(21),
    correctionDeadline: iso(25),
    admitCardReleaseDate: iso(30),
    examDate: iso(35),
    resultDate: iso(45),
  };

  const job = dataOf(await admin.post("/admin/jobs", jobPayload)).job;
  await admin.put(`/admin/jobs/${job._id}/publish`);
  await admin.put(`/admin/projects/${projectId}/publish`);

  const publicProject = dataOf(await axios.get(`${baseURL}/public/projects/${project.publicSlug}`));
  if (!publicProject?.project && !publicProject?.page) {
    throw new Error("Published project was not visible on public URL.");
  }

  const application = dataOf(await candidate.post("/candidate/applications", { jobId: job._id })).application;
  await candidate.put(`/candidate/applications/${application._id}/personal-details`, {
    fullName: "Smoke Candidate",
    fatherName: "Smoke Parent",
    dateOfBirth: "2000-01-01",
    gender: "male",
    category: "general",
    registeredMobile: "9876543210",
    isDomicileOfBihar: false,
  });
  await candidate.put(`/candidate/applications/${application._id}/address`, {
    permanent: {
      addressLine1: "Smoke address line",
      state: "Madhya Pradesh",
      district: "Bhopal",
      pincode: "462001",
    },
    sameAsPermanent: true,
  });
  await candidate.put(`/candidate/applications/${application._id}/post-selection`, {
    appliedPosts: [
      {
        jobId: job._id,
        postId: job.posts[0]._id,
        postCode: "P-01",
        title: "Smoke Post",
        designation: "Smoke Designation",
        department: "Smoke Department",
        vacancies: 1,
        preference: 1,
      },
    ],
  });
  await candidate.post(`/candidate/applications/${application._id}/submit`, {
    declaration: "I confirm the smoke application details are correct.",
  });
  const finalized = dataOf(await candidate.post(`/candidate/applications/${application._id}/finalize`));

  await admin.get(`/admin/applications/${finalized._id || application._id}`);

  console.log("Production smoke flow passed.");
  console.log(JSON.stringify({ projectId, jobId: job._id, applicationId: application._id }, null, 2));
};

run().catch((error) => {
  console.error("Production smoke flow failed.");
  console.error(error.response?.data || error.message);
  process.exit(1);
});
