# 2026-08-07 Production Requirement Alignment

This section supersedes any older wording in this file that says applicants need **no registration/login at all** or that admit cards must be generated for every eligible candidate in bulk.

## Real-World Pattern To Follow

Official recruitment platforms generally use one of these two models:

- **OTR/Profile model**: UPSC and SSC use One-Time Registration before applying. UPSC states OTR is mandatory for online applications and is a reusable applicant profile. SSC also uses One-Time Registration before candidates apply online.
- **Registration-number model**: IBPS-style call-letter flows let candidates retrieve call letters using registration number/roll number with password/date of birth.
- **Our platform decision**: Use a **hybrid production model**:
  - Public landing pages and notices are open.
  - Candidate can start from a public job page.
  - Candidate identity is captured through OTP-verified email/mobile and an application registration number.
  - A lightweight candidate account/session exists for drafts, payments, correction, documents, and later login recovery.
  - Public services like status, admit card, result, and verification work through registration number + DOB/mobile + OTP.

References checked:

- UPSC OTR: https://upsconline.gov.in/upsc/OTRP/instr_otr.php
- UPSC application portal: https://upsconline.nic.in/
- SSC portal: https://ssc.gov.in/
- IBPS FAQ/call-letter pattern: https://www.ibps.in/index.php/faq/

## Non-Negotiable Corrections

1. **Do not build a pure ghost-only flow**
   - Keep candidate records real and recoverable.
   - Registration/application number is the public identifier.
   - Candidate login remains useful for draft recovery and application history.
   - Public lookup remains available with OTP for people who do not want to log in.

2. **Use controlled on-demand center allocation and admit card generation**
   - Client requirement: do not reserve seats and generate admit cards for every submitted/eligible candidate because actual exam participation can be far lower than submitted applications.
   - Admin must still create schedules, centers, rooms, shifts, capacity pools, release windows, and cutoff rules before admit card release.
   - Candidate gets exact center/seat only when they request/download the admit card for the first time.
   - The first successful admit-card request performs an atomic capacity lock, roll number generation, seat assignment, PDF generation, and audit log.
   - Re-download must return the same cached admit card and must never allocate a new center.
   - This is allowed only with strict safeguards: capacity buffer, per-shift capacity pool, atomic DB update, retry, monitoring alerts, late-download cutoff, and emergency center workflow.

3. **Separate IDs clearly**
   - `candidateId`: internal user/candidate account ID.
   - `applicationId`: application tracking ID, visible after draft starts.
   - `registrationNumber`: final submitted application number after payment/final submission.
   - `paymentTransactionId`: payment audit ID.
   - `rollNumber`: exam-only ID generated during locked allocation.

4. **Payment timing**
   - Default production flow should be: fill application -> preview/declaration -> payment -> final submit -> registration number/acknowledgement.
   - Step-1 payment is allowed only when admin explicitly configures "fee-before-form" for special cases.
   - Failed/timeout payment must keep application in pending-payment state and reconcile through webhook plus manual admin recovery.

5. **Correction workflow**
   - Correction can happen only inside configured correction window.
   - Some fields are locked forever after submission unless admin opens correction: mobile/email, category, DOB, post selection, payment category, uploaded identity proof.
   - Every correction must keep old value, new value, reason, supporting document, reviewer, decision, timestamp, and audit log.

6. **Admit card lifecycle**
   - Admin creates exam schedule.
   - Admin selects centers/rooms for each exam/shift.
   - System previews capacity and eligible candidates.
   - Admin publishes the admit-card download window.
   - Candidate requests/downloads admit card after release date.
   - System atomically allocates center/room/seat/roll number on first request only.
   - System generates the candidate admit card PDF on demand and caches it.
   - Admin monitors generated/downloaded counts, center utilization, and capacity alerts in real time.
   - Attendance sheets are generated center/room/shift wise from candidates who have actually generated/downloaded admit cards.

7. **Attendance sheet lifecycle**
   - Attendance sheet is center/room/shift wise.
   - It must be generated from the committed on-demand allocations.
   - No attendance sheet should be printed for a center with zero generated admit cards.
   - Admin can print preliminary attendance sheets after the cutoff and delta sheets for authorized late downloads.
   - Sheet must include roll range, candidate count, photo/signature placeholders, present/absent marks, thumb impression area, invigilator signature, and audit metadata.

