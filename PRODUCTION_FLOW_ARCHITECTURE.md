# 2026-08-07 Production Architecture Correction

This correction is the controlling requirement for this architecture document. It supersedes older sections that describe a pure public/no-login-only applicant flow or bulk generation/allocation for every eligible candidate.

## Final Product Direction

Build a **hybrid recruitment platform**:

- Public pages are open for notices, job details, application start, status lookup, admit card lookup, result lookup, and QR verification.
- Candidates still have a lightweight account/session because real production systems need draft recovery, payment recovery, document re-upload, correction, support tickets, and application history.
- Public sensitive actions use registration/application number + DOB/mobile + OTP.
- Admin, super admin, and employees always use login with RBAC and audit logs.

## Real-World Reference Pattern

- UPSC uses mandatory One-Time Registration for online applications: https://upsconline.gov.in/upsc/OTRP/instr_otr.php
- UPSC application portal validates mobile/email and creates reusable applicant access: https://upsconline.nic.in/
- SSC uses One-Time Registration before candidates apply online: https://ssc.gov.in/
- IBPS-style call-letter/call-letter FAQ pattern uses registration number/roll number with password or date of birth: https://www.ibps.in/index.php/faq/

## Architecture Decisions That Must Not Be Reversed

### 1. Candidate Identity

Use these identifiers independently:

- `candidateId`: internal candidate account/user ID.
- `applicationId`: draft/application tracking ID generated when application starts.
- `registrationNumber`: final submitted application number generated after successful payment/final submit.
- `paymentTransactionId`: gateway and internal payment audit reference.
- `rollNumber`: exam-specific number generated only after allocation lock.
- `admitCardNumber`: optional printed document identifier.

### 2. Application Flow

Default flow:

1. Public project/job page.
2. Candidate starts application.
3. Email/mobile OTP verification.
4. Candidate account/session is created or recovered.
5. Candidate fills application and uploads documents.
6. Candidate reviews declaration.
7. Candidate pays fee.
8. Backend verifies payment through gateway response and webhook reconciliation.
9. Application becomes final submitted.
10. Registration number and acknowledgement are generated.

Special flow:

- Step-1 payment is allowed only if admin configures fee-before-form for that job.
- Even in that case, the system must support failed payment recovery, duplicate payment detection, and refund/reconciliation.

### 3. Center Allocation And Admit Cards

Client requirement: do **not** allocate seats or generate admit cards for every eligible candidate in advance. If 10 lakh candidates submit applications but only a much smaller group actually intends to appear, bulk allocation wastes center capacity, PDF generation, storage, attendance sheets, and admin operations.

Use **controlled on-demand allocation**:

- Admin predefines exam schedules, eligible center pools, rooms, capacities, buffers, cutoff time, and release date.
- Candidate receives exact center/room/seat/roll number only when they request/download the admit card for the first time.
- First admit-card request performs an atomic allocation and PDF generation.
- Repeat downloads return the same cached admit card.
- The allocation must be auditable, deterministic within the available pool, and protected by capacity locks.

Correct production lifecycle:

1. Admin creates exam schedule for project/job/post/shift.
2. Admin creates/selects centers and rooms for that schedule.
3. System calculates usable capacity.
4. Admin previews eligible candidates, expected turnout, and available capacity.
5. Admin configures on-demand allocation rules:
   - allocation basis: preferred city/district, category, post, language, PWD facility, center priority
   - capacity buffer: e.g. keep 5-10% emergency seats
   - cutoff: last normal download time before exam
   - late-download policy: allow/deny/admin approval
6. Admin publishes admit-card download window.
7. Candidate requests admit card after release date through login or public OTP lookup.
8. System atomically reserves one seat from the eligible capacity pool.
9. System assigns center, room, seat, roll number, QR/barcode, and PDF.
10. System caches PDF and records download history.
11. Admin generates attendance sheets from committed on-demand allocations.
12. Admin can generate delta sheets for authorized late downloads.

On-demand behavior must follow these rules:

- Return cached PDF if already generated.
- Never reassign center on repeated download.
- Atomic capacity decrement must happen in one DB transaction/update.
- If selected center is full, retry next eligible center.
- If all centers are full, block generation, alert admin, and show a clear "capacity temporarily unavailable" message.
- Admin emergency-center addition can reopen allocation for pending candidates.
- Attendance sheets must exclude candidates who never generated/downloaded admit cards.
- Late downloads after attendance printing must create delta attendance sheets.

### 4. Correction Rules

- Corrections are allowed only inside configured correction window.
- Immutable fields after payment/final submission: mobile, email, DOB, category, payment category, selected post, identity proof, unless admin opens correction.
- Corrections must store old value, new value, reason, supporting document, reviewer, decision, timestamp, and audit log.
- If correction affects admit card after allocation lock, system must require admin review and regeneration.

### 5. Result Lifecycle

Results are not a single upload button. Production flow:

1. Admin creates result event for project/job/exam.
2. Admin imports marks/status list.
3. System validates roll numbers and duplicate rows.
4. Admin previews validation errors.
5. Admin locks result dataset.
6. Admin publishes public result lookup.
7. Candidate checks result using registration/roll number + DOB or OTP.
8. Any correction requires versioning, reason, and republish audit log.

### 6. Operational Edge Cases

The implementation must handle:

- Duplicate candidate records.
- Multiple applications for the same job by same mobile/email.
- Payment success UI but webhook delay.
- Payment deducted but final verification timeout.
- Refund or duplicate payment.
- Deadline expiry while form is open.
- Admin changes schedule after applications exist.
- Admin removes a center before allocation.
- Admin removes a center after some candidates have already generated admit cards.
- Candidate starts admit-card generation and closes browser before PDF completes.
- Candidate tries to generate admit card after normal cutoff.
- Candidate generates admit card after attendance sheet was already printed.
- Center pool reaches 95% usage during admit-card download rush.
- Two candidates attempt to take the last available seat at the same time.
- Candidate's correction is approved after admit card generation and requires regeneration.
- Correction approved after admit card generation.
- Rejected candidate attempting admit card download.
- Bulk PDF ZIP partial failure.
- Attendance sheet requested for a center with no generated admit cards.
- Delta attendance sheet needed for late authorized downloads.
- Public lookup brute force attacks.
- Employee permission change during active session.
- Result upload with invalid roll number or duplicate row.

### 7. File Storage And Government Handover

At production scale, file storage must be exportable and auditable without opening each application one by one.

Implemented operating model:

- Each application has a normalized `fileStorage` manifest.
- New document uploads are grouped by project, job, batch, and application/registration number.
- Batch size is designed around 10,000 applications per group so 10 lakh+ records remain manageable.
- Document exports use manifests, not browser-side aggregation.
- Admin can download government handover bundles from Applications:
  - application register CSV
  - document manifest CSV
  - payment register CSV
  - correction register CSV
  - combined ZIP bundle
- Legacy records can be repaired by generating manifests from existing document metadata.

This gives the third-party operator a practical way to share candidate application information with government stakeholders: one ZIP for structured registers plus document URLs/public IDs for hard-copy or archival retrieval.

---

---

# ðŸ›ï¸ Government Recruitment Portal - Production-Ready Architecture & Flow

## ðŸ“‹ Executive Summary

This document outlines the **end-to-end production-ready architecture** for a government recruitment platform designed to handle **lakhs (100,000+) of concurrent users**. The system follows real-world government recruitment portals like **UPSC, SSC, Railway Recruitment Board (RRB), Bihar STET**, etc.

### ðŸŽ¯ **Core Architecture Principle: Public-First Design**

**This platform operates on a PUBLIC-FIRST model where:**

- âŒ **NO user registration/login required for applicants**
- âœ… **Direct public form fill via shareable URLs**
- âœ… **Registration number-based tracking system**
- âœ… **Public admit card download with OTP verification**
- âœ… **Admin & Staff portal for management (login-based)**
- âœ… **Enhanced enquiry management for support teams**

This mirrors real-world government recruitment portals where applicants fill forms directly without creating accounts, and track their applications using registration numbers.

---

## ï¿½ Real-World Government Portal Examples

### **How Top Government Portals Work:**

#### **1. UPSC (upsc.gov.in)**

```
Flow:
1. Public URL for each recruitment
2. One-time registration (generates Registration ID)
3. Direct form fill (no repeated logins)
4. Registration number + Password for tracking
5. Public admit card download
6. Result check via Registration number

Key Features:
- Lakhs of applications per recruitment
- Public form with minimal authentication
- Registration ID is permanent identifier
```

#### **2. Railway RRB (rrbcdg.gov.in)**

```
Flow:
1. Direct public application form
2. Payment integrated in form flow
3. Registration number generation after payment
4. SMS/Email/WhatsApp notifications
5. Public admit card portal (Reg No. + DOB)
6. No candidate dashboard needed

Key Features:
- Handles 1+ crore applicants
- Simple registration number based tracking
- Public services (admit card, result)
```

#### **3. Bihar STET (bsebstet.com)**

```
Flow:
1. Public landing page per examination
2. Direct form fill
3. Document upload during application
4. Payment gateway integration
5. Registration number via SMS/Email
6. Public admit card download

Key Features:
- 5+ lakh applicants per exam
- No login after initial application
- Registration number is primary ID
```

#### **4. SSC (ssc.nic.in)**

```
Flow:
1. One-time registration per year
2. Registration ID used for all exams
3. Application form per post
4. Payment per application
5. Public status tracking
6. Public admit card download

Key Features:
- 50+ lakh applicants yearly
- Registration ID reused across exams
- Minimal user account features
```

### **Common Pattern Across All Platforms:**

âœ… Public form fill (minimal authentication barriers)  
âœ… Registration number as primary identifier  
âœ… OTP/DOB verification for sensitive operations  
âœ… No mandatory user dashboard  
âœ… Public admit card download  
âœ… SMS/Email/WhatsApp notifications  
âœ… Admin portal for staff management

---

## ï¿½ðŸŽ¯ Current System Analysis

### Existing Architecture (Microservices)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      API GATEWAY (Port 5000)                â”‚
â”‚          Routes all requests to microservices               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚                     â”‚                     â”‚
        â–¼                     â–¼                     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Identity    â”‚    â”‚   Recruitment    â”‚    â”‚ Communication   â”‚
â”‚  Service     â”‚    â”‚   Service        â”‚    â”‚   & Payment     â”‚
â”‚  (5001)      â”‚    â”‚   (5002)         â”‚    â”‚   Service       â”‚
â”‚              â”‚    â”‚                  â”‚    â”‚   (5003)        â”‚
â”‚ - Auth       â”‚    â”‚ - Jobs           â”‚    â”‚ - Payments      â”‚
â”‚ - Users      â”‚    â”‚ - Applications   â”‚    â”‚ - Notifications â”‚
â”‚ - Employees  â”‚    â”‚ - Admit Cards    â”‚    â”‚ - Support       â”‚
â”‚ - Roles      â”‚    â”‚ - Exam Centers   â”‚    â”‚ - Email/SMS     â”‚
â”‚ - Activity   â”‚    â”‚ - Projects       â”‚    â”‚                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Infrastructure Stack

- **Backend**: Node.js + Express (Microservices)
- **Database**: MongoDB (with indexes)
- **Cache**: Redis (session, rate limiting)
- **Message Queue**: RabbitMQ (async tasks)
- **File Storage**: Cloudinary (documents, photos)
- **Payments**: Razorpay (primary gateway)
- **Communication**: Email (SMTP), SMS (Twilio/MSG91), WhatsApp (Business API)
- **Real-time**: Socket.IO
- **Frontend**: React + Vite

---

## ðŸ”„ Enhanced Production Flow (As Per New Requirements)

### **1ï¸âƒ£ Admin Portal - Project & Campaign Management**

#### **1.1 Project Creation Workflow**

```
Admin Login â†’ Dashboard â†’ Create Project
                            â”‚
                            â”œâ”€â”€ Project Name: "Bihar Police Constable 2026"
                            â”œâ”€â”€ Department: "Bihar Police"
                            â”œâ”€â”€ State: "Bihar"
                            â”œâ”€â”€ Start Date & End Date
                            â”œâ”€â”€ Status: Upcoming/Active/Completed
                            â””â”€â”€ Generate Public URL (Landing Page)
```

**Database: Project Model**

```javascript
{
  name: "Bihar Police Constable 2026",
  description: "Recruitment for 10,000 Constable Posts",
  department: "Bihar Police",
  state: "Bihar",
  status: "Active", // Upcoming, Active, Completed, Cancelled
  startDate: "2026-08-10",
  endDate: "2027-01-31",
  closureDate: "2027-01-31",
  publicLandingPageSlug: "bihar-police-constable-2026", // SEO friendly URL
  totalJobs: 5, // Auto-calculated
  totalApplicants: 0, // Auto-updated
  totalRevenue: 0, // Auto-updated
  createdBy: ObjectId("admin_employee_id")
}
```

**Public Landing Page URL**:

```
https://recruitment.gov.in/apply/bihar-police-constable-2026
```

---

#### **1.2 Job Posting Under Project**

```
Project Dashboard â†’ Add Job/Post
                      â”‚
                      â”œâ”€â”€ Post Code: "BP-CONST-001"
                      â”œâ”€â”€ Title: "Constable (Male) - General"
                      â”œâ”€â”€ Total Posts: 2500
                      â”œâ”€â”€ Reserved Posts: SC/ST/OBC/EWS/PWD breakdown
                      â”œâ”€â”€ Application Fee Structure
                      â”‚    â”œâ”€â”€ General/OBC: â‚¹800
                      â”‚    â”œâ”€â”€ SC/ST/PWD: â‚¹400
                      â”‚    â””â”€â”€ EWS: â‚¹600
                      â”œâ”€â”€ Salary Range: â‚¹25,000 - â‚¹30,000
                      â”œâ”€â”€ Age Limit: 18-25 years (with relaxation)
                      â”œâ”€â”€ Education: 10th/12th/Graduate
                      â”œâ”€â”€ Physical Standards (Height/Chest)
                      â””â”€â”€ Important Dates:
                           â”œâ”€â”€ Application Start: 2026-08-10
                           â”œâ”€â”€ Application End: 2026-09-10
                           â”œâ”€â”€ Correction Window: 2026-09-11 to 2026-09-15
                           â”œâ”€â”€ Admit Card Release: 2026-10-01
                           â”œâ”€â”€ Exam Date: 2026-10-15
                           â””â”€â”€ Result Date: 2026-11-30
```

**Multiple Jobs Example**:

- BP-CONST-001: Constable (Male) - General
- BP-CONST-002: Constable (Female) - General
- BP-SI-001: Sub-Inspector - Technical
- BP-HEAD-001: Head Constable - Radio Operator
- BP-DRIVER-001: Driver Constable

---

#### **1.3 Staff Management & Role-Based Access Control (RBAC)**

**Admin Staff Roles**:

