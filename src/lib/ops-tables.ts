import { prisma } from "@/lib/db";
import { QUALITY_STATUSES } from "@/lib/lead-quality";
import { SCORE_RULES } from "@/lib/lead-score";

const OPS_VERSION = 8;
let readyAt = 0;

export async function ensureOpsTables() {
  if (readyAt === OPS_VERSION) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS pan TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT,
      ADD COLUMN IF NOT EXISTS pincode TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
      ADD COLUMN IF NOT EXISTS billing_notes TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE engagements
      ADD COLUMN IF NOT EXISTS project_type TEXT,
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM',
      ADD COLUMN IF NOT EXISTS billing_model TEXT,
      ADD COLUMN IF NOT EXISTS payment_terms TEXT,
      ADD COLUMN IF NOT EXISTS po_value NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_people NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_ads NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_tools NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_other NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'APPROVED'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(8,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reviewer_id TEXT,
      ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE follow_ups
      ADD COLUMN IF NOT EXISTS kind TEXT,
      ADD COLUMN IF NOT EXISTS meet_url TEXT,
      ADD COLUMN IF NOT EXISTS location TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS client_contacts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      designation TEXT,
      email TEXT,
      mobile TEXT,
      whatsapp TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON client_contacts (client_id)`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS client_orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      engagement_id TEXT,
      value NUMERIC(14,2) NOT NULL DEFAULT 0,
      utilized NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
      ordered_at DATE,
      valid_until DATE,
      document_url TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS resource_allocations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      role_label TEXT,
      hours_week NUMERIC(8,2) NOT NULL DEFAULT 0,
      pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      start_date DATE,
      end_date DATE,
      billable BOOLEAN NOT NULL DEFAULT true,
      hourly_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS resource_alloc_user_idx ON resource_allocations (user_id)`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      engagement_id TEXT,
      task_id TEXT,
      day DATE NOT NULL,
      hours NUMERIC(8,2) NOT NULL DEFAULT 0,
      billable BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS follow_up_at DATE,
      ADD COLUMN IF NOT EXISTS benchmark_amount NUMERIC(14,2) DEFAULT 0
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE client_orders
      ADD COLUMN IF NOT EXISTS follow_up_at DATE,
      ADD COLUMN IF NOT EXISTS benchmark_amount NUMERIC(14,2) DEFAULT 0
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS crm_files (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'OTHER',
      url TEXT NOT NULL,
      client_id TEXT,
      engagement_id TEXT,
      invoice_id TEXT,
      client_order_id TEXT,
      follow_up_at DATE,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE crm_files
      ADD COLUMN IF NOT EXISTS invoice_id TEXT,
      ADD COLUMN IF NOT EXISTS client_order_id TEXT,
      ADD COLUMN IF NOT EXISTS user_id TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE employee_profiles
      ADD COLUMN IF NOT EXISTS resume_url TEXT
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_files_client_idx ON crm_files (client_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_files_project_idx ON crm_files (engagement_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_files_invoice_idx ON crm_files (invoice_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_files_po_idx ON crm_files (client_order_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS crm_files_user_idx ON crm_files (user_id)`);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE engagements
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
  `);
  for (const status of QUALITY_STATUSES) {
    await prisma.leadStatus.upsert({
      where: { key: status.key },
      update: {
        name: status.name,
        color: status.color,
        isFinal: status.isFinal,
        isActive: true,
        sortOrder: status.sortOrder,
        description: status.description,
      },
      create: status,
    });
  }
  for (const rule of SCORE_RULES) {
    await prisma.scoringRule.upsert({
      where: { eventKey: rule.eventKey },
      update: { points: rule.points, description: rule.description, isActive: true },
      create: rule,
    });
  }
  await prisma.setting.upsert({
    where: { key: "margin_floor_pct" },
    update: {},
    create: { key: "margin_floor_pct", value: 25 },
  }).catch(() => undefined);
  await prisma.setting.upsert({
    where: { key: "approval_authorities" },
    update: {},
    create: {
      key: "approval_authorities",
      value: {
        people: ["hr_admin", "crm_manager"],
        project: ["project_manager", "crm_manager"],
        proposal: ["accounts", "crm_manager"],
        invoice: ["accounts", "crm_manager"],
      },
    },
  }).catch(() => undefined);
  readyAt = OPS_VERSION;
}