8. **Scale and safety**
   - Bulk generation must be queue-based with progress, retry, failed-job list, and downloadable ZIP.
   - All public endpoints require rate limits and abuse protection.
   - All sensitive downloads use signed URLs or streamed protected files.
   - All publish/regenerate/allocation actions require audit logs.

## Revised Implementation Priority

Use this order instead of the older phase ordering where it conflicts:

1. Candidate account/session compatibility and public OTP lookup.
2. Project/job public pages and timeline validation.
3. Application draft -> submit -> payment -> acknowledgement.
4. Admin application review and correction windows.
5. Exam schedule, center/room capacity pools, admit-card release window, and allocation guardrails.
6. On-demand admit card allocation/generation and attendance PDF generation from committed allocations.
7. Public/candidate admit card, status, result, and verification pages.
8. Scale hardening: queues, ZIP exports, audit logs, rate limits, monitoring.

## Phase 5 Implemented Flow: File Storage And Government Handover

For 10 lakh+ scale, uploaded files are not treated as loose application attachments. Every submitted application now carries a storage manifest:

- `fileStorage.provider`: active storage provider, currently Cloudinary.
- `fileStorage.batchNumber`: deterministic batch group, e.g. `batch-000001-010000`.
- `fileStorage.basePath`: project/job/application level storage path.
- `fileStorage.files`: normalized document manifest with type, original file name, size, status, URL, public ID, and upload time.
- `fileStorage.totalStorageUsed`: application-level storage usage for reporting.

New uploads are stored under project/job/batch/application paths so documents remain searchable, exportable, and easy to hand over even when volume grows.

Admin government handover is handled from **Admin -> Applications -> Government Handover Exports**:

- Application Register CSV: master candidate/application record.
- Document Manifest CSV: all uploaded document URLs/public IDs/statuses.
- Payment Register CSV: fee and transaction audit.
- Correction Register CSV: clarification/correction audit.
- Government Handover ZIP: all of the above in one downloadable bundle.

For old records, admin can run **Repair old storage manifests** to backfill storage metadata from existing document records. This does not move files; it creates a clean index/manifest for reporting and government sharing.

## Edge Cases That Must Be Covered

- Duplicate mobile/email applying for same job.
- Candidate refreshes during payment or payment success callback is delayed.
- Razorpay success on UI but webhook delayed or failed.
- Payment deducted but verification endpoint times out.
- Candidate uploads wrong document type or oversized file.
- Candidate changes category after fee calculation.
- Application deadline expires while candidate is filling form.
- Payment deadline expires after application form is complete.
- Admin edits job dates after applications exist.
- Correction approved before candidate has generated admit card.
- Correction approved after candidate has generated admit card.
- Center capacity becomes insufficient during on-demand allocation.
- Center deactivated after some candidates already generated admit cards.
- Candidate is rejected after admit card generation.
- Bulk PDF job partially fails.
- Public admit card lookup brute force attempts.
- Multiple candidates download at the same time.
- Employee permission removed while session is active.
- Result published, unpublished, corrected, and republished.

---

---

# ðŸš€ RECRUITMENT PORTAL - STEP-BY-STEP DEVELOPMENT PLAN

## ðŸ“Š CURRENT STATE ANALYSIS

### âœ… **WHAT YOU ALREADY HAVE (Working)**

**Backend Infrastructure:**

- âœ… Microservices architecture (API Gateway, Identity, Recruitment, Communication)
- âœ… MongoDB + Mongoose models
- âœ… Redis caching
- âœ… RabbitMQ message queue
- âœ… JWT authentication
- âœ… Cloudinary integration
- âœ… Socket.IO real-time
- âœ… Express + error handling
- âœ… Rate limiting
- âœ… Swagger documentation

**Existing Models:**

- âœ… User, Employee, Role models
- âœ… Project model (basic structure)
- âœ… Job model (comprehensive with posts, fees, dates)
- âœ… Application model (with documents, education, personal details)
- âœ… Payment model
- âœ… Notification model
- âœ… Support Ticket model
- âœ… Activity Log model

**Frontend:**

- âœ… React + Vite
- âœ… React Router
- âœ… Tailwind CSS
- âœ… React Hook Form
- âœ… Axios API calls
- âœ… Zustand state management
- âœ… Socket.IO client

### âŒ **WHAT NEEDS TO BE BUILT (From Production Doc)**

**Critical New Features:**