```
1. Super Admin (Full Access)
   - Create Projects
   - Manage All Jobs
   - Access All Applicant Data
   - Financial Reports

2. Project Manager (Project-Specific)
   - Manage Jobs within Project
   - Review Applications
   - Generate Reports

3. Verification Officer
   - Verify Documents
   - Approve/Reject Applications
   - Request Corrections

4. Support Executive
   - Handle Enquiries
   - Manage Support Tickets
   - Update Applicant Profile (with permission)

5. Finance Manager
   - Payment Reconciliation
   - Refund Management
   - Revenue Reports

6. Data Entry Operator
   - View-only access to applications
   - Update specific fields (marks, status)
```

**Permission Matrix** (Already in system):

```javascript
{
  projects: { create, view, edit, delete },
  jobs: { create, view, edit, delete },
  applications: { create, view, edit, delete },
  payments: { view, refund },
  admitCards: { create, view, edit, delete, download },
  results: { create, view, edit, delete },
  support: { view, reply, resolve }
}
```

---

### **2ï¸âƒ£ Public User Flow - Application Journey (NO LOGIN REQUIRED)**

#### **Phase 1: Direct Public Access**

```
User visits Landing Page (Public URL)
  â””â”€â”€ https://recruitment.gov.in/apply/bihar-police-constable-2026
       â”‚
       â”œâ”€â”€ View Project Details & Notification PDF
       â”œâ”€â”€ View all available posts (5 jobs with details)
       â”œâ”€â”€ Check Eligibility Criteria
       â”œâ”€â”€ Read Important Instructions
       â””â”€â”€ Click "Apply Now" â†’ DIRECTLY START FILLING FORM
            â”‚
            â””â”€â”€ NO Registration/Login Required
                 â”‚
                 â””â”€â”€ User fills form â†’ Creates "ghost" account in background
                      â””â”€â”€ Registration Number Generated AFTER Payment Success
```

**Backend: Auto-Create User Record** (Transparent to User):

```javascript
// Auto-created after form submission with payment
{
  userId: "BPOL26000001", // Auto-generated (internal use only)
  registrationNumber: "BPOL2600001234", // PRIMARY IDENTIFIER (user-facing)
  email: "candidate@example.com",
  mobile: "+919876543210",
  dateOfBirth: "2000-01-15", // Used for verification
  role: "applicant", // Not "candidate" - they never login
  accountType: "ghost", // No login credentials needed
  isEmailVerified: true, // Verified via OTP during application
  isMobileVerified: true,
  createdVia: "public_application",
  registeredAt: "2026-08-10T10:30:00Z"
}
```

**Key Difference from Current System**:

- âŒ NO user registration page
- âŒ NO password creation
- âŒ NO mandatory login for applicants
- âœ… Direct form fill with OTP verification only
- âœ… Registration number is the only credential needed
- âœ… Admit card download via Reg No. + Mobile + DOB + OTP

---

#### **Phase 2: Application Form Fill (Multi-Step)**

**Step 1: Post Selection** (NEW REQUIREMENT)

```
Select Posts You Want to Apply For:
  â˜ BP-CONST-001: Constable (Male) - General (Fee: â‚¹800)
  â˜ BP-CONST-002: Constable (Female) - General (Fee: â‚¹800)
  â˜ BP-SI-001: Sub-Inspector - Technical (Fee: â‚¹1200)

Total Application Fee: â‚¹2,800
```

**Payment Options** (NEW):

```
Option A: Pay Now (Step 1) - Lock all selected posts immediately
Option B: Pay Later (Last Step) - Reserve posts for 24 hours
```

**Step 2: Personal Details**

```
- Full Name, Father's Name, Mother's Name
- Date of Birth, Gender
- Category (General/OBC/SC/ST/EWS/PWD)
- Marital Status, Religion
- Registered Mobile & Email
- Identification Mark
- Domicile of Bihar (Yes/No)
```

**Step 3: Educational Qualifications**

```
- 10th: Board, School, Roll No, Year, Percentage
- 12th: Board, School, Roll No, Year, Percentage, Stream
- Graduation: Degree, University, Year, Percentage
- Post-Graduation (if applicable)
```

**Step 4: Additional Information**

```
- Government Employee? (Yes/No)
  â””â”€â”€ If Yes: Department, Years of Service
- Ex-Serviceman? (Yes/No)
- Person with Disability (PWD)? (Yes/No)
  â””â”€â”€ If Yes: Type, Percentage
- Driving License Number
- Computer Certificate
```

**Step 5: Address Details**

```
Permanent Address:
  - Address Line 1, Line 2
  - State, District, Police Station
  - Pincode

Correspondence Address:
  - Same as Permanent? (Checkbox)
  - Or enter different address
```

**Step 6: Document Upload**

```
Required Documents:
  âœ“ Photo (JPEG, <100KB, passport size, white background)
  âœ“ Signature (JPEG, <50KB, black ink)
  âœ“ 10th Certificate (PDF, <500KB)
  âœ“ 12th Certificate (PDF, <500KB)
  âœ“ Graduation Certificate (PDF, <500KB)
  âœ“ Caste Certificate (if SC/ST/OBC)
  âœ“ Domicile Certificate
  âœ“ PWD Certificate (if applicable)
  âœ“ Aadhar Card (PDF, <500KB)
```

**File Upload Flow**:

```
Select File â†’ Validate Format & Size â†’ Upload to Cloudinary â†’
Save URL in DB â†’ Show Preview â†’ Allow Re-upload
```

**Step 7: Biometric Data** (NEW REQUIREMENT)

```
- Upload 10 Fingerprints (via mobile app or center)
- Face Photo with Biometric Hash
- Store in encrypted format
- Link to Registration Number
```

**Step 8: Review & Declaration**

```
- Preview all filled data
- Edit any section (go back to step)
- Accept Declaration Checkbox
- Click "Proceed to Payment" or "Save as Draft"
```

---

#### **Phase 3: Payment Processing**

**Payment Timing Options**:

**Option 1: Step 1 Payment** (Immediate Lock)

```
User selects posts â†’ Calculate Total Fee â†’ Payment Gateway â†’
Success â†’ Application Locked â†’ Continue Form Fill
```

**Option 2: Last Step Payment** (24-hour reservation)

```
User fills entire form â†’ Review â†’ Payment Gateway â†’
Success â†’ Application Submitted
```

**Payment Flow**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              PAYMENT GATEWAY INTEGRATION                â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Primary: Razorpay                                      â”‚
â”‚  Fallback: Cashfree, PayU, CCAvenue                    â”‚
â”‚                                                         â”‚
â”‚  Methods Supported:                                     â”‚
â”‚  - Credit/Debit Cards (Visa, Mastercard, RuPay)       â”‚
â”‚  - UPI (GPay, PhonePe, Paytm)                         â”‚
â”‚  - Net Banking (All major banks)                       â”‚
â”‚  - Wallets (Paytm, MobiKwik)                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Payment Success Actions**:

```
1. Update Payment Status in DB
2. Generate Registration Number: BPOL2600001234
3. Send Confirmation Email with:
   - Registration Number
   - Payment Receipt
   - Application Summary PDF
4. Send WhatsApp Message with Registration Number
5. Send SMS with Registration Number
6. Create Notification in User Dashboard
7. Update Application Status: "submitted"
```

**Payment Failure Handling**:

```
1. Mark payment as "failed"
2. Allow retry (3 attempts)
3. Keep form data saved
4. Send email with retry link
5. Auto-cancel after 24 hours if not paid
```

---

#### **Phase 4: Post-Submission (NO DASHBOARD ACCESS)**

**What User Receives**:

```
âœ“ Registration Number: BPOL2600001234 (PRIMARY CREDENTIAL)
âœ“ Application ID: APP-BP-2026-001234
âœ“ Payment Receipt (PDF) via Email/WhatsApp
âœ“ Complete Application Form PDF via Email
âœ“ Email Confirmation with all details
âœ“ WhatsApp Message with Registration Number
âœ“ SMS Confirmation with Registration Number
```

**Post-Submission User Actions (NO LOGIN REQUIRED)**:

```
Public Portal Options:
  â”‚
  â”œâ”€â”€ 1. Check Application Status
  â”‚    â””â”€â”€ Enter: Registration Number + Mobile + DOB + OTP
  â”‚         â””â”€â”€ View: Status, Payment Receipt, Application PDF
  â”‚
  â”œâ”€â”€ 2. Download Admit Card (after release date)
  â”‚    â””â”€â”€ Enter: Registration Number + Mobile + DOB + OTP
  â”‚         â””â”€â”€ Download: Admit Card PDF
  â”‚
  â”œâ”€â”€ 3. Request Correction (during correction window)
  â”‚    â””â”€â”€ Enter: Registration Number + Mobile + OTP
  â”‚         â””â”€â”€ Submit: Correction Request with Documents
  â”‚
  â”œâ”€â”€ 4. Submit Enquiry/Support Ticket
  â”‚    â””â”€â”€ Enter: Registration Number + Contact Details
  â”‚         â””â”€â”€ Submit: Query (Email/Phone/WhatsApp follow-up)
  â”‚
  â””â”€â”€ 5. Check Results (after declaration)
       â””â”€â”€ Enter: Registration Number + DOB
            â””â”€â”€ View: Result, Marks, Rank
```

**NO Candidate Dashboard** - All services are public and OTP-verified for security.

---

### **3ï¸âƒ£ Correction Window (Public Access with OTP)**

**Timeline**: 11-Sep-2026 to 15-Sep-2026 (5 days)

**Correction Process (NO LOGIN REQUIRED)**:

```
Public Correction Portal
  â”‚
  â”œâ”€â”€ Enter Registration Number: BPOL2600001234
  â”œâ”€â”€ Enter Registered Mobile: +919876543210
  â”œâ”€â”€ Verify OTP (sent to mobile)
  â””â”€â”€ Access Correction Form
       â”‚
       â”œâ”€â”€ View Current Application Data
       â”œâ”€â”€ Select Fields to Correct
       â”‚    â”œâ”€â”€ Personal Details
       â”‚    â”œâ”€â”€ Educational Qualification
       â”‚    â”œâ”€â”€ Address
       â”‚    â”œâ”€â”€ Category/PWD Status
       â”‚    â””â”€â”€ Documents (re-upload)
       â”‚
       â”œâ”€â”€ Upload Supporting Documents (Proof of Correction)
       â”œâ”€â”€ Provide Reason for Correction
       â”œâ”€â”€ Submit Correction Request
       â””â”€â”€ Generate Support Ticket (Auto-assigned to Verification Officer)
```

**Admin Review Workflow**:

```
Verification Officer Dashboard â†’ Pending Correction Requests
                                      â”‚
                                      â”œâ”€â”€ View: Original Data vs Requested Changes
                                      â”œâ”€â”€ Check: Supporting Documents
                                      â”œâ”€â”€ Action: Approve / Reject / Request More Info
                                      â”‚
                                      â”œâ”€â”€ If Approved:
                                      â”‚    â”œâ”€â”€ Update Application Data
                                      â”‚    â”œâ”€â”€ Log Activity (Audit Trail)
                                      â”‚    â”œâ”€â”€ Send Notification (Email/SMS/WhatsApp)
                                      â”‚    â””â”€â”€ Close Ticket
                                      â”‚
                                      â””â”€â”€ If Rejected:
                                           â”œâ”€â”€ Add Rejection Reason
                                           â”œâ”€â”€ Send Notification with Reason
                                           â””â”€â”€ Close Ticket
```

**Implementation Details**:

```javascript
// Application Model - Correction Tracking
{
  applicationId: "APP-BP-2026-001234",
  registrationNumber: "BPOL2600001234",

  correctionWindow: {
    startDate: "2026-09-11",
    endDate: "2026-09-15",
    isActive: true
  },

  corrections: [
    {
      requestId: "CORR-2026-001234",
      requestedAt: "2026-09-12T10:30:00Z",
      requestedFields: [
        {
          field: "fatherName",
          oldValue: "Ram Kumar",
          newValue: "Ram Prakash Kumar",
          supportingDocument: "cloudinary_url"
        },
        {
          field: "10th_percentage",
          oldValue: "75.5",
          newValue: "75.8",
          supportingDocument: "cloudinary_url_marksheet"
        }
      ],
      reason: "Name mismatch with 10th certificate",
      status: "pending", // pending, approved, rejected, more_info_needed
      reviewedBy: ObjectId("verification_officer_id"),
      reviewedAt: "2026-09-13T14:20:00Z",
      reviewComments: "Approved after document verification",
      supportTicketId: ObjectId("ticket_id")
    }
  ]
}
```

**Correction Limits**:

- Maximum 1 correction request per application
- Only specific fields allowed (name, DOB, category, documents)
- Cannot change: Selected Posts, Payment Details, Registration Number

---

### **4ï¸âƒ£ Admit Card Generation & Distribution (ON-DEMAND APPROACH)** â­

#### **Real-World Pattern Analysis**

**How Top Government Portals Actually Do It:**

```
RRB (Railway Recruitment Board):
  âœ… Admit cards released 4 days before candidate's exam date
  âœ… Phased release (not bulk generation)
  âœ… Center allocation happens when admit card is DOWNLOADED
  âœ… Only generates for candidates who actually download
  âœ… Resource optimization: 10,000 applications â†’ 7,000 actual exam takers

SSC (Staff Selection Commission):
  âœ… Phased release: 2-3 days before specific exam date
  âœ… Center allocation at download time
  âœ… Exam City Slip released first (10-15 days before)
  âœ… Actual admit card with center details released 2-3 days before

UPSC:
  âœ… Admit cards released 10 days before exam
  âœ… On-demand generation when candidate downloads
  âœ… Center allocation based on real-time availability

NTA (National Testing Agency) - JEE/NEET:
  âœ… Exam City Slip first (15 days before)
  âœ… Admit card with exact center (3-4 days before)
  âœ… Real-time center allocation based on capacity
```

**Why On-Demand Generation? (Industry Best Practice)**

âœ… **Resource Optimization**: Generate only for candidates who download (typically 70% download rate)  
âœ… **Attendance Prediction**: 10,000 applications â‰  10,000 exam takers (60-70% actual attendance)  
âœ… **Center Efficiency**: Allocate centers based on real download demand, not estimates  
âœ… **Cost Savings**: No wasted center bookings (save 30-40% cost)  
âœ… **Flexibility**: Easy to handle corrections and last-minute changes  
âœ… **Scalability**: Distributed load (downloads spread over days)  
âœ… **Accurate Capacity Planning**: Book centers as admits are downloaded

---

#### **Implementation: Two-Phase On-Demand Approach**

**Phase 1: Exam City Intimation Slip** (Optional, 10-15 days before)

```
Purpose: Inform candidates about exam city (not exact center)
When: 10-15 days before first exam date
Contains:
  - Registration Number
  - Candidate Name
  - Exam Date & Shift
  - Exam City: "Patna" (NOT exact address)
  - Important Instructions
  - Note: "Exact center will be available on admit card 4 days before your exam"

Why?
  - Helps candidates plan travel/accommodation in advance
  - Lightweight (no PDF generation, just data display)
  - No center booking needed yet
```

**Phase 2: Admit Card with Exact Center** (4 days before) â­ **MAIN IMPLEMENTATION**

