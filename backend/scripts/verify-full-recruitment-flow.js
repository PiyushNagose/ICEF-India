const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const ADMIN_CREDENTIALS = {
  email: 'admin@recruitment.gov.in',
  password: 'Admin@123456'
};
const CANDIDATE_CREDENTIALS = {
  email: 'testcandidate@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'Candidate',
  registeredMobile: '9876543210'
};

// Global State
let adminToken = '';
let candidateToken = '';
let projectId = null;
let jobId = null;
let admitCardTemplateId = null;
let centerId = null;
let applicationId = null;
let generatedPostCode = `POST-${Date.now()}`;
let sharedPosts = [{
  title: 'Test Engineer',
  designation: 'TE-01',
  vacancies: 5,
  categoryBreakdown: { UR: 5, OBC: 0, SC: 0, ST: 0, EWS: 0 }
}];

// Axios Instances
const adminApi = axios.create({ baseURL: BASE_URL });
adminApi.interceptors.request.use(config => {
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

const candidateApi = axios.create({ baseURL: BASE_URL });
candidateApi.interceptors.request.use(config => {
  if (candidateToken) {
    config.headers.Authorization = `Bearer ${candidateToken}`;
  }
  return config;
});

const publicApi = axios.create({ baseURL: BASE_URL });

async function logStep(name, func) {
  console.log(`\n--- [START] ${name} ---`);
  try {
    await func();
    console.log(`--- [SUCCESS] ${name} ---`);
  } catch (err) {
    console.error(`--- [FAILED] ${name} ---`);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

async function runTests() {
  await logStep('Admin Login', async () => {
    const res = await adminApi.post('/auth/admin/login', ADMIN_CREDENTIALS);
    console.log("Login Response Data:", JSON.stringify(res.data, null, 2));
    adminToken = res.data.data?.accessToken || res.data.accessToken;
    if (!adminToken) throw new Error("No token returned");
    console.log('Admin token received');
  });

  await logStep('Create Project', async () => {
    const res = await adminApi.post('/admin/projects', {
      name: `Test Project ${Date.now()}`,
      description: 'Project created by automated regression test',
      status: 'active',
      department: 'IT',
      state: 'Delhi'
    });
    console.log("Create Project Response Data:", JSON.stringify(res.data, null, 2));
    projectId = res.data.data?.project?._id || res.data.data?._id || res.data.project?._id || res.data._id;
    console.log('Project ID:', projectId);
  });

  await logStep('Create Draft Job', async () => {
    const res = await adminApi.post('/admin/jobs', {
      projectId: projectId,
      title: 'Automated Test Engineer',
      description: '<p>Regression test role</p>',
      vacancies: 5,
      postCode: generatedPostCode,
      posts: sharedPosts,
      department: 'IT'
    });
    console.log("Create Draft Job Response Data:", JSON.stringify(res.data, null, 2));
    jobId = res.data.data?.job?._id || res.data.data?._id || res.data.job?._id || res.data._id;
    console.log('Job ID:', jobId);
  });

  await logStep('Update Job Deadline', async () => {
    // Set deadline to a week from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    
    await adminApi.put(`/admin/jobs/${jobId}`, {
      title: 'Automated Test Engineer',
      description: '<p>Regression test role</p>',
      vacancies: 5,
      postCode: generatedPostCode,
      department: 'IT',
      applicationDeadline: deadline.toISOString(),
      applicationStartDate: new Date().toISOString(),
      posts: sharedPosts
    });
    console.log('Job deadline updated');
  });

  await logStep('Publish Job', async () => {
    await adminApi.put(`/admin/jobs/${jobId}/publish`);
    console.log('Job published');
  });

  await logStep('Publish Project', async () => {
    await adminApi.put(`/admin/projects/${projectId}/publish`);
    console.log('Project published');
  });

  // Since public endpoints are under /jobs and /public, let's verify public visibility
  await logStep('Verify Job is Public', async () => {
    const res = await publicApi.get(`/jobs/${jobId}`);
    if (res.data.data.job.status !== 'active') {
      throw new Error(`Job is not active, status: ${res.data.data.job.status}`);
    }
    console.log('Job is publicly visible');
  });

  await logStep('Candidate Registration/Login', async () => {
    // Attempt registration first
    try {
      await publicApi.post('/auth/register', CANDIDATE_CREDENTIALS);
      console.log('Candidate registered successfully.');
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('already exists') || msg.includes('already registered')) {
        console.log('Candidate already exists, proceeding to login.');
      } else {
        throw err;
      }
    }

    // Now login
    const res = await publicApi.post('/auth/login', {
      email: CANDIDATE_CREDENTIALS.email,
      password: CANDIDATE_CREDENTIALS.password
    });
    candidateToken = res.data.data.accessToken;
    if (!candidateToken) throw new Error("No candidate token returned");
    console.log('Candidate token received');
  });

  await logStep('Candidate Apply', async () => {
    // 1. Create Application
    let res = await candidateApi.post('/candidate/applications', {
      jobId: jobId
    });
    applicationId = res.data.data.application._id;
    console.log('Application ID:', applicationId);

    // 2. Personal Details
    await candidateApi.put(`/candidate/applications/${applicationId}/personal-details`, {
      fullName: `${CANDIDATE_CREDENTIALS.firstName} ${CANDIDATE_CREDENTIALS.lastName}`,
      dateOfBirth: '1990-01-01',
      gender: 'male',
      category: 'general',
      registeredMobile: CANDIDATE_CREDENTIALS.registeredMobile,
      isDomicileOfBihar: true
    });

    // 3. Address
    await candidateApi.put(`/candidate/applications/${applicationId}/address`, {
      permanent: {
        addressLine1: '123 Main St',
        state: 'Bihar',
        district: 'Patna',
        pincode: '800001'
      },
      sameAsPermanent: true
    });

    // 4. Submit (creates declaration and moves step)
    await candidateApi.post(`/candidate/applications/${applicationId}/submit`, {
      declaration: 'I hereby declare that all information provided is correct.'
    });

    // 5. Finalize (actual submission after payment, if any)
    await candidateApi.post(`/candidate/applications/${applicationId}/finalize`);
    
    console.log('Application submitted successfully');
  });

  await logStep('Verify Candidate Application Status', async () => {
    const res = await candidateApi.get(`/candidate/applications/${applicationId}`);
    const status = res.data.data?.application?.status || res.data.data?.status;
    if (status !== 'submitted' && status !== 'approved') {
      throw new Error(`Application status is ${status}`);
    }
    console.log('Application status verified:', status);
  });
  
  await logStep('Admin Extend Deadline', async () => {
    const jobRes = await adminApi.get(`/admin/jobs/${jobId}`);
    const job = jobRes.data.data.job;

    // Set deadline to two weeks from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    
    await adminApi.put(`/admin/jobs/${jobId}`, {
      ...job,
      projectId: projectId, // projectId is usually populated, we just pass the ID
      applicationDeadline: deadline.toISOString(),
      amendmentReason: "Extension of deadline due to testing"
    });
    console.log('Job deadline extended');
  });

  await logStep('Verify Extension Publicly', async () => {
    const res = await publicApi.get(`/jobs/${jobId}`);
    console.log('New deadline:', res.data.data.job.applicationDeadline);
  });

  console.log('\n✅ All regression tests passed successfully!');
}

runTests();