1. âŒ Public-first flow (NO LOGIN for applicants)
2. âŒ Registration number system (ghost accounts)
3. âŒ On-demand admit card generation
4. âŒ Real-time center allocation
5. âŒ OTP-based public services
6. âŒ Dual payment timing (Step 1 vs Last Step)
7. âŒ Biometric data storage (encrypted)
8. âŒ Public landing pages per project
9. âŒ Correction window with approval workflow
10. âŒ Multi-channel support (Email auto-ticket, WhatsApp)
11. âŒ File batching for 10 lakh+ scale
12. âŒ Exam schedule with on-demand allocation

---

## ðŸŽ¯ PHASE-BY-PHASE IMPLEMENTATION PLAN

### **PHASE 1: Foundation - Public Application Flow (NO LOGIN)**

**Duration: 1-1.5 weeks**
**Priority: CRITICAL - Core architecture change**

#### **FLOW 1.1: Ghost User System & Registration Number**

**Backend Tasks:**

```
1. Update User Model
   â”œâ”€â”€ Add accountType: "ghost" | "admin" | "employee"
   â”œâ”€â”€ Add registrationNumber field (unique, indexed)
   â”œâ”€â”€ Remove password requirement for ghost accounts
   â”œâ”€â”€ Add isEmailVerified, isMobileVerified
   â””â”€â”€ Add createdVia: "public_application" | "admin"

2. Create Registration Number Service
   â”œâ”€â”€ Function: generateRegistrationNumber(projectCode, sequence)
   â”œâ”€â”€ Format: BPOL2600001234 (ProjectCode + Year + 6-digit sequence)
   â”œâ”€â”€ Store counter in Redis for atomicity
   â””â”€â”€ Fallback to DB counter if Redis fails

3. Create OTP Service
   â”œâ”€â”€ POST /api/public/otp/send (email or mobile)
   â”œâ”€â”€ POST /api/public/otp/verify
   â”œâ”€â”€ Store OTPs in Redis (5-minute expiry)
   â”œâ”€â”€ Rate limit: 3 OTP requests per 15 minutes
   â””â”€â”€ Use Twilio/MSG91 for SMS, SMTP for email
```

**Testing:**

```
Test 1: Generate registration number - should increment atomically
Test 2: Send OTP to email - should receive within 30 seconds
Test 3: Send OTP to mobile - should receive SMS
Test 4: Verify correct OTP - should return success
Test 5: Verify wrong OTP - should fail after 3 attempts
Test 6: OTP expiry - should fail after 5 minutes
```

---

#### **FLOW 1.2: Public Landing Page API**

**Backend Tasks:**

```
1. Update Project Model
   â”œâ”€â”€ Add publicLandingPageSlug field (unique, SEO-friendly)
   â”œâ”€â”€ Add isPublic boolean
   â””â”€â”€ Add citySlipReleaseDate, admitCardReleaseDate

2. Create Public Project API
   â”œâ”€â”€ GET /api/public/projects/:slug
   â”œâ”€â”€ Return: project details, jobs, important dates
   â”œâ”€â”€ Cache response in Redis (5 minutes)
   â””â”€â”€ No authentication required

3. Create Public Job Listing API
   â”œâ”€â”€ GET /api/public/projects/:slug/jobs
   â”œâ”€â”€ Return: all active jobs with fees, vacancies
   â”œâ”€â”€ Filter by category, department
   â””â”€â”€ Cache response (5 minutes)
```

**Frontend Tasks:**

```
1. Create Public Landing Page Component
   â”œâ”€â”€ Route: /apply/:projectSlug
   â”œâ”€â”€ Display: Project details, notification PDF
   â”œâ”€â”€ Job cards with fee, vacancies, eligibility
   â”œâ”€â”€ "Apply Now" button â†’ Direct to application form
   â””â”€â”€ Responsive design (mobile-first)

2. Create Job Listing Component
   â”œâ”€â”€ Filter by category, department, fee range
   â”œâ”€â”€ Search by job title
   â””â”€â”€ Job detail modal/page
```

**Testing:**

```
Test 1: Visit /apply/bihar-police-2026 - should load project details
Test 2: Cache - subsequent requests should be faster
Test 3: Invalid slug - should show 404
Test 4: Job filtering - should filter correctly
```

---

#### **FLOW 1.3: Public Application Submission (NO LOGIN)**

**Backend Tasks:**