```
Purpose: Provide exact exam center with seat allocation
When: 4 days before candidate's specific exam date
Generation: ON-DEMAND (real-time when candidate downloads)
Contains:
  - All details from City Slip
  - EXACT Exam Center Name & Address
  - Reporting Time, Exam Duration
  - Seat Number, Hall Number
  - QR Code & Barcode
  - Photo & Signature

Process:
  1. Candidate visits public portal to download
  2. System checks: Is it 4 days before their exam date?
  3. If YES:
     a. Find available center in their city (real-time)
     b. Allocate seat (atomic operation)
     c. Generate PDF with center details
     d. Upload to Cloudinary
     e. Return PDF URL
  4. If already downloaded: Return cached PDF
```

---

#### **Step-by-Step On-Demand Implementation**

**STEP 1: Admin Creates Exam Schedule**

```
Admin Dashboard â†’ Exam Management â†’ Create Exam Schedule
                                       â”‚
                                       â”œâ”€â”€ Exam Name: "Bihar Police Constable 2026 - CBT"
                                       â”œâ”€â”€ Start Date: 15-Oct-2026
                                       â”œâ”€â”€ End Date: 30-Oct-2026 (16 days)
                                       â”œâ”€â”€ Shifts per Day: 3 (Morning, Afternoon, Evening)
                                       â”œâ”€â”€ Expected Applications: 10,000
                                       â”œâ”€â”€ Expected Attendance: 70% (7,000)
                                       â””â”€â”€ Admit Card Release: 4 days before each exam date
```

**Exam Schedule Model**:

```javascript
{
  examScheduleId: "EXAM-BP-2026-001",
  projectId: ObjectId("project_id"),
  examName: "Bihar Police Constable 2026 - CBT",

  // Date Range
  startDate: "2026-10-15",
  endDate: "2026-10-30",
  totalDays: 16,
  shiftsPerDay: 3,

  // Shifts Configuration
  shifts: [
    {
      shiftName: "Morning",
      startTime: "09:00 AM",
      endTime: "11:00 AM",
      reportingTime: "08:00 AM",
      duration: 120 // minutes
    },
    {
      shiftName: "Afternoon",
      startTime: "01:00 PM",
      endTime: "03:00 PM",
      reportingTime: "12:00 PM",
      duration: 120
    },
    {
      shiftName: "Evening",
      startTime: "05:00 PM",
      endTime: "07:00 PM",
      reportingTime: "04:00 PM",
      duration: 120
    }
  ],

  // Capacity Planning
  totalApplications: 10000,
  expectedAttendanceRate: 0.70, // 70%
  estimatedCandidates: 7000,

  // On-Demand Configuration
  admitCardStrategy: "on_demand", // â­ KEY SETTING
  admitCardAvailableDaysBefore: 4, // 4 days before exam date
  citySlipReleaseDate: "2026-10-01", // Optional

  // Real-time Stats (updated as admits are generated)
  totalAdmitCardsGenerated: 0,
  totalCentersActivated: 0,
  totalSeatsAllocated: 0,

  status: "scheduled"
}
```

---

**STEP 2: Auto-Allocate Candidates to Exam Dates/Shifts**

```
Admin â†’ Candidate Slot Allocation â†’ Auto-Assign
         â”‚
         â”œâ”€â”€ Algorithm: Distribute 10,000 candidates across 16 days Ã— 3 shifts
         â”œâ”€â”€ Strategy: Even distribution (approx 208 per shift)
         â”œâ”€â”€ Consider: Preferred city/district from application
         â””â”€â”€ Store: examDate & examShift in Application model

Result:
  - Each candidate assigned specific exam date + shift
  - NO center allocated yet (happens on download)
```

**Application Model Update**:

```javascript
{
  applicationId: "APP-BP-2026-001234",
  registrationNumber: "BPOL2600001234",

  // Existing fields...

  // Exam Allocation (AUTO-ASSIGNED)
  examAllocation: {
    examScheduleId: ObjectId("exam_schedule_id"),
    allocatedDate: "2026-10-20", // Auto-assigned date
    allocatedShift: "Morning", // Auto-assigned shift
    allocatedAt: "2026-09-01T10:00:00Z",
    allocationMethod: "auto_distributed",

    // From Application Form
    preferredCity: "Patna",
    preferredDistrict: "Patna",

    // Admit Card Status (NOT YET GENERATED)
    admitCardGenerated: false,
    admitCardGeneratedAt: null,
    admitCardAvailableFrom: "2026-10-16", // 4 days before 20th Oct
    downloadCount: 0,

    // Center Allocation (NULL - populated on-demand)
    examCenter: null, // â­ Allocated when admit card is downloaded
    rollNumber: null,
    seatNumber: null,
    hallNumber: null
  }
}
```

---

**STEP 3: Admin Creates Exam Center Pool**

```
Admin â†’ Exam Centers â†’ Add Centers
         â”‚
         â”œâ”€â”€ Create 20-30 centers across Bihar
         â”œâ”€â”€ Each center: Capacity, Location, Dates, Shifts
         â””â”€â”€ Mark as "Available" (not pre-allocated)

Key: Centers are in POOL, not pre-assigned to candidates
```

**Exam Center Model**:

```javascript
{
  centerId: "CENTER-PATNA-001",
  centerCode: "BP26-PTN-001",

  // Location
  name: "Bihar Police Academy, Patna",
  address: "Gandhi Maidan, Patna - 800001",
  city: "Patna",
  district: "Patna",
  pincode: "800001",
  coordinates: { lat: 25.5941, lng: 85.1376 },

  // Capacity
  totalCapacityPerShift: 500,

  // Availability
  availableDates: ["2026-10-15", "2026-10-16", ..., "2026-10-30"],
  availableShifts: ["Morning", "Afternoon", "Evening"],

  // REAL-TIME ALLOCATION TRACKING â­
  allocations: [
    {
      date: "2026-10-15",
      shift: "Morning",
      capacity: 500,
      allocated: 0, // â­ Updated as admits are downloaded
      available: 500 // Real-time availability
    },
    {
      date: "2026-10-15",
      shift: "Afternoon",
      capacity: 500,
      allocated: 0,
      available: 500
    },
    // ... for all dates Ã— shifts
  ],

  facilities: ["AC", "CCTV", "Biometric", "Computer Lab"],
  coordinatorName: "Mr. Rajesh Kumar",
  coordinatorMobile: "+919876543210",

  status: "active"
}
```

---

**STEP 4: Candidate Downloads Admit Card (ON-DEMAND GENERATION)** â­

**Public Download Flow**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚         CANDIDATE VISITS PUBLIC ADMIT CARD PORTAL             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
                           â”œâ”€â”€ Enter Registration Number: BPOL2600001234
                           â”œâ”€â”€ Enter Mobile: +919876543210
                           â”œâ”€â”€ Enter DOB: 15-01-2000
                           â”œâ”€â”€ Verify OTP
                           â””â”€â”€ Click "Download Admit Card"
                                â”‚
                                â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   BACKEND VALIDATION                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚
                                â”œâ”€â”€ Check 1: Is it 4 days before candidate's exam date?
                                â”‚    â””â”€â”€ examDate = 20-Oct, today = 16-Oct â†’ YES âœ…
                                â”‚
                                â”œâ”€â”€ Check 2: Application status = "approved"? âœ…
                                â”œâ”€â”€ Check 3: Payment status = "completed"? âœ…
                                â”‚
                                â””â”€â”€ All checks passed â†’ Proceed
                                     â”‚
                                     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚          CHECK IF ADMIT CARD ALREADY GENERATED                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                â”‚
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚                       â”‚
                   YES                     NO
                    â”‚                       â”‚
                    â–¼                       â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  RETURN CACHED PDF   â”‚   â”‚  ON-DEMAND GENERATION        â”‚
    â”‚  (Already generated) â”‚   â”‚  (First time download)       â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 1: ALLOCATE EXAM CENTER       â”‚
                           â”‚  (REAL-TIME)                        â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ Get candidate's exam date + shift
                                             â”œâ”€â”€ Get candidate's preferred city: "Patna"
                                             â”œâ”€â”€ Query: Centers in Patna with capacity > 0
                                             â”‚    for date=20-Oct, shift=Morning
                                             â”œâ”€â”€ Find: CENTER-PATNA-001 (available: 450)
                                             â”œâ”€â”€ ATOMIC OPERATION: Lock 1 seat
                                             â”‚    â””â”€â”€ Update: allocated +1, available -1
                                             â””â”€â”€ Result: Center allocated âœ…
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 2: GENERATE ROLL NUMBER       â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â””â”€â”€ rollNumber = "BPOL26001234"
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 3: ALLOCATE SEAT NUMBER       â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ Get allocation count for this center+date+shift
                                             â”œâ”€â”€ Count = 51 (50 already allocated)
                                             â”œâ”€â”€ Calculate: Hall-A-Row-6-Seat-1
                                             â””â”€â”€ Result: Seat allocated âœ…
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 4: GENERATE QR CODE & BARCODE â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ QR Code: Encrypted data (all details)
                                             â””â”€â”€ Barcode: Roll number
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 5: CREATE ADMIT CARD PDF      â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ Use PDF template
                                             â”œâ”€â”€ Populate: Candidate info, photo, signature
                                             â”œâ”€â”€ Add: Center address, date, time, seat
                                             â”œâ”€â”€ Add: QR code, barcode, watermark
                                             â””â”€â”€ Generate: admit_card.pdf
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 6: UPLOAD TO CLOUDINARY       â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â””â”€â”€ Path: /admit-cards/batch-1/BPOL2600001234.pdf
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 7: SAVE TO DATABASE           â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ Create AdmitCard record
                                             â”œâ”€â”€ Update Application.examAllocation
                                             â””â”€â”€ Log activity
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 8: SEND NOTIFICATIONS         â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â”œâ”€â”€ Email with PDF attachment
                                             â”œâ”€â”€ SMS with download link
                                             â””â”€â”€ WhatsApp message
                                             â”‚
                                             â–¼
                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                           â”‚  STEP 9: RETURN PDF TO CANDIDATE    â”‚
                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                             â””â”€â”€ Download starts immediately âœ…
```

**Total Time: 2-3 seconds per admit card generation**

---

**Key Implementation Code Snippet**:

```javascript
// services/admitCard.service.js

async generateAdmitCardOnDemand(registrationNumber) {
  // 1. Check if already generated (return cached)
  const existing = await AdmitCard.findOne({ registrationNumber });
  if (existing) {
    await this.trackDownload(existing);
    return { pdfUrl: existing.pdfUrl, cached: true };
  }

  // 2. Get application
  const application = await Application.findOne({ registrationNumber });

  // 3. Validate eligibility
  this.validateEligibility(application); // Throws error if not eligible

  // 4. â­ ALLOCATE CENTER (REAL-TIME)
  const centerAllocation = await this.allocateCenterRealTime(
    application.examAllocation.allocatedDate,
    application.examAllocation.allocatedShift,
    application.examAllocation.preferredCity
  );

  // 5. Generate roll & seat number
  const rollNumber = this.generateRollNumber(registrationNumber);
  const seatAllocation = await this.allocateSeat(centerAllocation.centerId, ...);

  // 6. Create PDF
  const pdfBuffer = await this.createPDF({ application, centerAllocation, ... });

  // 7. Upload to Cloudinary
  const pdfUpload = await cloudinary.uploader.upload(pdfBuffer, { ... });

  // 8. Save to database
  const admitCard = await AdmitCard.create({ ... });
  await Application.updateOne({ registrationNumber }, { $set: { "examAllocation.examCenter": centerAllocation, ... } });

  // 9. Send notifications
  await this.sendNotifications(application, admitCard);

  return { pdfUrl: pdfUpload.secure_url, cached: false };
}

// â­ Real-time center allocation with atomic operation
async allocateCenterRealTime(examDate, examShift, preferredCity) {
  // Find centers with available capacity
  const centers = await ExamCenter.find({
    city: preferredCity,
    availableDates: examDate,
    availableShifts: examShift,
    "allocations": {
      $elemMatch: {
        date: examDate,
        shift: examShift,
        available: { $gt: 0 }
      }
    }
  }).sort({ "allocations.available": -1 }); // Most available first

  if (!centers.length) {
    throw new Error(`No available centers in ${preferredCity}`);
  }

  const selectedCenter = centers[0];

  // ATOMIC OPERATION: Decrement capacity
  const result = await ExamCenter.updateOne(
    {
      _id: selectedCenter._id,
      "allocations.date": examDate,
      "allocations.shift": examShift,
      "allocations.available": { $gt: 0 }
    },
    {
      $inc: {
        "allocations.$.allocated": 1,
        "allocations.$.available": -1
      }
    }
  );

  if (result.modifiedCount === 0) {
    // Race condition: retry with next center
    return this.allocateCenterRealTime(examDate, examShift, preferredCity);
  }

  return {
    centerId: selectedCenter.centerId,
    name: selectedCenter.name,
    address: selectedCenter.address,
    city: selectedCenter.city
  };
}
```

---

**Admin Real-Time Monitoring Dashboard**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚           ADMIT CARD GENERATION - LIVE DASHBOARD              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                               â”‚
â”‚  ðŸ“Š Overall Statistics:                                       â”‚
â”‚  â”œâ”€â”€ Total Applications: 10,000                              â”‚
â”‚  â”œâ”€â”€ Admit Cards Generated: 6,847 (68.47%)                   â”‚
â”‚  â”œâ”€â”€ Downloaded Today: 1,234                                 â”‚
â”‚  â”œâ”€â”€ Pending Downloads: 3,153 (31.53%)                       â”‚
â”‚  â””â”€â”€ Average Generation Time: 2.1 seconds                    â”‚
â”‚                                                               â”‚
â”‚  ðŸ¢ Center Utilization:                                       â”‚
â”‚  â”œâ”€â”€ Total Centers: 20                                       â”‚
â”‚  â”œâ”€â”€ Centers Activated: 14 (70%)                             â”‚
â”‚  â”œâ”€â”€ Total Capacity: 10,000                                  â”‚
â”‚  â”œâ”€â”€ Allocated Seats: 6,847 (68.47%)                         â”‚
â”‚  â”œâ”€â”€ Available Capacity: 3,153 (31.53%)                      â”‚
â”‚  â””â”€â”€ Most Utilized: Bihar Police Academy (89% full)          â”‚
â”‚                                                               â”‚
â”‚  ðŸ“… Date-wise Breakdown:                                      â”‚
â”‚  â”œâ”€â”€ 15-Oct: 512/520 generated (98%) - Exam tomorrow!       â”‚
â”‚  â”œâ”€â”€ 16-Oct: 498/510 generated (97%) - Exam in 4 days       â”‚
â”‚  â”œâ”€â”€ 17-Oct: 125/505 generated (24%) - Just opened          â”‚
â”‚  â”œâ”€â”€ 18-Oct: 0/500 (0%) - Opens in 3 days                   â”‚
â”‚  â””â”€â”€ ...                                                      â”‚
â”‚                                                               â”‚
â”‚  âš ï¸ Alerts:                                                   â”‚
â”‚  â”œâ”€â”€ âš ï¸ CENTER-PATNA-001 reaching capacity (95%)             â”‚
â”‚  â”œâ”€â”€ âœ… All dates covered with sufficient capacity           â”‚
â”‚  â””â”€â”€ ðŸ’¡ 3,153 candidates haven't downloaded yet (send rem inder)â”‚
â”‚                                                               â”‚
â”‚  ðŸ”§ Quick Actions:                                            â”‚
â”‚  â”œâ”€â”€ [Add Emergency Center]                                  â”‚
â”‚  â”œâ”€â”€ [Send Reminder Notifications]                           â”‚
â”‚  â”œâ”€â”€ [Export Center Allocation Report]                       â”‚
â”‚  â””â”€â”€ [View Live Generation Logs]                             â”‚
â”‚                                                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

**Benefits vs Traditional Bulk Generation**:

| Aspect                  | On-Demand (Implemented)         | Bulk Pre-Generation     |
| ----------------------- | ------------------------------- | ----------------------- |
| **Resource Usage**      | 70% generated (6,847 of 10,000) | 100% generated (10,000) |
| **Center Bookings**     | 14 centers activated            | 20+ centers pre-booked  |
| **Cost Savings**        | ~30-40% lower                   | Full cost upfront       |
| **Flexibility**         | High (corrections easy)         | Low (bulk regeneration) |
| **Attendance Accuracy** | Based on downloads              | Based on estimates      |
| **Load Distribution**   | Spread over days                | Single spike            |
| **Real-world Usage**    | âœ… RRB, SSC, NTA                | âŒ Outdated approach    |

---

**Rate Limiting** (Production Safety):

```javascript
publicAdmitCardLimiter: {
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30 // 30 download attempts per 10 minutes per IP
}
```

---

### **5ï¸âƒ£ Exam Day Operations**

**Seat Allotment Display at Center**:

```
Exam Center Entrance â†’ Digital Display Board
                        â”‚
                        â”œâ”€â”€ Search by Registration Number
                        â”‚   â””â”€â”€ BPOL2600001234 â†’ Hall-A, Row-6, Seat-1
                        â”‚
                        â”œâ”€â”€ Scan Admit Card QR Code
                        â”‚   â””â”€â”€ Shows: Candidate photo, seat number, hall
                        â”‚
                        â””â”€â”€ Biometric Verification (fingerprint match)
                             â””â”€â”€ Links to biometric data uploaded during application
