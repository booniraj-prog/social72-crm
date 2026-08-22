# SOCIAL72 CRM — MASTER PRODUCT & DEVELOPMENT SPECIFICATION

This file is the product source of truth. Architecture: `ARCHITECTURE.md`. Schema: `database-schema.sql`.

## 1. PROJECT OVERVIEW

Build a production-ready CRM application for **Social72**, a digital marketing, lead generation and BPO company.

Social72 generates leads through digital marketing campaigns and then uses an internal BPO/calling team to contact, qualify, nurture and follow up with those leads until the desired business outcome is achieved.

The CRM must manage the complete journey:

Digital Marketing → Lead Generation → Lead Capture → Lead Assignment → BPO Calling → Qualification → Nurturing → Follow-up → Site Visit / Campus Visit / Meeting → Negotiation / Counselling → Documentation → Closure → Revenue → ROI Reporting

The system must support two major business verticals:

1. Education Admissions
2. Real Estate Property Sales / Registration

The architecture must be designed so additional industries can be added later.

## 2. CORE BUSINESS OBJECTIVE

The primary objective of this CRM is:

"Maximize the conversion and revenue generated from every marketing lead."

The CRM must prevent leads from being wasted because of:

* No assignment
* No first call
* Missed follow-up
* Poor nurturing
* Duplicate leads
* Incorrect status
* No next action
* Poor BPO productivity
* Leads becoming inactive
* Lack of visibility for management

Every active lead should have:

* Owner
* Current status
* Lead temperature
* Last activity
* Next follow-up date
* Next action
* Lead source
* Campaign
* Expected value
* Probability
* Conversion status

## 3. USER ROLES

Implement role-based access control.

### Super Admin

Full system access. Can: create users, modify roles, manage clients, manage campaigns, view all leads, view all reports, configure workflows, export reports, manage system settings.

### Business / CRM Manager

Can: view all assigned campaigns, manage leads, assign/reassign leads, monitor BPO team, view reports, monitor follow-ups, export reports.

### BPO Team Leader

Can: view team leads, assign leads, monitor calling, monitor follow-ups, view team KPIs, reassign leads within team.

### BPO Executive

Can: view assigned leads, call leads, update lead status, add notes, schedule follow-ups, update qualification, record outcomes, view own KPIs.

### Digital Marketing Manager

Can: create/manage campaigns, upload/import leads, view campaign performance, view lead sources, view CPL, view conversion performance.

### Client

Optional future role. Can view only their own campaign/leads/reports.

## 4. MULTI-CLIENT ARCHITECTURE

The CRM must support multiple Social72 clients.

Example:

* Client A → Education Campaign
* Client B → Real Estate Campaign
* Client C → Education Campaign

Every lead must be associated with: Client, Campaign, Source, Medium, Channel, Assigned team, Assigned executive.

Do not mix data between clients. Design the database with proper tenant/client relationships.

## 5. LEAD DATA MODEL

Create a comprehensive Lead entity.

### Basic Information

Lead ID, First Name, Last Name, Full Name, Mobile Number, Alternate Mobile, Email, City, State, Country, Pincode, Age, Gender, Occupation

### Marketing Information

Client, Campaign, Lead Source, Source Platform, UTM Source, UTM Medium, UTM Campaign, UTM Content, UTM Term, Ad ID, Ad Set, Landing Page, Lead Generated Date, Lead Generated Time

### CRM Information

Current Status, Lead Temperature, Lead Score, Assigned User, Assigned Date, First Contact Date, Last Contact Date, Next Follow-up Date, Next Action, Number of Call Attempts, Number of Connected Calls, Number of Follow-ups, Last Disposition, Lead Created By, Created Date, Updated Date

### Commercial Information

Expected Value, Probability %, Expected Revenue, Actual Revenue, Closure Date, Closure Type, Won/Lost Reason

## 6. LEAD STATUS

Create configurable lead statuses.

Default statuses: NEW, ASSIGNED, CALL NOT ATTEMPTED, CALL ATTEMPTED, CONNECTED, NOT INTERESTED, INTERESTED, QUALIFIED, FOLLOW-UP, SITE VISIT, CAMPUS VISIT, MEETING, NEGOTIATION, DOCUMENTATION, PAYMENT PENDING, CLOSED WON, CLOSED LOST, DUPLICATE, INVALID, DO NOT CALL, NURTURE

Each status should have: Name, Description, Color, Active/inactive, Allowed next statuses.

Do not hard-code the workflow unnecessarily. Make it configurable.

## 7. LEAD TEMPERATURE

HOT, WARM, COLD, UNQUALIFIED

Lead temperature should be manually changeable and optionally calculated based on lead score and activities.

## 8. LEAD SCORING

Create a configurable lead scoring engine.

Example scoring: +10 Lead responded, +10 Interested, +15 Budget confirmed, +15 Decision maker confirmed, +10 Site/Campus visit agreed, +20 Site/Campus visit completed, +20 Documentation started