```
1. Update Application Model
   â”œâ”€â”€ Add registrationNumber field (unique, indexed)
   â”œâ”€â”€ Add examAllocation object (for future admit card)
   â”œâ”€â”€ Add paymentTiming: "step1" | "last_step"
   â”œâ”€â”€ Add biometricData object (encrypted)
   â””â”€â”€ Add corrections array for correction window

2. Create Public Application API
   â”œâ”€â”€ POST /api/public/apply/:projectSlug
   â”œâ”€â”€ Verify email + mobile OTPs first
   â”œâ”€â”€ Create ghost user account (background)
   â”œâ”€â”€ Create application record (status: "draft")
   â”œâ”€â”€ If payment timing = "step1": create payment order
   â”œâ”€â”€ Return: applicationId, payment order (if step1)
   â””â”€â”€ Rate limit: 5 applications per hour per IP

3. Create File Upload API
   â”œâ”€â”€ POST /api/public/upload-document
   â”œâ”€â”€ Validate: file type (JPEG, PNG, PDF only)
   â”œâ”€â”€ Validate: file size (Photo: 100KB, Docs: 500KB)
   â”œâ”€â”€ Upload to Cloudinary with temporary folder
   â”œâ”€â”€ Return: publicId, url (30-minute expiry)
   â””â”€â”€ Move to permanent folder after payment success

4. Create Payment Integration
   â”œâ”€â”€ POST /api/public/payment/create-order
   â”œâ”€â”€ POST /api/public/payment/verify
   â”œâ”€â”€ On success: Generate registration number
   â”œâ”€â”€ Update application status: "submitted"
   â”œâ”€â”€ Send Email/SMS/WhatsApp with registration number
   â””â”€â”€ Create activity log
```

**Frontend Tasks:**

```
1. Multi-Step Application Form (9 steps)
   â”œâ”€â”€ Step 1: Post Selection (multi-select)
   â”œâ”€â”€ Step 2: Payment Timing (Step 1 vs Last Step)
   â”œâ”€â”€ Step 3: Personal Details
   â”œâ”€â”€ Step 4: Email + Mobile OTP Verification
   â”œâ”€â”€ Step 5: Education Qualifications
   â”œâ”€â”€ Step 6: Additional Information
   â”œâ”€â”€ Step 7: Address Details
   â”œâ”€â”€ Step 8: Document Upload (with preview)
   â”œâ”€â”€ Step 9: Review & Declaration
   â””â”€â”€ Progress indicator, validation, save draft

2. Payment Integration Component
   â”œâ”€â”€ Razorpay checkout modal
   â”œâ”€â”€ Handle success/failure
   â”œâ”€â”€ Show registration number on success
   â””â”€â”€ Download receipt button

3. Success Page
   â”œâ”€â”€ Display registration number prominently
   â”œâ”€â”€ Show what user receives (email, SMS)
   â”œâ”€â”€ Next steps: correction window, admit card dates
   â””â”€â”€ Download application PDF button
```

**Testing:**

```
Test 1: Fill complete form - should submit successfully
Test 2: Step 1 payment - should lock posts immediately
Test 3: Last step payment - should reserve for 24 hours
Test 4: Invalid OTP - should not allow submission
Test 5: File upload - should upload and show preview
Test 6: Payment success - should generate registration number
Test 7: Email/SMS - should receive confirmation within 2 minutes
Test 8: Concurrent submissions - registration numbers should be unique
```

---

### **PHASE 2: Public Services (OTP-Based)**

**Duration: 1 week**
**Priority: HIGH - User-facing features**

#### **FLOW 2.1: Application Status Check (NO LOGIN)**

**Backend Tasks:**

```
1. Create Status Check API
   â”œâ”€â”€ POST /api/public/application/status
   â”œâ”€â”€ Input: registrationNumber, mobile, dob, otp
   â”œâ”€â”€ Verify OTP first
   â”œâ”€â”€ Return: status, payment status, exam date
   â””â”€â”€ Rate limit: 30 requests per 10 minutes per IP
```

**Frontend Tasks:**

```
1. Status Check Page
   â”œâ”€â”€ Route: /check-status
   â”œâ”€â”€ Form: Registration Number + Mobile + DOB
   â”œâ”€â”€ OTP verification step
   â”œâ”€â”€ Display: Application status, payment receipt
   â””â”€â”€ Show admit card download button (if available)
```

**Testing:**

```
Test 1: Correct details - should show status
Test 2: Wrong OTP - should fail
Test 3: Invalid registration number - should show error
Test 4: Check multiple times - should not exceed rate limit
```

---

#### **FLOW 2.2: Correction Window**

**Backend Tasks:**