```

**Center Coordinator Dashboard**:

```
Total candidates allocated today: 512
Candidates checked-in: 478 (93%)
Absent: 34 (7%)
Exam status: In Progress
```

---

### **6ï¸âƒ£ Data Storage & File Organization for Scale** (10 Lakh+ Users)

**Challenge**: Storing and managing files for 10 lakh+ applicants efficiently.

**Solution**: Hierarchical folder structure with batching strategy.

---

#### **6.1 Cloudinary Folder Structure** (Recommended)

```
/recruitment-portal
  /projects
    /bihar-police-constable-2026
      /applicants
        /batch-1 (BPOL2600000001 to BPOL2600010000) - First 10,000 applicants
          /BPOL2600000001
            â”œâ”€â”€ profile_photo.jpg
            â”œâ”€â”€ signature.jpg
            â”œâ”€â”€ aadhar_card.pdf
            â”œâ”€â”€ 10th_certificate.pdf
            â”œâ”€â”€ 12th_certificate.pdf
            â”œâ”€â”€ graduation_certificate.pdf
            â”œâ”€â”€ caste_certificate.pdf
            â”œâ”€â”€ domicile_certificate.pdf
            â”œâ”€â”€ biometric_data.enc (encrypted)
            â””â”€â”€ application_full.pdf (auto-generated)

          /BPOL2600000002
            â”œâ”€â”€ ...

          ... (10,000 folders in batch-1)

        /batch-2 (BPOL2600010001 to BPOL2600020000) - Next 10,000
          /BPOL2600010001
            â”œâ”€â”€ ...

        /batch-3 (BPOL2600020001 to BPOL2600030000)
          ... and so on

        ... (Up to batch-100 for 10 lakh applicants)

      /admit-cards
        /batch-1
          â”œâ”€â”€ BPOL2600000001_admit_card.pdf
          â”œâ”€â”€ BPOL2600000002_admit_card.pdf
          ... (10,000 PDFs)

        /batch-2
          ...

      /centers
        /CENTER-001
          â”œâ”€â”€ candidate_list.pdf
          â”œâ”€â”€ seating_arrangement.pdf
          â””â”€â”€ attendance_sheet.pdf

        /CENTER-002
          ...

      /bulk-exports
        â”œâ”€â”€ all_applications_2026-08-15.csv
        â”œâ”€â”€ payment_report_2026-08-15.xlsx
        â””â”€â”€ analytics_dashboard_data.json
```

**Batch Calculation Logic**:

```javascript
// Auto-calculate batch number from registration number
function getBatchNumber(registrationNumber) {
  // BPOL2600001234 â†’ Extract numeric part â†’ 001234
  const numericPart = parseInt(registrationNumber.slice(-6)); // Last 6 digits
  const batchNumber = Math.ceil(numericPart / 10000); // 10,000 per batch
  return `batch-${batchNumber}`;
}

// Example:
// BPOL2600000001 â†’ batch-1
// BPOL2600009999 â†’ batch-1
// BPOL2600010000 â†’ batch-1
// BPOL2600010001 â†’ batch-2
// BPOL2600050000 â†’ batch-5
// BPOL2600999999 â†’ batch-100
```

---

#### **6.2 Database File Reference Model**

```javascript
// Application Model - File Storage Reference
{
  applicationId: "APP-BP-2026-001234",
  registrationNumber: "BPOL2600001234",

  // File storage metadata
  fileStorage: {
    provider: "cloudinary", // or "aws_s3"
    batchNumber: "batch-1",
    basePath: "/recruitment-portal/projects/bihar-police-constable-2026/applicants/batch-1/BPOL2600001234",

    // Individual file references
    files: {
      profilePhoto: {
        url: "https://res.cloudinary.com/.../profile_photo.jpg",
        publicId: "recruitment-portal/projects/.../profile_photo",
        format: "jpg",
        size: 95000, // bytes
        uploadedAt: "2026-08-10T10:30:00Z",
        checksum: "md5_hash"
      },
      signature: {
        url: "https://res.cloudinary.com/.../signature.jpg",
        publicId: "recruitment-portal/projects/.../signature",
        format: "jpg",
        size: 45000,
        uploadedAt: "2026-08-10T10:32:00Z"
      },
      aadharCard: {
        url: "https://res.cloudinary.com/.../aadhar_card.pdf",
        publicId: "recruitment-portal/projects/.../aadhar_card",
        format: "pdf",
        size: 450000,
        uploadedAt: "2026-08-10T10:35:00Z",
        encrypted: false
      },
      certificates: [
        {
          type: "10th",
          url: "https://res.cloudinary.com/.../10th_certificate.pdf",
          publicId: "recruitment-portal/projects/.../10th_certificate",
          format: "pdf",
          size: 500000,
          uploadedAt: "2026-08-10T10:40:00Z"
        },
        {
          type: "12th",
          url: "https://res.cloudinary.com/.../12th_certificate.pdf",
          publicId: "recruitment-portal/projects/.../12th_certificate",
          format: "pdf",
          size: 480000,
          uploadedAt: "2026-08-10T10:42:00Z"
        },
        {
          type: "graduation",
          url: "https://res.cloudinary.com/.../graduation_certificate.pdf",
          publicId: "recruitment-portal/projects/.../graduation_certificate",
          format: "pdf",
          size: 520000,
          uploadedAt: "2026-08-10T10:45:00Z"
        }
      ],
      casteCertificate: {
        url: "https://res.cloudinary.com/.../caste_certificate.pdf",
        publicId: "recruitment-portal/projects/.../caste_certificate",
        format: "pdf",
        size: 400000,
        uploadedAt: "2026-08-10T10:50:00Z"
      },
      domicileCertificate: {
        url: "https://res.cloudinary.com/.../domicile_certificate.pdf",
        publicId: "recruitment-portal/projects/.../domicile_certificate",
        format: "pdf",
        size: 420000,
        uploadedAt: "2026-08-10T10:52:00Z"
      },
      biometricData: {
        url: "https://res.cloudinary.com/.../biometric_data.enc",
        publicId: "recruitment-portal/projects/.../biometric_data",
        format: "enc", // Encrypted format
        size: 150000,
        uploadedAt: "2026-08-10T10:55:00Z",
        encrypted: true,
        encryptionAlgorithm: "AES-256-GCM",
        encryptionKeyId: "KEY-2026-001" // Reference to key management system
      },
      applicationPdf: {
        url: "https://res.cloudinary.com/.../application_full.pdf",
        publicId: "recruitment-portal/projects/.../application_full",
        format: "pdf",
        size: 800000,
        generatedAt: "2026-08-10T11:00:00Z"
      }
    },

    totalStorageUsed: 3500000, // bytes (~3.5 MB per applicant)
  }
}
```

---

#### **6.3 File Upload Service** (Backend Implementation)

```javascript
// services/fileUpload.service.js

const cloudinary = require("cloudinary").v2;

class FileUploadService {
  // Upload file with auto-batching
  async uploadApplicantDocument(registrationNumber, file, documentType) {
    const batchNumber = this.getBatchNumber(registrationNumber);
    const folderPath = this.getApplicantFolderPath(
      registrationNumber,
      batchNumber,
    );

    // Upload to Cloudinary with folder structure
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folderPath,
      resource_type: "auto", // auto-detect image/pdf
      public_id: documentType, // e.g., "profile_photo", "10th_certificate"
      overwrite: true, // Allow re-upload (correction window)

      // Optimization
      quality: "auto:good", // Auto-optimize quality
      fetch_format: "auto", // Auto-convert format for web

      // Security
      access_mode: "authenticated", // Require signed URL for access

      // Tags for organization
      tags: [registrationNumber, documentType, batchNumber],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      uploadedAt: new Date(),
      checksum: result.etag,
    };
  }

  // Get batch number from registration number
  getBatchNumber(registrationNumber) {
    const numericPart = parseInt(registrationNumber.slice(-6));
    const batchNumber = Math.ceil(numericPart / 10000);
    return `batch-${batchNumber}`;
  }

  // Generate folder path
  getApplicantFolderPath(registrationNumber, batchNumber) {
    // Extract project slug from registration number (BPOL26 â†’ bihar-police-2026)
    const projectSlug = this.getProjectSlugFromRegNumber(registrationNumber);
    return `/recruitment-portal/projects/${projectSlug}/applicants/${batchNumber}/${registrationNumber}`;
  }

  // Bulk download all files for an applicant
  async downloadApplicantFiles(registrationNumber) {
    const application = await Application.findOne({ registrationNumber });
    const files = application.fileStorage.files;

    // Download all files as ZIP
    const zip = new AdmZip();
    for (const [key, fileData] of Object.entries(files)) {
      const fileBuffer = await this.downloadFromCloudinary(fileData.url);
      zip.addFile(`${key}.${fileData.format}`, fileBuffer);
    }

    return zip.toBuffer();
  }

  // Delete all files for an applicant (if application cancelled/rejected)
  async deleteApplicantFiles(registrationNumber) {
    const application = await Application.findOne({ registrationNumber });
    const files = application.fileStorage.files;

    // Delete from Cloudinary
    const publicIds = this.extractPublicIds(files);
    await cloudinary.api.delete_resources(publicIds, { invalidate: true });

    // Update database
    application.fileStorage.files = {};
    await application.save();
  }

  // Bulk export files for multiple applicants (Admin feature)
  async bulkExportFiles(registrationNumbers) {
    const zip = new AdmZip();

    for (const regNumber of registrationNumbers) {
      const applicantZip = await this.downloadApplicantFiles(regNumber);
      zip.addFile(`${regNumber}.zip`, applicantZip);
    }

    return zip.toBuffer();
  }
}

module.exports = new FileUploadService();
```

---

#### **6.4 Storage Cost Estimation** (10 Lakh Users)

**Average Storage Per Applicant**:

```
Photo: 100 KB
Signature: 50 KB
Aadhar Card: 450 KB
10th Certificate: 500 KB
12th Certificate: 480 KB
Graduation Certificate: 520 KB
Caste Certificate: 400 KB
Domicile Certificate: 420 KB
Biometric Data (encrypted): 150 KB
Application PDF (generated): 800 KB
-----------------------------------
Total per applicant: ~3.5 MB
```

**Total Storage for 10 Lakh Applicants**:

```
3.5 MB Ã— 10,00,000 = 3,500,000 MB = 3,500 GB = 3.5 TB
```

**Cloudinary Pricing** (Approx):

```
- Advanced Plan: $249/month for 2 TB storage + 5 TB bandwidth
- Additional storage: $0.10/GB/month
- Total cost for 3.5 TB: ~$350-400/month

OR use AWS S3:
- S3 Standard: $0.023/GB/month
- 3,500 GB Ã— $0.023 = ~$80/month
- Data transfer: $0.09/GB (first 10 TB)
```

**Recommendation**:

- **Cloudinary** for images (photo, signature) - CDN + transformations
- **AWS S3** for documents (PDFs, certificates) - cost-effective storage
- **Encrypted S3 bucket** for biometric data - compliance + security

---

#### **6.5 Database Sharding Strategy** (Optional for 10 Lakh+ scale)

**When to Shard**: If single MongoDB instance reaches capacity (>500 GB).

**Sharding Key**: `registrationNumber` (hash-based sharding)

```javascript
// Enable sharding on MongoDB
sh.enableSharding("recruitment_portal");

// Shard Application collection by registrationNumber
sh.shardCollection("recruitment_portal.applications", {
  registrationNumber: "hashed",
});

// MongoDB auto-distributes data across shards based on hash
// Shard 1: BPOL2600000001 - BPOL2600333333 (~3.33 lakh)
// Shard 2: BPOL2600333334 - BPOL2600666666 (~3.33 lakh)
// Shard 3: BPOL2600666667 - BPOL2600999999 (~3.33 lakh)
```

**Pros**:

- Horizontal scalability
- Better read/write performance
- No application code changes needed

**Cons**:

- Infrastructure complexity
- Higher cost (3+ MongoDB instances)
- Backup/restore complexity

**Alternative**: MongoDB Atlas **Cluster Autoscaling** (scales vertically first, then horizontally).

---

#### **6.6 Backup & Disaster Recovery**

**MongoDB Backups**:

```
- Automated daily backups (MongoDB Atlas)
- Point-in-time recovery (last 7 days)
- Backup retention: 30 days
- Offsite backup to AWS S3 (weekly)
```

**File Storage Backups**:

```
- Cloudinary: Auto-replication across regions
- AWS S3: Enable versioning + cross-region replication
- Backup frequency: Daily incremental, Weekly full
```

**Disaster Recovery Plan**:

```
RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 24 hours (max data loss acceptable)

