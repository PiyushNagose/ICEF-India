const { z } = require("zod");

const permissionSchema = z
  .object({
    create: z.boolean().default(false),
    view: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    download: z.boolean().default(false),
  })
  .optional();

const createRoleSchema = z.object({
  roleName: z.string().min(2, "Role name is required").max(100),
  roleDescription: z.string().max(500).optional(),
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
    })
    .optional(),
});

const updateRoleSchema = createRoleSchema.partial();

module.exports = { createRoleSchema, updateRoleSchema };