```
1. Update Application Model
   â”œâ”€â”€ Add correctionWindow: { startDate, endDate, isActive }
   â”œâ”€â”€ Add corrections array with approval workflow
   â””â”€â”€ Link to support ticket

2. Create Correction Request API
   â”œâ”€â”€ POST /api/public/correction/request
   â”œâ”€â”€ Input: registrationNumber, mobile, otp, corrections
   â”œâ”€â”€ Check if correction window is open
   â”œâ”€â”€ Create support ticket automatically
   â”œâ”€â”€ Assign to verification officer
   â”œâ”€â”€ Send confirmation email/SMS
   â””â”€â”€ Rate limit: 1 correction per application

3. Admin Correction Review API
   â”œâ”€â”€ GET /api/admin/corrections (list pending)
   â”œâ”€â”€ GET /api/admin/corrections/:id (view details)
   â”œâ”€â”€ PUT /api/admin/corrections/:id/approve
   â”œâ”€â”€ PUT /api/admin/corrections/:id/reject
   â””â”€â”€ Send notification on approval/rejection
```

**Frontend Tasks:**

```
1. Public Correction Request Page
   â”œâ”€â”€ Route: /correction-request
   â”œâ”€â”€ OTP verification first
   â”œâ”€â”€ Show current application data
   â”œâ”€â”€ Select fields to correct
   â”œâ”€â”€ Upload supporting documents
   â”œâ”€â”€ Submit with reason
   â””â”€â”€ Show ticket ID and estimated time

2. Admin Correction Dashboard
   â”œâ”€â”€ List pending corrections
   â”œâ”€â”€ Side-by-side comparison (old vs new)
   â”œâ”€â”€ Document preview
   â”œâ”€â”€ Approve/Reject buttons
   â””â”€â”€ Add comments
```

**Testing:**

```
Test 1: Submit correction within window - should create ticket
Test 2: Submit outside window - should show error
Test 3: Admin approve - should update application
Test 4: Admin reject - should send notification
Test 5: Multiple corrections - should allow only 1
```

---

### **PHASE 3: Admit Card System (ON-DEMAND GENERATION)**

**Duration: 1.5-2 weeks**
**Priority: CRITICAL - Core production feature**

#### **FLOW 3.1: Exam Schedule & Slot Allocation**

**Backend Tasks:**

```
1. Create ExamSchedule Model
   â”œâ”€â”€ examScheduleId, projectId, examName
   â”œâ”€â”€ startDate, endDate, shiftsPerDay
   â”œâ”€â”€ shifts array (Morning, Afternoon, Evening)
   â”œâ”€â”€ admitCardStrategy: "on_demand"
   â”œâ”€â”€ admitCardAvailableDaysBefore: 4
   â””â”€â”€ Real-time stats (generated, downloaded)

2. Create ExamCenter Model
   â”œâ”€â”€ centerId, centerCode, name, address
   â”œâ”€â”€ city, district, capacity per shift
   â”œâ”€â”€ availableDates, availableShifts
   â”œâ”€â”€ allocations array (real-time tracking)
   â”‚   â””â”€â”€ { date, shift, capacity, allocated, available }
   â””â”€â”€ Status, facilities, coordinator

3. Auto-Allocate Candidates to Slots
   â”œâ”€â”€ Admin triggers: POST /api/admin/exam/allocate-slots
   â”œâ”€â”€ Algorithm: Distribute evenly across dates/shifts
   â”œâ”€â”€ Update Application.examAllocation
   â”‚   â””â”€â”€ { allocatedDate, allocatedShift, preferredCity }
   â””â”€â”€ Send notification with exam date/shift
```

**Testing:**

```
Test 1: Create exam schedule - should save correctly
Test 2: Add 20 centers - should all be available
Test 3: Allocate 10,000 candidates - should distribute evenly
Test 4: Check allocation - each candidate should have date/shift
```

---

#### **FLOW 3.2: On-Demand Admit Card Generation** â­

**Backend Tasks:**