Steps:
1. Restore MongoDB from latest backup
2. Restore S3/Cloudinary files from backup
3. Verify data integrity
4. Restart application servers
5. Test critical workflows (apply, admit card download)
```

---

### **7ï¸âƒ£ Enhanced Enquiry & Support Management** (MULTI-CHANNEL)

**Enquiry Channels** (24/7 Support):

```
1. ðŸ“§ Email: support@recruitment.gov.in
2. ðŸ“ž Phone: 1800-XXX-XXXX (Toll-free, 9 AM - 6 PM)
3. ðŸ’¬ WhatsApp Business: +91-XXXXX-XXXXX
4. ðŸŒ Web Form: Public Enquiry Portal (No Login Required)
5. ðŸ“± Mobile App: In-app chat support
```

**Multi-Channel Enquiry Flow**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  ENQUIRY SUBMISSION                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                             â”‚
â”‚  Email â†’ support@recruitment.gov.in                        â”‚
â”‚    â””â”€â”€ Auto-create ticket â†’ Assign to Support Executive    â”‚
â”‚                                                             â”‚
â”‚  Phone Call â†’ Toll-free number                             â”‚
â”‚    â””â”€â”€ Executive manually creates ticket in system         â”‚
â”‚                                                             â”‚
â”‚  WhatsApp â†’ Business API                                   â”‚
â”‚    â””â”€â”€ Chatbot handles basic queries                       â”‚
â”‚    â””â”€â”€ Complex queries escalated to human agent            â”‚
â”‚                                                             â”‚
â”‚  Web Form â†’ Public Enquiry Portal                          â”‚
â”‚    â””â”€â”€ Enter Registration Number + Query                   â”‚
â”‚    â””â”€â”€ Auto-create ticket with email/SMS confirmation      â”‚
â”‚                                                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Support Ticket System** (Enhanced):

```javascript
{
  ticketId: "TKT-2026-001234",

  // Applicant Info
  applicantName: "Piyush Kumar",
  registrationNumber: "BPOL2600001234", // Optional (if public user provides)
  email: "piyush@example.com",
  mobile: "+919876543210",
  alternateContact: "+919876543211", // Optional

  // Ticket Classification
  category: "application_correction / payment_issue / admit_card / document_upload / technical_issue / general_enquiry",
  subCategory: "admit_card_not_received / payment_failed / name_correction",
  priority: "low / medium / high / urgent", // Auto-set based on category

  // Ticket Details
  subject: "Unable to download admit card",
  description: "Receiving error 'Registration number not found' when trying to download admit card",
  attachments: ["screenshot_cloudinary_url"], // Optional

  // Source Tracking (NEW)
  source: "email / phone / whatsapp / web / mobile_app",
  sourceMetadata: {
    emailId: "original_email_id", // If from email
    phoneNumber: "toll_free_number", // If from phone
    whatsappMessageId: "wa_msg_id", // If from WhatsApp
    ipAddress: "192.168.1.1", // If from web
    userAgent: "Mozilla/5.0..."
  },

  // Assignment & Status
  status: "open / assigned / in_progress / waiting_for_info / resolved / closed",
  assignedTo: ObjectId("support_executive_id"),
  assignedAt: "2026-08-12T10:00:00Z",
  department: "technical_support / application_support / payment_support",

  // Communication Thread
  messages: [
    {
      messageId: "MSG-001",
      from: "user", // or "support"
      fromName: "Piyush Kumar",
      message: "Unable to download admit card",
      channel: "email", // email, phone_note, whatsapp, web, internal_note
      timestamp: "2026-08-12T10:00:00Z",
      attachments: []
    },
    {
      messageId: "MSG-002",
      from: "support",
      fromName: "Rajesh Kumar (Support Executive)",
      message: "We are checking your application status. Please provide your registered mobile number.",
      channel: "email",
      timestamp: "2026-08-12T11:00:00Z",
      internalNote: false // true if note is only visible to staff
    },
    {
      messageId: "MSG-003",
      from: "user",
      fromName: "Piyush Kumar",
      message: "+919876543210",
      channel: "email",
      timestamp: "2026-08-12T11:15:00Z"
    },
    {
      messageId: "MSG-004",
      from: "support",
      fromName: "Rajesh Kumar",
      message: "Your admit card has been regenerated. Please check your email.",
      channel: "whatsapp", // Reply sent via WhatsApp
      timestamp: "2026-08-12T12:00:00Z"
    }
  ],

  // SLA Tracking
  sla: {
    responseTime: "4 hours", // Category-based SLA
    resolutionTime: "24 hours",
    firstResponseAt: "2026-08-12T11:00:00Z",
    firstResponseWithin: true, // Met SLA
    resolvedWithin: true
  },

  // Resolution
  resolvedBy: ObjectId("support_executive_id"),
  resolvedAt: "2026-08-12T15:30:00Z",
  resolution: "Admit card re-generated and sent to registered email and WhatsApp",
  resolutionCategory: "admit_card_regenerated",

  // Applicant Satisfaction
  feedback: {
    rating: 5, // 1-5 stars
    comment: "Quick response, issue resolved",
    submittedAt: "2026-08-12T16:00:00Z"
  },

  // Related Entities
  applicationId: ObjectId("application_id"),
  projectId: ObjectId("project_id"),

  // Audit
  createdAt: "2026-08-12T10:00:00Z",
  updatedAt: "2026-08-12T15:30:00Z",
  closedAt: "2026-08-12T15:30:00Z"
}
```

**Support Executive Dashboard** (Enhanced):

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              SUPPORT EXECUTIVE DASHBOARD                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                             â”‚
â”‚  My Tickets                                                 â”‚
â”‚  â”œâ”€â”€ Open (23)                                             â”‚
â”‚  â”œâ”€â”€ In Progress (12)                                      â”‚
â”‚  â”œâ”€â”€ Waiting for Info (5)                                  â”‚
â”‚  â””â”€â”€ Resolved Today (18)                                   â”‚
â”‚                                                             â”‚
â”‚  SLA Alerts                                                 â”‚
â”‚  â”œâ”€â”€ Response Time Breach (3 tickets)                      â”‚
â”‚  â””â”€â”€ Resolution Time Breach (1 ticket)                     â”‚
â”‚                                                             â”‚
â”‚  Multi-Channel Queue                                        â”‚
â”‚  â”œâ”€â”€ ðŸ“§ Email Queue (15 unread)                           â”‚
â”‚  â”œâ”€â”€ ðŸ“ž Phone Call Logs (8 today)                         â”‚
â”‚  â”œâ”€â”€ ðŸ’¬ WhatsApp Chats (Active: 3)                        â”‚
â”‚  â””â”€â”€ ðŸŒ Web Form Submissions (12 new)                     â”‚
â”‚                                                             â”‚
â”‚  Quick Actions                                              â”‚
â”‚  â”œâ”€â”€ Regenerate Admit Card                                 â”‚
â”‚  â”œâ”€â”€ Update Applicant Profile (with approval)              â”‚
â”‚  â”œâ”€â”€ Process Refund                                         â”‚
â”‚  â”œâ”€â”€ Send Bulk Email/SMS                                   â”‚
â”‚  â””â”€â”€ Escalate to Manager                                   â”‚
â”‚                                                             â”‚
â”‚  Applicant Lookup                                           â”‚
â”‚  â””â”€â”€ Search by: Registration Number / Mobile / Email       â”‚
â”‚       â””â”€â”€ View: Full Profile, Application, Payment, Docs   â”‚
â”‚       â””â”€â”€ Actions: Update (with permission), Notes          â”‚
â”‚                                                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Staff Permission Matrix for Profile Updates** (RBAC):

```javascript
// Support Executive Permissions
{
  role: "support_executive",
  permissions: {
    applications: {
      view: true, // Can view all application details
      edit: {
        allowed: true,
        fields: ["mobile", "email", "alternateContact"], // Limited fields only
        requiresApproval: true, // Manager approval needed
        auditLog: true // All changes logged
      }
    },
    admitCards: {
      view: true,
      regenerate: true, // Can regenerate admit card
      download: true
    },
    payments: {
      view: true,
      refund: false // Cannot process refund (Finance Manager only)
    },
    supportTickets: {
      view: true,
      create: true,
      update: true,
      resolve: true,
      assignToOthers: false // Can only assign to self
    }
  }
}

// Verification Officer Permissions
{
  role: "verification_officer",
  permissions: {
    applications: {
      view: true,
      edit: {
        allowed: true,
        fields: [
          "personalDetails",
          "education",
          "category",
          "documents"
        ], // More fields access
        requiresApproval: false, // No approval needed
        auditLog: true
      },
      approve: true, // Can approve/reject applications
      reject: true
    }
  }
}
```

**Activity Audit Log** (All Profile Updates Tracked):

```javascript
{
  activityId: "ACT-2026-001234",
  employeeId: ObjectId("support_executive_id"),
  employeeName: "Rajesh Kumar",
  employeeRole: "support_executive",

  module: "applications",
  action: "update_profile",

  targetType: "application",
  targetId: ObjectId("application_id"),
  registrationNumber: "BPOL2600001234",

  changes: [
    {
      field: "mobile",
      oldValue: "+919876543210",
      newValue: "+919876543211",
      reason: "Applicant requested mobile number change via phone call"
    }
  ],

  supportTicketId: ObjectId("ticket_id"), // Linked to support ticket
  approvalRequired: true,
  approvedBy: ObjectId("manager_id"),
  approvedAt: "2026-08-12T16:00:00Z",

  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  timestamp: "2026-08-12T15:30:00Z"
}
```

**Email Integration** (Auto-Ticket Creation):

```
1. User sends email to support@recruitment.gov.in
   â””â”€â”€ Email Gateway (AWS SES / SendGrid Inbound Parse)
        â””â”€â”€ Parse Email
             â”œâ”€â”€ Extract: From Email, Subject, Body, Attachments
             â”œâ”€â”€ Check: Registration Number mentioned in body
             â”œâ”€â”€ Lookup: Applicant record (if registration number found)
             â””â”€â”€ Create Support Ticket
                  â”œâ”€â”€ Auto-assign based on category keywords
                  â”œâ”€â”€ Send Auto-Reply: "Ticket created: TKT-2026-001234"
                  â””â”€â”€ Notify assigned Support Executive
```

**WhatsApp Business Integration**:

```
User: "I cannot download my admit card"
Bot: "Please provide your Registration Number"
User: "BPOL2600001234"
Bot: [Fetches application status]
     "Your admit card is available. Download link: https://..."
     OR
     "Your admit card will be available on 01-Oct-2026"
     OR
     "Issue detected. Creating support ticket... TKT-2026-001234"
     "A support executive will contact you within 4 hours"
```

**Phone Call Management**:

```
Support Executive receives call
  â”‚
  â”œâ”€â”€ Opens Dashboard â†’ Create Ticket (Manual)
  â”œâ”€â”€ Asks for Registration Number
  â”œâ”€â”€ Searches Applicant in System
  â”œâ”€â”€ Views Application Status on Screen
  â”œâ”€â”€ Resolves Query Over Phone
  â”œâ”€â”€ Updates Ticket with Call Notes
  â”œâ”€â”€ Marks as Resolved
  â””â”€â”€ System auto-sends SMS confirmation
```

**Bulk Communication** (Admin/Support Manager):

```
Admin Dashboard â†’ Communication Center
                    â”‚
                    â”œâ”€â”€ Select Recipients
                    â”‚    â”œâ”€â”€ All applicants of Project X
                    â”‚    â”œâ”€â”€ Applicants with status "pending_document"
                    â”‚    â”œâ”€â”€ Custom filter (category, exam center, etc.)
                    â”‚    â””â”€â”€ Upload CSV (Registration Numbers)
                    â”‚
                    â”œâ”€â”€ Compose Message
                    â”‚    â”œâ”€â”€ Email Template
                    â”‚    â”œâ”€â”€ SMS Template (160 chars)
                    â”‚    â””â”€â”€ WhatsApp Template (pre-approved)
                    â”‚
                    â”œâ”€â”€ Preview & Test Send
                    â”‚
                    â”œâ”€â”€ Schedule Send (Optional)
                    â”‚    â”œâ”€â”€ Immediate
                    â”‚    â””â”€â”€ Scheduled Date/Time
                    â”‚
                    â””â”€â”€ Send
                         â”œâ”€â”€ Queue in RabbitMQ
                         â”œâ”€â”€ Process in Background (Rate-limited)
                         â””â”€â”€ Track Delivery Status
                              â”œâ”€â”€ Sent: 98,500
                              â”œâ”€â”€ Delivered: 97,200
                              â”œâ”€â”€ Failed: 1,300
                              â””â”€â”€ Generate Report
```

---

## ï¿½ API Endpoint Reference (Complete List)

### **Public APIs** (No Authentication Required)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   PUBLIC ENDPOINTS                          â”‚
â”‚              (No JWT Token Required)                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### **1. Landing Page & Project Info**

```http
GET /api/public/projects/:projectSlug
Description: Get public project details for landing page
Example: GET /api/public/projects/bihar-police-constable-2026
Response: {
  projectName: "Bihar Police Constable 2026",
  description: "...",
  department: "Bihar Police",
  startDate: "2026-08-10",
  endDate: "2027-01-31",
  jobs: [
    {
      jobId: "...",
      title: "Constable (Male) - General",
      totalPosts: 2500,
      applicationFee: 800,
      ageLimit: "18-25 years",
      education: "10th/12th"
    },
    ...
  ],
  notificationPdf: "cloudinary_url",
  importantDates: {...}
}
```

---

#### **2. Application Submission** (Multi-Step Form)

```http
POST /api/public/apply/:projectSlug
Description: Submit application form (NO LOGIN REQUIRED)
Content-Type: application/json

Body: {
  // Step 1: Post Selection
  selectedPosts: [
    { jobId: "JOB-001", postTitle: "Constable (Male)", fee: 800 },
    { jobId: "JOB-002", postTitle: "Sub-Inspector", fee: 1200 }
  ],
  paymentTiming: "step1", // "step1" or "last_step"
  totalFee: 2000,

  // Step 2: Personal Details
  personalDetails: {
    fullName: "Piyush Kumar",
    fatherName: "Ram Kumar",
    motherName: "Sita Devi",
    dateOfBirth: "2000-01-15",
    gender: "Male",
    category: "General",
    maritalStatus: "Single",
    religion: "Hindu",
    identificationMark: "Mole on left cheek",
    domicileOfBihar: true
  },

  // Contact (for OTP verification)
  email: "piyush@example.com",
  mobile: "+919876543210",
  emailOtp: "123456", // Verified OTP
  mobileOtp: "654321", // Verified OTP

  // Step 3: Education
  education: {
    tenth: {
      board: "CBSE",
      school: "DAV Public School",
      rollNumber: "1234567",
      yearOfPassing: 2016,
      percentage: 75.5,
      marksObtained: 378,
      totalMarks: 500
    },
    twelfth: {
      board: "CBSE",
      school: "DAV Public School",
      rollNumber: "7654321",
      yearOfPassing: 2018,
      percentage: 78.2,
      stream: "Science"
    },
    graduation: {
      degree: "B.Sc. (Computer Science)",
      university: "Patna University",
      yearOfPassing: 2021,
      percentage: 72.5
    }
  },

  // Step 4: Additional Info
  additionalInfo: {
    isGovernmentEmployee: false,
    isExServiceman: false,
    isPWD: false,
    drivingLicenseNumber: "BR01-20200001234",
    hasComputerCertificate: true
  },

  // Step 5: Address
  permanentAddress: {
    addressLine1: "123, Gandhi Nagar",
    addressLine2: "Near Railway Station",
    state: "Bihar",
    district: "Patna",
    policeStation: "Patna Sadar",
    pincode: "800001"
  },
  correspondenceAddress: {
    sameAsPermanent: true
  },

  // Step 6: Documents (File Upload IDs from separate upload API)
  documents: {
    profilePhotoId: "cloudinary_public_id_1",
    signatureId: "cloudinary_public_id_2",
    aadharCardId: "cloudinary_public_id_3",
    tenthCertificateId: "cloudinary_public_id_4",
    twelfthCertificateId: "cloudinary_public_id_5",
    graduationCertificateId: "cloudinary_public_id_6",
    casteCertificateId: "cloudinary_public_id_7", // if applicable
    domicileCertificateId: "cloudinary_public_id_8"
  },

  // Step 7: Biometric Data
  biometricData: {
    fingerprintsEncrypted: "base64_encrypted_data",
    facePhotoHash: "sha256_hash"
  },

  // Step 8: Declaration
  declaration: {
    accepted: true,
    acceptedAt: "2026-08-10T11:00:00Z",
    ipAddress: "192.168.1.100"
  }
}