Negative scoring: -10 Not reachable repeatedly, -15 Low budget, -20 Not interested, -30 Invalid lead

Lead score should be configurable from Admin settings.

## 9. CALLING WORKSPACE

Create a dedicated BPO calling screen.

The executive should see: Lead name, Phone number, Client, Campaign, Lead source, Lead generated date, Lead status, Lead temperature, Lead score, Previous call history, Previous notes, Last conversation summary, Next follow-up, Next action, Expected value, Important lead information

The executive must be able to perform the following without navigating away: Call, Add call outcome, Add notes, Change status, Change temperature, Schedule follow-up, Update qualification, Add task, Mark interested, Mark not interested, Move to nurture, Mark closed won/lost

## 10. CALL DISPOSITIONS

Configurable call dispositions.

Default: CONNECTED, NOT ANSWERED, BUSY, SWITCHED OFF, INVALID NUMBER, CALL BACK, INTERESTED, NOT INTERESTED, WRONG NUMBER, LANGUAGE ISSUE, BUDGET ISSUE, COMPETITOR, FOLLOW-UP REQUIRED, SITE VISIT AGREED, CAMPUS VISIT AGREED, CLOSED WON, CLOSED LOST

Each call must store: Date, Time, Executive, Duration if available, Disposition, Notes, Next follow-up, Next action

## 11. FOLLOW-UP ENGINE

Every active lead should have a next follow-up date unless the status is a final status.

Create: Today's Follow-ups, Overdue Follow-ups, Tomorrow's Follow-ups, Upcoming Follow-ups, Missed Follow-ups, No Follow-up Assigned, Follow-up completion percentage

The dashboard must clearly highlight overdue leads. Managers must be able to see which executives have overdue follow-ups.

## 12. ACTIVITY TIMELINE

Every lead must have a complete chronological timeline (created, assigned, calls, qualification, follow-ups, visits, documentation, closed).

## 13. EDUCATION CRM

Education-specific fields: Student Name, Parent Name, Student Current Class, Completed Class, Target Class, Board, Course, Stream, Preferred Course, Entrance Exam, Academic Score, Location, Preferred Campus, Hostel Required, Parent Occupation, Budget, Admission Timeline, Campus Visit Date, Counselling Date, Admission Status, Fee, Scholarship, Payment Status

Education pipeline: Lead → Contacted → Parent Connected → Qualified → Interested → Counselling → Campus Visit → Application → Documentation → Fee Discussion → Payment → Admission Confirmed → Closed Won

## 14. REAL ESTATE CRM

Real-estate-specific fields: Property, Project, Location, Property Type, Configuration, Budget, Preferred Location, Purpose, Investment / End Use, Possession Requirement, Loan Required, Site Visit Date, Site Visit Status, Negotiation Status, Booking Amount, Expected Registration Date, Registration Status, Property Value, Expected Revenue, Actual Revenue

Real estate pipeline: Lead → Contacted → Qualified → Interested → Property Shared → Site Visit Planned → Site Visit Completed → Negotiation → Booking → Documentation → Registration → Closed Won → Closed Lost

## 15. CAMPAIGN MANAGEMENT

Campaign fields: Campaign Name, Client, Industry, Campaign Type, Platform, Start Date, End Date, Budget, Actual Spend, Leads Generated, Valid Leads, Qualified Leads, Site/Campus Visits, Opportunities, Admissions/Registrations, Revenue, CPL, CPQL, Cost per Visit, Cost per Acquisition, Conversion Rate, ROI, ROAS

Platforms: Google Ads, Meta Ads, LinkedIn Ads, Website, Landing Page, Organic, Referral, Other

## 16. LEAD IMPORT

CSV/Excel import with: upload preview, column mapping, mobile/email validation, duplicate detection, missing mandatory fields, import errors, correction, import valid records, import summary (total, success, duplicates, invalid, rejected).

## 17. DUPLICATE MANAGEMENT

Detect duplicates: primary mobile, secondary email, optional name + mobile.

Do not blindly create duplicates. Provide: warning, existing lead information, merge option, keep latest, keep original, activity history preservation.

## 18–19. DASHBOARD AND CHARTS

Filters: date range, client, campaign, industry, lead source, state, city, executive, team, status

KPI cards: Total Leads, New, Assigned, Contacted, Qualified, Hot, Follow-ups Today, Overdue Follow-ups, Site Visits, Admissions/Registrations, Closed Won, Closed Lost, Revenue, Marketing Spend, CPL, Conversion Rate, ROI

Charts: lead generation trend, status funnel, source performance, campaign performance, BPO executive performance, daily calls, connected calls, follow-up completion, overdue follow-ups, site/campus visit conversion, admission/registration conversion, revenue trend, spend vs revenue, CPL by campaign, conversion by campaign, ROI by campaign. Charts must support filtering.

## 20. BPO PERFORMANCE DASHBOARD