```
1. Create AdmitCard Model
   â”œâ”€â”€ admitCardId, registrationNumber, rollNumber
   â”œâ”€â”€ examDate, examShift, examTime, reportingTime
   â”œâ”€â”€ examCenter (populated on-demand)
   â”œâ”€â”€ seatNumber, hallNumber, rowNumber
   â”œâ”€â”€ qrCodeData, barcodeValue
   â”œâ”€â”€ pdfUrl, pdfPublicId, pdfSize
   â”œâ”€â”€ generatedAt, generationMethod: "on_demand"
   â””â”€â”€ downloadCount, downloadHistory

2. Create Admit Card Service
   â”œâ”€â”€ generateAdmitCardOnDemand(registrationNumber)
   â”œâ”€â”€ Check if already generated (return cached PDF)
   â”œâ”€â”€ Validate eligibility (4 days before, approved, paid)
   â”œâ”€â”€ Allocate center REAL-TIME:
   â”‚   â”œâ”€â”€ Find centers in preferred city
   â”‚   â”œâ”€â”€ Check available capacity (atomic query)
   â”‚   â”œâ”€â”€ Lock 1 seat (decrement available)
   â”‚   â””â”€â”€ Handle race conditions (retry)
   â”œâ”€â”€ Generate roll number, seat number
   â”œâ”€â”€ Create QR code (encrypted data)
   â”œâ”€â”€ Generate PDF (PDFKit or Puppeteer)
   â”œâ”€â”€ Upload to Cloudinary (batched folder)
   â”œâ”€â”€ Save to database
   â”œâ”€â”€ Update center capacity
   â””â”€â”€ Send email/SMS notification

3. Create Public Admit Card Download API
   â”œâ”€â”€ POST /api/public/admit-card/download
   â”œâ”€â”€ Input: registrationNumber, mobile, dob, otp
   â”œâ”€â”€ Verify OTP
   â”œâ”€â”€ Check if available (4 days before exam date)
   â”œâ”€â”€ Call generateAdmitCardOnDemand()
   â”œâ”€â”€ Track download (increment count)
   â”œâ”€â”€ Return: PDF URL (signed, 1-hour expiry)
   â””â”€â”€ Rate limit: 30 requests per 10 minutes per IP

4. Real-Time Center Allocation Algorithm
   â”œâ”€â”€ Query centers with available capacity
   â”œâ”€â”€ Sort by most available first
   â”œâ”€â”€ ATOMIC UPDATE: Decrement capacity by 1
   â”œâ”€â”€ If fails (race condition): Retry with next center
   â””â”€â”€ If no centers: Alert admin, suggest emergency center
```

**Frontend Tasks:**

```
1. Public Admit Card Download Page
   â”œâ”€â”€ Route: /download-admit-card
   â”œâ”€â”€ Form: Registration Number + Mobile + DOB
   â”œâ”€â”€ OTP verification
   â”œâ”€â”€ Check if available (show release date if not)
   â”œâ”€â”€ Download button â†’ Triggers generation
   â”œâ”€â”€ Show loading (2-3 seconds for generation)
   â”œâ”€â”€ Display admit card details
   â”œâ”€â”€ Download PDF button
   â””â”€â”€ Print button

2. Admin Monitoring Dashboard
   â”œâ”€â”€ Real-time stats (generated, pending, centers used)
   â”œâ”€â”€ Date-wise breakdown
   â”œâ”€â”€ Center utilization (capacity charts)
   â”œâ”€â”€ SLA alerts (capacity reaching 95%)
   â”œâ”€â”€ Send reminder to non-downloaders
   â””â”€â”€ Add emergency center button
```

**Testing:**

```
Test 1: Download admit card (first time) - should generate in 2-3 sec
Test 2: Download again - should return cached PDF instantly
Test 3: Before 4 days - should show "Available from..." message
Test 4: Concurrent downloads - no duplicate seat allocation
Test 5: Center full - should allocate to next available center
Test 6: 1000 concurrent requests - all should succeed without errors
Test 7: PDF quality - should have photo, QR code, all details
Test 8: Center capacity - should decrement correctly
Test 9: Download tracking - count should increment
Test 10: Email notification - should receive within 2 minutes
```

---

### **PHASE 4: Enhanced Support System**

**Duration: 1 week**
**Priority: MEDIUM - Operations improvement**

#### **FLOW 4.1: Multi-Channel Support**

**Backend Tasks:**