Response (Success): {
  success: true,
  message: "Application submitted successfully",
  data: {
    applicationId: "APP-BP-2026-001234",
    registrationNumber: "BPOL2600001234", // PRIMARY ID
    applicantName: "Piyush Kumar",
    selectedPosts: [...],
    totalFee: 2000,
    paymentRequired: true,
    paymentOrderId: "order_Razorpay_123456", // If Step 1 payment
    nextStep: "payment" // or "completed" if last step payment
  }
}

Response (Validation Error): {
  success: false,
  error: "Validation failed",
  details: [
    { field: "email", message: "Invalid email format" },
    { field: "mobile", message: "Mobile OTP not verified" }
  ]
}
```

---

#### **3. Document Upload** (Before Application Submission)

```http
POST /api/public/upload-document
Description: Upload individual document (photo, signature, certificates)
Content-Type: multipart/form-data

Body (FormData): {
  file: <binary file>,
  documentType: "profile_photo", // or "signature", "aadhar_card", etc.
  tempSessionId: "SESSION-123456" // Temporary session tracking
}

Response: {
  success: true,
  data: {
    publicId: "cloudinary_public_id",
    url: "https://res.cloudinary.com/.../file.jpg",
    format: "jpg",
    size: 95000,
    uploadedAt: "2026-08-10T10:30:00Z"
  }
}

Rate Limit: 10 uploads per 5 minutes per IP
```

---

#### **4. OTP Generation & Verification**

```http
POST /api/public/send-otp
Description: Send OTP to email or mobile for verification
Body: {
  type: "email", // or "mobile"
  value: "piyush@example.com" // or "+919876543210"
}
Response: {
  success: true,
  message: "OTP sent successfully",
  expiresIn: 300 // seconds
}
Rate Limit: 3 requests per 15 minutes per email/mobile

---

POST /api/public/verify-otp
Description: Verify OTP before application submission
Body: {
  type: "email", // or "mobile"
  value: "piyush@example.com",
  otp: "123456"
}
Response: {
  success: true,
  message: "OTP verified successfully",
  verificationToken: "temp_token_for_application"
}
```

---

#### **5. Application Status Check** (NO LOGIN)

```http
POST /api/public/check-status
Description: Check application status using Registration Number
Body: {
  registrationNumber: "BPOL2600001234",
  mobile: "+919876543210",
  dateOfBirth: "2000-01-15",
  otp: "123456" // OTP sent to mobile
}
Response: {
  success: true,
  data: {
    registrationNumber: "BPOL2600001234",
    applicantName: "Piyush Kumar",
    applicationStatus: "submitted", // submitted, under_review, approved, rejected
    paymentStatus: "completed",
    selectedPosts: [...],
    appliedOn: "2026-08-10T11:00:00Z",
    lastUpdated: "2026-08-10T11:05:00Z",
    admitCardAvailable: false,
    examDate: "2026-10-15"
  }
}
```

---

#### **6. Download Application PDF** (NO LOGIN)

```http
POST /api/public/download-application
Description: Download submitted application PDF
Body: {
  registrationNumber: "BPOL2600001234",
  mobile: "+919876543210",
  dateOfBirth: "2000-01-15",
  otp: "123456"
}
Response: {
  success: true,
  pdfUrl: "https://cloudinary.com/.../application_BPOL2600001234.pdf",
  expiresIn: 3600 // Signed URL expires in 1 hour
}
```

---

#### **7. Admit Card Download** (NO LOGIN) â­

```http
POST /api/public/download-admit-card
Description: Download admit card using Registration Number + OTP
Body: {
  registrationNumber: "BPOL2600001234",
  mobile: "+919876543210",
  dateOfBirth: "2000-01-15",
  otp: "123456" // OTP sent to mobile
}
Response (Success): {
  success: true,
  data: {
    admitCardPdfUrl: "https://cloudinary.com/.../admit_card_BPOL2600001234.pdf",
    rollNumber: "BPOL26001234",
    candidateName: "Piyush Kumar",
    examDate: "2026-10-15",
    examTime: "10:00 AM - 12:00 PM",
    reportingTime: "09:00 AM",
    examCenter: {
      name: "Bihar Police Academy, Patna",
      address: "Gandhi Maidan, Patna - 800001"
    },
    importantInstructions: [...]
  }
}

Response (Not Available Yet): {
  success: false,
  error: "Admit card not yet released",
  releaseDate: "2026-10-01"
}

Rate Limit: 30 requests per 10 minutes per IP
```

---

#### **8. Correction Request** (NO LOGIN)

```http
POST /api/public/request-correction
Description: Request correction during correction window
Body: {
  registrationNumber: "BPOL2600001234",
  mobile: "+919876543210",
  otp: "123456",

  corrections: [
    {
      field: "fatherName",
      oldValue: "Ram Kumar",
      newValue: "Ram Prakash Kumar",
      reason: "Name mismatch with 10th certificate",
      supportingDocumentId: "cloudinary_public_id"
    }
  ]
}
Response: {
  success: true,
  message: "Correction request submitted",
  ticketId: "CORR-2026-001234",
  estimatedResolutionTime: "48 hours"
}

Response (Window Closed): {
  success: false,
  error: "Correction window closed",
  correctionWindowDates: {
    startDate: "2026-09-11",
    endDate: "2026-09-15"
  }
}
```

---

#### **9. Submit Enquiry / Support Ticket** (NO LOGIN)

```http
POST /api/public/submit-enquiry
Description: Submit support ticket without login
Body: {
  registrationNumber: "BPOL2600001234", // Optional
  name: "Piyush Kumar",
  email: "piyush@example.com",
  mobile: "+919876543210",
  category: "admit_card", // payment_issue, application_correction, technical_issue, general
  subject: "Unable to download admit card",
  description: "I am receiving error 'Registration number not found'",
  attachments: ["cloudinary_url"] // Optional
}
Response: {
  success: true,
  ticketId: "TKT-2026-001234",
  message: "Support ticket created successfully",
  estimatedResponseTime: "4 hours"
}
```

---

#### **10. Payment Integration** (Razorpay/Cashfree)

```http
POST /api/public/create-payment-order
Description: Create payment order for Razorpay
Body: {
  applicationId: "APP-BP-2026-001234",
  amount: 2000, // in rupees
  currency: "INR"
}
Response: {
  success: true,
  orderId: "order_Razorpay_123456",
  amount: 200000, // in paisa
  currency: "INR",
  razorpayKeyId: "rzp_live_xxxxx"
}

---

POST /api/public/verify-payment
Description: Verify payment after Razorpay success
Body: {
  applicationId: "APP-BP-2026-001234",
  orderId: "order_Razorpay_123456",
  paymentId: "pay_Razorpay_789012",
  signature: "razorpay_signature_hash"
}
Response: {
  success: true,
  message: "Payment verified successfully",
  registrationNumber: "BPOL2600001234",
  paymentReceipt: "cloudinary_url_receipt_pdf"
}
```

---

### **Admin APIs** (JWT Authentication Required)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     ADMIN ENDPOINTS                         â”‚
â”‚         (Requires JWT Token + Admin/Staff Role)             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### **1. Project Management**

```http
POST /api/admin/projects
Description: Create new recruitment project
Headers: { Authorization: "Bearer <jwt_token>" }
Body: {
  name: "Bihar Police Constable 2026",
  description: "...",
  department: "Bihar Police",
  state: "Bihar",
  startDate: "2026-08-10",
  endDate: "2027-01-31"
}
Response: {
  success: true,
  data: {
    projectId: "PROJECT-001",
    publicLandingPageSlug: "bihar-police-constable-2026",
    publicUrl: "https://recruitment.gov.in/apply/bihar-police-constable-2026"
  }
}

---

GET /api/admin/projects
Description: Get all projects (with filters)
Query: ?status=Active&department=Bihar Police

---

PUT /api/admin/projects/:projectId
Description: Update project details

---

DELETE /api/admin/projects/:projectId
Description: Delete project (only if no applications exist)
```

---

#### **2. Job Management**

```http
POST /api/admin/projects/:projectId/jobs
Description: Add job/post under project
Body: {
  postCode: "BP-CONST-001",
  title: "Constable (Male) - General",
  totalPosts: 2500,
  reservedPosts: {
    general: 1000,
    obc: 800,
    sc: 400,
    st: 200,
    ews: 100
  },
  applicationFee: {
    general: 800,
    obc: 800,
    sc: 400,
    st: 400,
    pwd: 400
  },
  salaryRange: "â‚¹25,000 - â‚¹30,000",
  ageLimit: {
    min: 18,
    max: 25,
    relaxation: {
      obc: 3, // years
      sc: 5,
      st: 5
    }
  },
  education: "10th/12th",
  importantDates: {
    applicationStart: "2026-08-10",
    applicationEnd: "2026-09-10",
    correctionStart: "2026-09-11",
    correctionEnd: "2026-09-15",
    admitCardRelease: "2026-10-01",
    examDate: "2026-10-15",
    resultDate: "2026-11-30"
  }
}

---

GET /api/admin/projects/:projectId/jobs
Description: Get all jobs under project

---

PUT /api/admin/jobs/:jobId
Description: Update job details

---

DELETE /api/admin/jobs/:jobId
Description: Delete job (only if no applications)
```

---

#### **3. Application Management**

```http
GET /api/admin/applications
Description: Get all applications (with filters & pagination)
Query:
  ?projectId=PROJECT-001
  &status=submitted
  &category=General
  &page=1
  &limit=100
  &search=BPOL2600001234 (registration number or name)

---

GET /api/admin/applications/:registrationNumber
Description: Get full application details

---

PUT /api/admin/applications/:registrationNumber
Description: Update application (requires permission)
Body: {
  updates: {
    mobile: "+919876543211",
    email: "newemail@example.com"
  },
  reason: "Applicant requested via support ticket TKT-2026-001234"
}

---

POST /api/admin/applications/:registrationNumber/approve
Description: Approve application after document verification

---

POST /api/admin/applications/:registrationNumber/reject
Description: Reject application with reason
Body: {
  reason: "Invalid documents",
  notifyApplicant: true
}

---

GET /api/admin/applications/export
Description: Bulk export applications as CSV/Excel
Query: ?projectId=PROJECT-001&format=csv
Response: CSV file download
```

---

#### **4. Admit Card Management**

```http
POST /api/admin/admit-cards/generate
Description: Bulk generate admit cards
Body: {
  projectId: "PROJECT-001",
  examScheduleId: "EXAM-001",
  filterCriteria: {
    status: "approved",
    paymentStatus: "completed"
  }
}
Response: {
  success: true,
  message: "Admit card generation started",
  jobId: "JOB-QUEUE-001234",
  estimatedTime: "30 minutes",
  totalApplicants: 50000
}

---

GET /api/admin/admit-cards
Description: Get all admit cards with filters
Query: ?projectId=PROJECT-001&status=active

---

POST /api/admin/admit-cards/:registrationNumber/regenerate
Description: Regenerate admit card for single applicant
Reason: Correction approved, exam center changed, etc.

---

DELETE /api/admin/admit-cards/:registrationNumber
Description: Cancel admit card (if applicant disqualified)
```

---

#### **5. Support Ticket Management**

```http
GET /api/admin/support-tickets
Description: Get all support tickets (with filters)
Query:
  ?status=open
  &assignedTo=EMPLOYEE-001
  &category=admit_card
  &source=email
  &priority=high

---

GET /api/admin/support-tickets/:ticketId
Description: Get ticket details with full conversation thread

---

PUT /api/admin/support-tickets/:ticketId/assign
Description: Assign ticket to support executive
Body: {
  assignedTo: "EMPLOYEE-002"
}

---

POST /api/admin/support-tickets/:ticketId/reply
Description: Add reply to ticket (sends email/SMS/WhatsApp to applicant)
Body: {
  message: "Your admit card has been regenerated",
  channel: "email", // email, whatsapp, sms
  internalNote: false // true if only visible to staff
}

---

PUT /api/admin/support-tickets/:ticketId/resolve
Description: Mark ticket as resolved
Body: {
  resolution: "Admit card regenerated and sent",
  resolutionCategory: "admit_card_regenerated"
}

---

PUT /api/admin/support-tickets/:ticketId/close
Description: Close resolved ticket
```

---

#### **6. Staff & Employee Management**

```http
POST /api/admin/employees
Description: Create new admin/staff user
Body: {
  name: "Rajesh Kumar",
  email: "rajesh@recruitment.gov.in",
  mobile: "+919876543210",
  role: "support_executive", // super_admin, project_manager, verification_officer, support_executive, finance_manager
  department: "Support",
  permissions: {...}
}

---

GET /api/admin/employees
Description: Get all employees

---

PUT /api/admin/employees/:employeeId
Description: Update employee details

---

DELETE /api/admin/employees/:employeeId
Description: Deactivate employee account
```

---

#### **7. Analytics & Reports**

```http
GET /api/admin/analytics/dashboard
Description: Get dashboard statistics
Response: {
  totalProjects: 5,
  activeProjects: 2,
  totalApplications: 250000,
  applicationsToday: 5000,
  totalRevenue: 50000000, // in rupees
  revenueToday: 1000000,
  pendingVerifications: 1500,
  openSupportTickets: 234,
  admitCardsGenerated: 200000
}

---

GET /api/admin/reports/applications
Description: Generate application report with filters
Query:
  ?projectId=PROJECT-001
  &startDate=2026-08-01
  &endDate=2026-08-31
  &groupBy=category
Response: Excel/CSV file or JSON data

---

GET /api/admin/reports/payments
Description: Payment reconciliation report
Query: ?projectId=PROJECT-001&paymentStatus=completed

---

GET /api/admin/reports/support-tickets
Description: Support ticket analytics
Response: {
  totalTickets: 5000,
  resolvedTickets: 4500,
  averageResolutionTime: "4 hours",
  ticketsByCategory: {...},
  ticketsBySource: {...}
}
```

---

#### **8. Exam Center Management**

```http
POST /api/admin/exam-centers
Description: Create exam center
Body: {
  centerCode: "CENTER-001",
  name: "Bihar Police Academy, Patna",
  address: "Gandhi Maidan, Patna - 800001",
  capacity: 500,
  facilities: ["AC", "CCTV", "Biometric"]
}

