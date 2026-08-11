const { z } = require("zod");

const permissionSchema = z
  .object({
    create: z.boolean().default(false),
    view: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    download: z.boolean().default(false),
    publish: z.boolean().default(false),
    approve: z.boolean().default(false),
    reject: z.boolean().default(false),
    assign: z.boolean().default(false),
    resolve: z.boolean().default(false),
    refund: z.boolean().default(false),
    reconcile: z.boolean().default(false),
    publishWindow: z.boolean().default(false),
    generateOnDemand: z.boolean().default(false),
    bulkGenerate: z.boolean().default(false),
    attendance: z.boolean().default(false),
  })
  .optional();

const createRoleSchema = z.object({
  roleName: z.string().min(2, "Role name is required").max(100),
  roleDescription: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  permissions: z
    .object({
      jobs: permissionSchema,
      applications: permissionSchema,
      analytics: permissionSchema,
      employees: permissionSchema,
      paymentSettings: permissionSchema,
      support: permissionSchema,
      projects: permissionSchema,
      results: permissionSchema,
      admitCards: permissionSchema,
      cms: permissionSchema,
      activityLogs: permissionSchema,
    })
    .optional(),
});

const updateRoleSchema = createRoleSchema.partial();

module.exports = { createRoleSchema, updateRoleSchema };