```
1. Update SupportTicket Model
   â”œâ”€â”€ Add source: "email" | "phone" | "whatsapp" | "web"
   â”œâ”€â”€ Add sourceMetadata (emailId, phoneNumber, etc.)
   â”œâ”€â”€ Add messages array (conversation thread)
   â”œâ”€â”€ Add sla tracking (responseTime, resolutionTime)
   â””â”€â”€ Add feedback (rating, comment)

2. Email Auto-Ticket Creation
   â”œâ”€â”€ Setup inbound email parsing (AWS SES / SendGrid)
   â”œâ”€â”€ Extract: from, subject, body, attachments
   â”œâ”€â”€ Check for registration number in body (regex)
   â”œâ”€â”€ Lookup application if found
   â”œâ”€â”€ Create support ticket
   â”œâ”€â”€ Send auto-reply with ticket ID
   â””â”€â”€ Assign to support executive (round-robin)

3. Public Enquiry API
   â”œâ”€â”€ POST /api/public/enquiry/submit
   â”œâ”€â”€ Input: name, email, mobile, registrationNumber (optional)
   â”œâ”€â”€ Create support ticket
   â”œâ”€â”€ Send confirmation email/SMS
   â””â”€â”€ Rate limit: 5 enquiries per hour per email
```

**Frontend Tasks:**

```
1. Public Enquiry Page
   â”œâ”€â”€ Route: /support
   â”œâ”€â”€ Form: Name, Email, Mobile, Registration Number (optional)
   â”œâ”€â”€ Category dropdown
   â”œâ”€â”€ Subject + Description
   â”œâ”€â”€ File attachments (optional)
   â”œâ”€â”€ Submit button
   â””â”€â”€ Show ticket ID on success

2. Support Executive Dashboard
   â”œâ”€â”€ Multi-channel queue (Email, Phone, WhatsApp, Web)
   â”œâ”€â”€ Ticket list with filters (status, priority, source)
   â”œâ”€â”€ Ticket detail view (conversation thread)
   â”œâ”€â”€ Reply form (email/SMS/WhatsApp selector)
   â”œâ”€â”€ Quick actions (regenerate admit card, update profile)
   â”œâ”€â”€ Applicant lookup (search by registration number)
   â””â”€â”€ SLA alerts (color-coded)
```

**Testing:**

```
Test 1: Send email to support@... - should create ticket
Test 2: Submit web enquiry - should create ticket
Test 3: Support reply via email - should send to applicant
Test 4: Applicant lookup - should show full profile
Test 5: SLA breach - should show alert
```

---

### **PHASE 5: File Storage Optimization (10 Lakh+ Scale)**

**Duration: 3-4 days**
**Priority: LOW - Performance optimization**

#### **FLOW 5.1: Batched File Storage**

**Backend Tasks:**

```
1. Update Application Model
   â”œâ”€â”€ Add fileStorage.batchNumber
   â”œâ”€â”€ Add fileStorage.basePath
   â””â”€â”€ Add fileStorage.totalStorageUsed

2. Create File Upload Service
   â”œâ”€â”€ Function: getBatchNumber(registrationNumber)
   â”œâ”€â”€ Batch size: 10,000 applicants per batch
   â”œâ”€â”€ Folder: /projects/{slug}/applicants/batch-X/{regNo}/
   â”œâ”€â”€ Upload with batched folder structure
   â””â”€â”€ Store metadata in Application model

3. Bulk Export APIs
   â”œâ”€â”€ GET /api/admin/applications/export (CSV/Excel)
   â”œâ”€â”€ GET /api/admin/files/bulk-download (ZIP)
   â””â”€â”€ Background job for large exports
```

**Testing:**

```
Test 1: Upload 100 files - should batch correctly
Test 2: Generate registration numbers - should assign correct batch
Test 3: Bulk export 10,000 applications - should complete in <2 minutes
```

---

## ðŸ§ª TESTING STRATEGY (After Each Flow)

### **Test Checklist Per Flow:**

```
1. Unit Tests (Backend)
   â”œâ”€â”€ Model validation
   â”œâ”€â”€ Service functions
   â””â”€â”€ API endpoint responses

2. Integration Tests
   â”œâ”€â”€ Database operations
   â”œâ”€â”€ API calls
   â””â”€â”€ Third-party services (Cloudinary, Razorpay)

3. Load Tests
   â”œâ”€â”€ 1000 concurrent users
   â”œâ”€â”€ Admit card generation under load
   â””â”€â”€ Database query performance

4. Manual Testing
   â”œâ”€â”€ Happy path (complete flow)
   â”œâ”€â”€ Error scenarios
   â””â”€â”€ Edge cases

5. Security Tests
   â”œâ”€â”€ OTP brute force attempts
   â”œâ”€â”€ Rate limiting
   â””â”€â”€ SQL injection, XSS

6. Mobile Testing
   â”œâ”€â”€ Responsive design
   â”œâ”€â”€ Touch interactions
   â””â”€â”€ File uploads on mobile
```