---

POST /api/admin/exam-centers/allocate-candidates
Description: Allocate candidates to exam centers
Body: {
  examScheduleId: "EXAM-001",
  allocationStrategy: "geo_based", // nearest center
  projectId: "PROJECT-001"
}
Response: {
  success: true,
  allocated: 50000,
  centersUsed: 100
}
```

---

## ï¿½ðŸ”’ Security & Scalability (Production-Ready)

### **1. Load Balancing**

```
Users (Lakhs) â†’ Nginx Load Balancer â†’ Multiple API Gateway Instances
                                        â”œâ”€â”€ Instance 1 (PM2 Cluster)
                                        â”œâ”€â”€ Instance 2 (PM2 Cluster)
                                        â””â”€â”€ Instance 3 (PM2 Cluster)
```

### **2. Database Optimization**

```
MongoDB Replica Set (3 nodes)
  â”œâ”€â”€ Primary (Write)
  â”œâ”€â”€ Secondary 1 (Read Replica)
  â””â”€â”€ Secondary 2 (Read Replica)

Indexes:
  - User.email, User.mobile (unique)
  - Application.registrationNumber (unique)
  - Application.candidateId, Application.jobId (compound)
  - Payment.transactionId (unique)
  - AdmitCard.rollNumber, AdmitCard.registrationNumber (unique)
```

### **3. Caching Strategy**

```
Redis Cache:
  - Session Management (JWT tokens)
  - Rate Limiting (IP-based)
  - Job Listings (cache for 5 minutes)
  - Landing Page Data (cache for 1 hour)
  - OTP Storage (5-minute expiry)
```

### **4. Queue Management**

```
RabbitMQ Queues:
  - email_queue (Email notifications)
  - sms_queue (SMS notifications)
  - whatsapp_queue (WhatsApp messages)
  - admit_card_generation_queue (Bulk generation)
  - payment_verification_queue (Webhook processing)
  - document_verification_queue (OCR/manual review)