Per executive: Leads Assigned, Contacted, Calls Made, Connected Calls, Connection Rate, Follow-ups Completed, Pending, Overdue, Qualified, Hot, Site Visits, Campus Visits, Closures, Revenue, Conversion Rate. Ranking/leaderboard. Date filtering.

## 21. MARKETING PERFORMANCE

Connect marketing and BPO. Example: spend, leads, CPL, qualified, visits, closures, revenue, ROI calculated automatically. Show where leads are lost in the funnel.

## 22. LEAD FUNNEL

LEADS → CONTACTED → CONNECTED → QUALIFIED → INTERESTED → VISIT → NEGOTIATION / COUNSELLING → CLOSURE

Show count, percentage, drop-off percentage, conversion rate.

## 23–25. REPORTING AND EXPORT

Reports: Lead, Campaign, BPO Performance, Follow-up, Conversion, Revenue, ROI, Source Performance, Executive Performance, Client, Education Admission, Real Estate Registration.

Filters: date, client, campaign, executive. Export Excel, CSV, PDF.

PDF: Social72 branding, title, date range, filters, KPI summary, charts where appropriate, tables, generated date.

Client report example (GM Global School): period, spend, leads, qualified, campus visits, applications, admissions, revenue, CPL, cost per admission, conversion, ROI, BPO activity. Suitable for sharing with a client management team.

## 26. NOTIFICATIONS

New lead assigned, follow-up due, follow-up overdue, lead uncontacted for X hours, hot lead created, site visit scheduled, campus visit scheduled, lead inactive, manager escalation, closure achieved. Thresholds configurable.

## 27. LEAD SLA

Configurable SLA. Example: new lead assigned within 15 minutes; assigned lead first call within 10 minutes. Warning if not contacted within SLA. Escalate to Team Leader on breach.

## 28–29. SEARCH AND FILTERS

Global search: lead name, mobile, email, lead ID, campaign, client, property, student, parent.

Major screens: date, client, campaign, status, source, executive, team, city, state, temperature, lead score. Saved filters.

## 30. AUDIT TRAIL

Track: lead created, assigned, reassigned, status changed, owner changed, notes added, follow-up created/completed, merged, deleted, data exported.

Store: user, date/time, action, old value, new value.

## 31. SECURITY

Authentication, RBAC, secure passwords, session management, API authorization, tenant/client isolation, audit logging, input validation, SQL injection protection, XSS protection, CSRF where applicable, secure file uploads.

BPO executives must never see data outside their permitted access.

## 32–34. UI / LEAD DETAIL / PIPELINE

Modern SaaS UI: clean, professional, fast, mobile responsive, desktop optimized, minimal clicks.

Primary navigation: Dashboard, Leads, Calling, Follow-ups, Campaigns, Clients, Reports, BPO Performance, Education, Real Estate, Users, Settings.

Lead detail: left information, center timeline, right actions (Call, Add Note, Change Status, Schedule Follow-up, Assign, Change Temperature, Add Task, Mark Won, Mark Lost).

Kanban: New, Contacted, Qualified, Interested, Visit, Negotiation, Documentation, Won, Lost. Stage changes in audit trail.

## 35–36. DATABASE AND API

Normalized relational database. Entities as specified (users, roles, clients, campaigns, leads, activities, call_logs, follow_ups, education_details, real_estate_details, etc.). UUID PKs. Indexes on mobile, email, client_id, campaign_id, assigned_user_id, status, next_followup_date, created_at.

REST APIs by module: /api/auth, users, clients, campaigns, leads, activities, calls, followups, reports, dashboard, bpo, import, export.

## 37–38. DEVELOPMENT APPROACH AND PHASES

Do not build the entire application in one step. Architecture first, then phases 1–10 as specified (foundation → leads → calling → education → real estate → campaigns → dashboard → reports → automation → production).

## 39–40. CODING PRINCIPLES AND CRM QUESTIONS

Production-quality TypeScript, modular, validated, transactional, paginated. Do not hard-code business rules that should be configurable.

The system must always answer the 20 management questions in the original brief (volume, campaign, spend, CPL, contacted, connected, qualified, hot, follow-ups, visits, opportunities, admissions, revenue, best ROI campaign, best executive, neglected leads, funnel leakage, today’s actions, pipeline expected revenue).

## 41–42. FUTURE INTEGRATIONS AND AI

Design for later: Meta Lead Ads, Google Ads, Sheets, WhatsApp, Email, SMS, telephony/IVR/recording, website forms, webhooks, payments, GA, Power BI, AI scoring/summaries/recommendations. Do not implement initially.

## 43. SUCCESS CRITERIA

Management understands the business in 60 seconds. A BPO executive processes a lead in 1–2 minutes. Managers identify neglected leads, overdue follow-ups, high-value leads, campaign and executive performance, and pipeline vs actual revenue without Excel.

## 44. IMPLEMENTATION RULE

After architecture approval, implement Phase 1 only. This specification remains the source of truth throughout development.