---

## ðŸ“… TIMELINE SUMMARY

```
Week 1-1.5:  Phase 1 - Public Application Flow (FLOW 1.1, 1.2, 1.3)
Week 2-2.5:  Phase 2 - Public Services (FLOW 2.1, 2.2)
Week 3-4.5:  Phase 3 - Admit Card System (FLOW 3.1, 3.2) â­ CRITICAL
Week 5:      Phase 4 - Support System (FLOW 4.1)
Week 5.5:    Phase 5 - File Optimization (FLOW 5.1)

Total: 5-6 weeks for complete implementation
```

---

## ðŸš€ HOW TO PROCEED

**For Each Flow:**

1. âœ… Complete backend APIs
2. âœ… Test backend with Postman/Thunder Client
3. âœ… Build frontend components
4. âœ… Test frontend with mock data
5. âœ… Integration test (frontend + backend)
6. âœ… Fix bugs
7. âœ… Load test (if applicable)
8. âœ… Document API (Swagger)
9. âœ… **ONLY THEN** move to next flow

**Never start next flow until current flow is 100% tested and working!**

---

## ðŸ“ DEVELOPMENT WORKFLOW

### **Daily Workflow:**

```
Morning:
  - Review previous day's work
  - List today's tasks (from current flow)
  - Set up testing environment

Development:
  - Code backend APIs
  - Test each API endpoint immediately
  - Fix bugs as you find them
  - Commit frequently (small commits)

Afternoon:
  - Build frontend components
  - Test frontend with backend
  - Integration testing
  - Document any issues

Evening:
  - Code review (if team)
  - Update progress tracker
  - Plan tomorrow's tasks
  - Deploy to dev environment
```

### **Weekly Milestones:**

```
End of Week 1: Phase 1 complete, tested, deployed to dev
End of Week 2: Phase 2 complete, tested, deployed to dev
End of Week 3-4: Phase 3 complete, tested, deployed to dev
End of Week 5: Phase 4-5 complete, tested, deployed to dev
Week 6: Final testing, bug fixes, staging deployment
```

---

## âš ï¸ CRITICAL RULES

1. **NEVER skip testing** - Each flow must be 100% tested before moving on
2. **NEVER commit broken code** - Always test locally first
3. **NEVER work on multiple flows simultaneously** - Complete one, then move to next
4. **ALWAYS use version control** - Commit frequently with clear messages
5. **ALWAYS document APIs** - Update Swagger docs as you build
6. **ALWAYS handle errors** - Every API should have proper error handling
7. **ALWAYS validate inputs** - Never trust client data
8. **ALWAYS use transactions** - For multi-step database operations
9. **ALWAYS log important actions** - Use ActivityLog model
10. **ALWAYS consider scale** - Think about 10 lakh+ users from day 1

---

## ðŸŽ¯ SUCCESS CRITERIA

### **Phase 1 Success:**

- âœ… Applicant can submit application without login
- âœ… Registration number generated correctly
- âœ… OTP verification works (email + mobile)
- âœ… Payment integration works (both timings)
- âœ… Email/SMS confirmation sent
- âœ… Public landing page loads fast (<2 seconds)

### **Phase 2 Success:**

- âœ… Status check works with OTP
- âœ… Correction request creates ticket
- âœ… Admin can approve/reject corrections
- âœ… Notifications sent on approval/rejection

### **Phase 3 Success:** â­ MOST CRITICAL

- âœ… Admit card generates on-demand in <3 seconds
- âœ… Center allocated in real-time (no duplicates)
- âœ… 1000 concurrent downloads work without errors
- âœ… PDF quality is good (photo, QR code, all details)
- âœ… Cached PDF returns instantly on second download
- âœ… Admin dashboard shows real-time stats
- âœ… Capacity management works (no overbooking)

### **Phase 4 Success:**

- âœ… Email to support creates ticket automatically
- âœ… Support executive can reply via multiple channels
- âœ… SLA tracking works
- âœ… Applicant lookup fast (<1 second)

### **Phase 5 Success:**

- âœ… Files organized in batches
- âœ… Bulk export works for 10,000+ records
- âœ… Storage usage tracked

---

## ðŸ”¥ READY TO START?

**Next Step: Begin with PHASE 1 - FLOW 1.1: Ghost User System & Registration Number**

Would you like me to start implementing FLOW 1.1 now?