```

### **5. Rate Limiting**

```javascript
// Already in system
{
  apiLimiter: 100 requests / 15 minutes,
  authLimiter: 5 login attempts / 15 minutes,
  otpLimiter: 3 OTP requests / 15 minutes,
  publicAdmitCardLimiter: 30 requests / 10 minutes
}
```

### **6. File Upload Security**

```
- File type validation (whitelist: JPEG, PNG, PDF)
- File size limits (Photo: 100KB, Signature: 50KB, Docs: 500KB)
- Virus scanning (ClamAV integration)
- Cloudinary transformations (auto-optimize, format conversion)
- CDN delivery (CloudFront/Cloudinary CDN)
```

### **7. Payment Security**

```
- PCI DSS Compliant gateway (Razorpay)
- Webhook signature verification
- Idempotency keys for retries
- Transaction logging
- Refund workflow with approval
```

### **8. Audit Trail**

```javascript
// Already in system: ActivityLog model
{
  employeeId: ObjectId("staff_id"),
  module: "Applications / Payments / AdmitCards / Support",
  action: "create / view / edit / delete / download",
  details: "Updated registration number BPOL2600001234",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  timestamp: "2026-08-10T10:30:00Z"
}
```

---

## ðŸ“Š Real-World Production Benchmarks

### Similar Government Portals:

1. **UPSC** (upsc.gov.in) - 10 lakh+ candidates/year
2. **SSC** (ssc.nic.in) - 50 lakh+ candidates/year
3. **Railway RRB** (rrbcdg.gov.in) - 1 crore+ candidates/year
4. **Bihar STET** (bsebstet.com) - 5 lakh+ candidates

### Expected Load:

```
- Concurrent Users: 50,000 - 100,000 (peak hours)
- Daily Applications: 10,000 - 50,000
- Total Applications per Project: 5-10 lakhs
- Document Storage: 10-50 TB per project
- Payment Transactions: 5-10 lakhs per project
```

### Infrastructure Requirements:

```
- Application Servers: 5-10 instances (auto-scaling)
- Database: MongoDB Atlas M50+ (Dedicated cluster)
- Redis: 8GB+ memory
- CDN: CloudFront (global distribution)
- File Storage: Cloudinary Pro / AWS S3 (unlimited)
- Queue Workers: 10-20 instances (RabbitMQ)
```

---

## ðŸš€ Implementation Roadmap

### **Phase 1: Core Features** (Already Done âœ…)

- âœ… Microservices architecture
- âœ… User authentication & authorization
- âœ… Project & Job management
- âœ… Multi-step application form
- âœ… Payment integration (Razorpay)
- âœ… Document upload (Cloudinary)
- âœ… Email & SMS notifications
- âœ… Admit card generation
- âœ… Support ticket system
- âœ… Admin dashboard

### **Phase 2: New Requirements** (To Implement ðŸ”¨)

1. **Dual Payment Option**
   - Step 1 payment (immediate lock)
   - Last step payment (24-hour reservation)

2. **Public Landing Pages**
   - Project-specific URLs
   - SEO optimization
   - Job listing with filters

3. **Public Admit Card Download**
   - Registration Number + Mobile + DOB + OTP
   - No login required
   - Rate limiting

4. **Biometric Data Storage**
   - Fingerprint upload
   - Face recognition hash
   - Encrypted storage
   - Link to registration number

5. **Enhanced Staff Management**
   - Support Executive dashboard
   - Profile update permissions
   - Enquiry management (email, phone, WhatsApp)
   - Activity audit trail

6. **File Organization System**
   - Cloudinary folder structure
   - Registration Number based folders
   - Document versioning
   - Bulk download API

7. **Center & Seat Allotment**
   - Geo-based allocation
   - Capacity management
   - Seat number generation
   - QR code scanning

### **Phase 3: Production Hardening** (To Implement ðŸ”’)

- Load testing (Apache JMeter, k6)
- Horizontal scaling (PM2 cluster mode)
- Database sharding (if needed)
- CDN optimization
- DDoS protection (Cloudflare)
- Monitoring & Alerts (Prometheus, Grafana)
- Backup & Disaster Recovery

---

## ðŸ“ Summary of Changes Needed (Complete Implementation Checklist)

### **Backend Changes:**

#### **Phase 1: Public Application Flow (NO LOGIN)**

- [ ] **1.1** Modify Application model to support "ghost" user accounts
  - Add `accountType: "ghost"` field to User model
  - Add `registrationNumber` as PRIMARY identifier
  - Remove mandatory password requirement for applicants
  - Add `createdVia: "public_application"` tracking

- [ ] **1.2** Create Public Application API (`/api/public/apply/:projectSlug`)
  - Accept full application data in single request
  - Auto-create user record in background (no login credentials)
  - Generate registration number AFTER payment success
  - Send registration number via Email/SMS/WhatsApp

- [ ] **1.3** Implement Payment Timing Options
  - Add `paymentTiming` field: "step1" | "last_step"
  - Step 1 payment: Lock posts immediately
  - Last step payment: 24-hour reservation logic
  - Auto-cancel unpaid applications after 24 hours

- [ ] **1.4** Public Landing Page API (`/api/public/projects/:projectSlug`)
  - Return project details, jobs, important dates
  - No authentication required
  - Cache response for performance (Redis, 5 minutes)

#### **Phase 2: Public Services (OTP-Based Verification)**

- [ ] **2.1** Public Admit Card Download API (NO LOGIN)
  - Endpoint: `/api/public/download-admit-card`
  - Verify: Registration Number + Mobile + DOB + OTP
  - Rate limit: 30 requests per 10 minutes per IP
  - Return signed Cloudinary URL (expires in 1 hour)

- [ ] **2.2** Public Application Status Check API
  - Endpoint: `/api/public/check-status`
  - Verify with OTP before showing status
  - Return application status, payment status, exam details

- [ ] **2.3** Public Correction Request API
  - Endpoint: `/api/public/request-correction`
  - Check correction window dates
  - Create support ticket automatically
  - Link to Application model

- [ ] **2.4** OTP Service Enhancement
  - Implement OTP generation for Email & Mobile
  - 5-minute expiry, 3 retry limit
  - Store in Redis for fast validation
  - Rate limiting: 3 OTP requests per 15 minutes

#### **Phase 3: Biometric Data Storage**

- [ ] **3.1** Add biometric fields to Application model

  ```javascript
  biometricData: {
    fingerprintsEncrypted: String, // Base64 encrypted
    facePhotoHash: String, // SHA-256 hash
    encryptionAlgorithm: "AES-256-GCM",
    encryptionKeyId: String
  }
  ```

- [ ] **3.2** Implement encryption service
  - Use AES-256-GCM encryption
  - Store encryption keys in AWS KMS or HashiCorp Vault
  - Never store unencrypted biometric data

- [ ] **3.3** Biometric upload API
  - Validate file format and size
  - Encrypt before storing
  - Link to registration number

#### **Phase 4: Enhanced Support & Enquiry Management**

- [ ] **4.1** Multi-Channel Support Ticket System
  - Add `source` field: "email" | "phone" | "whatsapp" | "web"
  - Add `sourceMetadata` for tracking
  - Add `messages` array for conversation thread
  - Add SLA tracking fields

- [ ] **4.2** Email Integration (Auto-Ticket Creation)
  - Setup inbound email parsing (AWS SES / SendGrid)
  - Extract registration number from email body
  - Auto-create ticket
  - Send auto-reply with ticket ID

- [ ] **4.3** WhatsApp Business API Integration
  - Setup WhatsApp Business account
  - Implement chatbot for basic queries
  - Escalate complex queries to human agent
  - Link conversations to support tickets

- [ ] **4.4** Phone Call Management
  - Staff dashboard for creating tickets manually
  - Add call notes to ticket thread
  - Track call duration and timestamp

- [ ] **4.5** Support Executive Dashboard Enhancements
  - Multi-channel queue view
  - SLA alerts
  - Quick actions (regenerate admit card, update profile)
  - Applicant lookup with full profile view

- [ ] **4.6** Profile Update Permissions (RBAC)
  - Define editable fields per role
  - Require manager approval for sensitive fields
  - Log all changes in Activity Log model
  - Link updates to support ticket

#### **Phase 5: File Storage & Organization (10 Lakh+ Scale)**

- [ ] **5.1** Implement batching strategy
  - Create `getBatchNumber()` utility function
  - Batch size: 10,000 applicants per batch
  - Folder structure: `/batch-X/REGISTRATION_NUMBER/`

- [ ] **5.2** Update File Upload Service
  - Generate folder path based on registration number
  - Auto-create batch folders
  - Store file metadata in Application model
  - Implement file versioning (for corrections)

- [ ] **5.3** Bulk Export & Download APIs
  - Download all files for single applicant (ZIP)
  - Bulk export for multiple applicants (Admin)
  - Generate signed URLs for secure downloads

- [ ] **5.4** Database File Reference Model Enhancement

  ```javascript
  fileStorage: {
    provider: "cloudinary",
    batchNumber: "batch-1",
    basePath: "...",
    files: {
      profilePhoto: { url, publicId, format, size, uploadedAt, checksum },
      ...
    },
    totalStorageUsed: 3500000
  }
  ```

- [ ] **5.5** Implement Storage Monitoring
  - Track total storage per project
  - Alert when reaching quota
  - Auto-cleanup for rejected/cancelled applications (after retention period)

#### **Phase 6: Correction Window Implementation**

- [ ] **6.1** Add correction tracking to Application model

  ```javascript
  correctionWindow: {
    startDate, endDate, isActive
  },
  corrections: [
    {
      requestId, requestedAt, requestedFields,
      status, reviewedBy, reviewedAt, supportTicketId
    }
  ]
  ```

- [ ] **6.2** Correction Request Workflow
  - Public API to submit correction
  - Auto-create support ticket
  - Assign to Verification Officer
  - Approval/Rejection workflow
  - Notify applicant via Email/SMS/WhatsApp

- [ ] **6.3** Correction Review Dashboard (Admin)
  - View all pending correction requests
  - Side-by-side comparison (old vs new values)
  - Document preview
  - Approve/Reject actions

#### **Phase 7: Admit Card Generation & Distribution**

- [ ] **7.1** Bulk Admit Card Generation
  - Background job (RabbitMQ queue)
  - Filter: status=approved, paymentStatus=completed
  - Allocate exam centers
  - Generate roll numbers
  - Generate PDF with QR code & barcode
  - Store in Cloudinary (batched folders)

- [ ] **7.2** Exam Center Allocation Algorithm
  - Geo-based allocation (nearest center)
  - Capacity management (max per center)
  - Generate seat numbers
  - Update admit card with center details

- [ ] **7.3** Public Admit Card Download (Already covered in Phase 2)

- [ ] **7.4** Admit Card Regeneration (Support Team)
  - API for single admit card regeneration
  - Reasons: correction approved, center changed
  - Track regeneration count
  - Notify applicant

#### **Phase 8: Scalability & Performance**

- [ ] **8.1** Load Balancing Setup
  - Nginx load balancer configuration
  - Distribute traffic across multiple API Gateway instances
  - Health check endpoints

- [ ] **8.2** PM2 Cluster Mode
  - Run API Gateway in cluster mode (4+ workers)
  - Auto-restart on crashes
  - Zero-downtime deployments

- [ ] **8.3** Database Optimization
  - Create indexes on frequently queried fields
    - `User.registrationNumber` (unique)
    - `Application.registrationNumber` (unique)
    - `Application.status`, `Application.projectId`
    - `Payment.transactionId` (unique)
  - Setup MongoDB Replica Set (3 nodes)
  - Enable read preference for queries (use secondaries)

- [ ] **8.4** Redis Caching Strategy
  - Cache project details (5 minutes)
  - Cache job listings (5 minutes)
  - Store OTPs (5-minute expiry)
  - Session management
  - Rate limiting counters

- [ ] **8.5** RabbitMQ Queue Setup
  - `email_queue` - Email notifications
  - `sms_queue` - SMS notifications
  - `whatsapp_queue` - WhatsApp messages
  - `admit_card_generation_queue` - Bulk generation
  - `payment_verification_queue` - Webhook processing
  - Setup dead letter queues for failed jobs

- [ ] **8.6** CDN & File Optimization
  - Cloudinary auto-optimization (quality: auto, format: auto)
  - Enable CDN delivery
  - Lazy loading for images
  - Compress PDFs before upload

- [ ] **8.7** Rate Limiting (Already in system - verify limits)
  - Public API: 100 requests / 15 minutes
  - OTP: 3 requests / 15 minutes
  - Admit card download: 30 requests / 10 minutes
  - Admin API: Higher limits for authenticated users

#### **Phase 9: Security Enhancements**

- [ ] **9.1** Input Validation & Sanitization
  - Validate all user inputs (email, mobile, registration number)
  - Sanitize text fields (prevent XSS)
  - File type whitelisting (JPEG, PNG, PDF only)
  - File size limits (Photo: 100KB, Docs: 500KB)

- [ ] **9.2** Payment Security
  - Verify Razorpay webhook signatures
  - Use idempotency keys for retries
  - Log all payment transactions
  - Implement refund workflow with approval

- [ ] **9.3** Audit Trail (Already exists - ensure completeness)
  - Log all profile updates
  - Log all admit card downloads
  - Log all support ticket actions
  - Store IP address and user agent

- [ ] **9.4** DDoS Protection
  - Cloudflare integration
  - IP-based rate limiting
  - CAPTCHA for public forms (optional)

---

### **Frontend Changes:**

#### **Phase 1: Public Landing Page**

- [ ] **1.1** Project Landing Page Component
  - Display project details, jobs, important dates
  - Job listing with filters (category, fee, posts)
  - Download notification PDF
  - "Apply Now" button â†’ Direct to application form

- [ ] **1.2** SEO Optimization
  - Dynamic meta tags per project
  - Sitemap generation
  - Schema.org markup for government recruitment

#### **Phase 2: Public Application Form (NO LOGIN)**

- [ ] **2.1** Multi-Step Form Component (9 Steps)
  - Step 1: Post Selection (multi-select with fee calculation)
  - Step 2: Payment Timing Option (Step 1 vs Last Step)
  - Step 3: Personal Details
  - Step 4: Contact (Email + Mobile OTP verification)
  - Step 5: Education Qualifications
  - Step 6: Additional Information
  - Step 7: Address Details
  - Step 8: Document Upload (with preview)
  - Step 9: Biometric Data Upload (optional integration)
  - Step 10: Review & Declaration

- [ ] **2.2** Payment Integration (Razorpay)
  - Show payment modal at Step 1 or Last Step
  - Handle payment success/failure
  - Display registration number after success

- [ ] **2.3** Form Validation & UX
  - Real-time validation
  - Progress indicator
  - Save draft functionality (optional)
  - File upload with progress bar

#### **Phase 3: Public Services (NO LOGIN)**

- [ ] **3.1** Application Status Check Page
  - Input: Registration Number + Mobile + DOB
  - OTP verification
  - Display application status, payment status

- [ ] **3.2** Public Admit Card Download Page
  - Input: Registration Number + Mobile + DOB
  - OTP verification
  - Download admit card PDF
  - Display exam details

- [ ] **3.3** Correction Request Page
  - Check correction window dates
  - Input: Registration Number + OTP
  - Select fields to correct
  - Upload supporting documents
  - Submit correction request

- [ ] **3.4** Public Enquiry/Support Page
  - Contact form (name, email, mobile, registration number)
  - Category selection
  - File attachments
  - Submit enquiry (creates ticket)

#### **Phase 4: Admin Dashboard Enhancements**

- [ ] **4.1** Project Management UI
  - Create/Edit/Delete projects
  - View project statistics
  - Generate public landing page URL

- [ ] **4.2** Job Management UI
  - Add/Edit/Delete jobs under project
  - Bulk job creation (CSV upload)
  - View job-wise application stats

- [ ] **4.3** Application Management UI
  - List all applications with filters
  - Search by registration number / name / mobile
  - View full application details
  - Document verification interface
  - Approve/Reject actions

- [ ] **4.4** Admit Card Management UI
  - Bulk generate admit cards (background job)
  - Track generation progress
  - Regenerate admit card for single applicant
  - Download admit cards (single/bulk)

- [ ] **4.5** Support Ticket Dashboard (Enhanced)
  - Multi-channel queue view (Email, Phone, WhatsApp, Web)
  - SLA alerts (color-coded)
  - Ticket assignment
  - Conversation thread view
  - Quick actions (regenerate admit card, update profile)
  - Applicant lookup with full profile

- [ ] **4.6** Analytics & Reports UI
  - Dashboard with KPIs (applications, revenue, tickets)
  - Charts (applications over time, category-wise breakdown)
  - Export reports (Excel/CSV)

- [ ] **4.7** Exam Center Management UI
  - Create/Edit exam centers
  - View center capacity and allocations
  - Allocate candidates to centers (trigger backend job)

- [ ] **4.8** Staff Management UI
  - Create/Edit admin/staff users
  - Assign roles and permissions
  - View activity logs

#### **Phase 5: Mobile Responsiveness**

- [ ] **5.1** Optimize all public pages for mobile
  - Application form (mobile-first design)
  - Admit card download page
  - Status check page

- [ ] **5.2** Progressive Web App (PWA) Features
  - Install prompt
  - Offline support for admit card (cached)
  - Push notifications (exam reminders)

---

### **Infrastructure & DevOps:**

#### **Phase 1: Server Setup**

- [ ] **1.1** Setup Nginx Load Balancer
  - Distribute traffic to API Gateway instances
  - SSL/TLS certificate (Let's Encrypt)
  - HTTPS redirect

- [ ] **1.2** PM2 Cluster Configuration
  - Run API Gateway with 4+ workers
  - Auto-restart on crashes
  - Logging and monitoring

- [ ] **1.3** MongoDB Replica Set
  - Setup 3-node replica set
  - Configure read preference (secondary for reads)
  - Enable authentication

- [ ] **1.4** Redis Cluster
  - Setup Redis with persistence (RDB + AOF)
  - Configure max memory policy (LRU eviction)
  - Enable authentication

- [ ] **1.5** RabbitMQ Cluster
  - Setup RabbitMQ with management plugin
  - Create queues for email, SMS, WhatsApp, admit cards
  - Setup dead letter queues

#### **Phase 2: Monitoring & Alerts**

- [ ] **2.1** Setup Prometheus & Grafana
  - Monitor API response times
  - Track database queries
  - Monitor queue lengths
  - Track file storage usage

- [ ] **2.2** Setup Alerting
  - Alert on high error rates
  - Alert on queue backlog
  - Alert on database issues
  - Alert on storage quota

- [ ] **2.3** Logging (ELK Stack or CloudWatch)
  - Centralized logging
  - Log rotation
  - Error tracking

#### **Phase 3: Backup & Disaster Recovery**

- [ ] **3.1** Automated Database Backups
  - Daily MongoDB backups
  - Backup retention: 30 days
  - Test restore process

- [ ] **3.2** File Storage Backups
  - Enable Cloudinary auto-backup
  - Or setup S3 versioning + cross-region replication

- [ ] **3.3** Disaster Recovery Plan
  - Document RTO (4 hours) and RPO (24 hours)
  - Test recovery process quarterly

#### **Phase 4: Performance Testing**

- [ ] **4.1** Load Testing
  - Simulate 50,000 concurrent users (Apache JMeter / k6)
  - Test public application form submission
  - Test admit card download under load
  - Test payment gateway integration

- [ ] **4.2** Stress Testing
  - Find breaking point of system
  - Identify bottlenecks

- [ ] **4.3** Performance Optimization
  - Database query optimization (indexes, projections)
  - API response caching
  - CDN for static assets

---

### **Testing & Quality Assurance:**

- [ ] **Unit Tests** (Backend APIs)
- [ ] **Integration Tests** (API endpoints + database)
- [ ] **End-to-End Tests** (Frontend workflows)
- [ ] **Security Testing** (Penetration testing, OWASP Top 10)
- [ ] **Accessibility Testing** (WCAG 2.1 AA compliance)
- [ ] **Browser Compatibility Testing** (Chrome, Firefox, Safari, Edge)
- [ ] **Mobile Testing** (Android, iOS)

---

### **Documentation:**

- [ ] **API Documentation** (Swagger/OpenAPI)
- [ ] **Admin User Manual** (PDF/Web)
- [ ] **Applicant User Guide** (PDF/Web)
- [ ] **Staff Training Materials**
- [ ] **Deployment Guide**
- [ ] **Troubleshooting Guide**

---

## âœ… Conclusion

### Backend Changes:

1. Add `publicLandingPageSlug` to Project model
2. Add `paymentTiming` field to Application model ("step1" or "last_step")
3. Create public admit card download API (no auth)
4. Add biometric data field to Application model (encrypted)
5. Add enquiry source tracking to SupportTicket model
6. Create file organization service (Cloudinary folder management)
7. Implement seat allotment algorithm
8. Add OTP verification for admit card download

### Frontend Changes:

1. Build public landing page (project-specific)
2. Add payment option selector (Step 1 vs Last Step)
3. Public admit card download page (no login)
4. Support Executive dashboard enhancements
5. Biometric upload UI (mobile app integration)
6. Enhanced enquiry management interface

### Infrastructure:

1. Setup load balancer (Nginx)
2. Configure PM2 cluster mode
3. Setup MongoDB replica set
4. Configure Redis caching
5. Setup CDN (CloudFront)
6. Configure monitoring tools

---

## âœ… Conclusion

This architecture provides a **production-ready, scalable solution** capable of handling **lakhs of concurrent users** while maintaining:

- âœ… Security (PCI DSS, encryption, audit trails)
- âœ… Performance (caching, CDN, load balancing)
- âœ… Reliability (queue-based processing, retries)
- âœ… Compliance (government standards)
- âœ… User Experience (multi-channel support, real-time updates)

The system is modeled after real-world government recruitment portals and follows industry best practices for high-traffic applications.

---

**Next Steps**:

1. **Prioritize Features** - Review checklist with client and prioritize based on immediate needs
2. **Create Detailed Specs** - Break down each phase into detailed technical specifications
3. **Setup Staging Environment** - Create staging environment mirroring production
4. **Phased Implementation** - Implement features in phases with thorough testing
5. **User Acceptance Testing (UAT)** - Test with real users before production release
6. **Performance Testing** - Load test with expected scale (10 lakh+ users)
7. **Security Audit** - Conduct security assessment and penetration testing
8. **Production Deployment** - Deploy with zero-downtime strategy
9. **Monitoring & Support** - Setup 24/7 monitoring and support team
10. **Documentation & Training** - Complete all documentation and train staff

---

**Estimated Timeline for Full Implementation:**

- **Phase 1-2** (Public Flow + Services): 4-6 weeks
- **Phase 3-4** (Biometric + Support): 3-4 weeks
- **Phase 5-7** (File Storage + Corrections + Admit Cards): 4-5 weeks
- **Phase 8-9** (Scalability + Security): 2-3 weeks
- **Testing & UAT**: 2-3 weeks
- **Total**: **15-21 weeks** (3.5-5 months)

---

**Cost Estimation (Monthly for 10 Lakh Users):**

**Infrastructure:**

- Application Servers (5 instances): $500
- Database (MongoDB Atlas M50): $350
- Redis (8GB): $100
- Load Balancer: $50
- CDN (CloudFront): $150
- File Storage (Cloudinary + S3): $400
- Total Infrastructure: **~$1,550/month**

**Third-Party Services:**

- Razorpay (Payment Gateway): 2% transaction fee
- SMS Gateway (10 lakh messages): $500
- WhatsApp Business API: $300
- Email Service (SendGrid): $100
- Total Services: **~$900/month + transaction fees**

**Grand Total**: **~$2,500-3,000/month** (excluding transaction fees)

---

## ðŸ“ž Support & Maintenance

**Post-Launch Support Requirements:**

1. **Technical Support Team** (Recommended)
   - 2-3 Backend Developers
   - 1 DevOps Engineer
   - 5-10 Support Executives (for enquiries)
   - 2-3 Verification Officers
   - 1 Project Manager

2. **Support Channels**
   - Email: support@recruitment.gov.in (24/7 monitoring)
   - Toll-free: 1800-XXX-XXXX (9 AM - 6 PM)
   - WhatsApp: +91-XXXXX-XXXXX (24/7 chatbot + human agents)
   - Web Portal: Public enquiry form

3. **SLA Commitments**
   - Critical Issues: 1-hour response, 4-hour resolution
   - High Priority: 4-hour response, 24-hour resolution
   - Medium/Low: 24-hour response, 48-hour resolution

4. **Monitoring & Alerts**
   - Uptime monitoring (99.9% SLA)
   - Performance monitoring (response time < 2 seconds)
   - Error rate monitoring (< 0.1%)
   - Storage monitoring (alerts at 80% capacity)

---

## ðŸŽ¯ Success Metrics

**Key Performance Indicators (KPIs):**

1. **Application Success Rate**: > 95% (applications completed without errors)
2. **Payment Success Rate**: > 98% (successful payments / total attempts)
3. **Admit Card Download Success**: > 99% (successful downloads / total attempts)
4. **System Uptime**: > 99.9% (excluding planned maintenance)
5. **Average Response Time**: < 2 seconds for API calls
6. **Support Ticket Resolution**: > 90% within SLA
7. **User Satisfaction**: > 4.5/5 stars (post-application survey)
8. **Mobile Responsiveness**: 100% (all pages mobile-optimized)

---

## ðŸ“š Reference Documentation

**Real-World Government Portals Analyzed:**

1. **UPSC** - https://upsc.gov.in
   - One-time registration model
   - Registration ID based tracking
   - Public admit card download

2. **SSC** - https://ssc.nic.in
   - Registration number system
   - Public status check
   - Multi-year registration validity

3. **Railway RRB** - https://rrbcdg.gov.in
   - Direct public application
   - SMS/Email notifications
   - OTP-based admit card download

4. **Bihar STET** - https://bsebstet.com
   - Public form fill
   - Payment integration in flow
   - No candidate dashboard

5. **IBPS** - https://ibps.in
   - Common registration for multiple exams
   - Registration number based access
   - Public admit card hall ticket download

**Best Practices Adopted:**

âœ… Public-first design (no login barrier)
âœ… Registration number as primary identifier
âœ… OTP-based verification for sensitive operations
âœ… Multi-channel communication (Email/SMS/WhatsApp)
âœ… Correction window with approval workflow
âœ… RBAC for admin staff
âœ… Audit trail for all actions
âœ… Scalable microservices architecture
âœ… CDN for file delivery
âœ… Queue-based async processing
âœ… Comprehensive error handling and logging

---

## âœ… Conclusion

This architecture provides a **production-ready, scalable, and secure solution** for a government recruitment portal capable of handling **10 lakh+ concurrent applicants** while maintaining:

âœ… **Public-First Design** - No login required for applicants, direct form fill  
âœ… **Registration Number Based System** - Simple tracking without complex accounts  
âœ… **Security** - OTP verification, encryption, audit trails, PCI DSS compliance  
âœ… **Performance** - Caching, CDN, load balancing, queue-based processing  
âœ… **Reliability** - 99.9% uptime, automated backups, disaster recovery  
âœ… **Scalability** - Horizontal scaling, database replication, batched file storage  
âœ… **Multi-Channel Support** - Email, SMS, WhatsApp, phone, web  
âœ… **Compliance** - Government standards, accessibility (WCAG 2.1), data protection  
âœ… **User Experience** - Mobile-responsive, fast loading, intuitive workflows  
âœ… **Admin Features** - RBAC, comprehensive dashboards, bulk operations

The system is modeled after **real-world government recruitment portals** (UPSC, SSC, RRB, Bihar STET) and follows **industry best practices** for high-traffic applications serving lakhs of users simultaneously.

---

**Document Status**: âœ… **PRODUCTION-READY & COMPLETE**

**Last Updated**: August 6, 2026  
**Version**: 2.0 (Complete End-to-End Architecture)  
**Prepared For**: Government Recruitment Portal - Bihar Police Constable 2026  
**Prepared By**: Technical Architecture Team

---
