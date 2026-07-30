const { StatusCodes } = require("http-status-codes");
const Role = require("../shared/models/Role");
const Employee = require("../shared/models/Employee");
const ApiError = require("../shared/utils/ApiError");
const { ApiResponse, paginationMeta } = require("../shared/utils/ApiResponse");
const asyncHandler = require("../shared/utils/asyncHandler");
const { emitToAdmins, SOCKET_EVENTS } = require("../shared/socket/index");
const { getPaginationParams } = require("../shared/utils/helpers");
const { saveAuditLog } = require("../shared/middlewares/auditLog");

/**
 * @swagger
 * /api/admin/roles:
 *   get:
 *     tags: [Admin - Roles]
 *     summary: Get all roles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of roles
 */
const getRoles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { search } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { roleName: new RegExp(search, "i") },
      { roleDescription: new RegExp(search, "i") },
    ];
  }

  const [roles, total] = await Promise.all([
    Role.find(filter)
      .populate("createdBy", "fullName employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Role.countDocuments(filter),
  ]);

  const rolesWithCount = await Promise.all(
    roles.map(async (role) => ({
      ...role.toObject(),
      employeeCount: await Employee.countDocuments({ systemRole: role._id }),
    })),
  );

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(
        StatusCodes.OK,
        "Roles fetched",
        {
          roles: rolesWithCount,
          pagination: paginationMeta(total, page, limit),
        },
      ),
    );
});

/**
 * @swagger
 * /api/admin/roles/permissions/structure:
 *   get:
 *     tags: [Admin - Roles]
 *     summary: Get the permissions matrix structure
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions structure
 */
const getPermissionsStructure = asyncHandler(async (req, res) => {
  const permissionsStructure = {
    modules: [
      {
        name: "jobs",
        label: "Jobs Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "applications",
        label: "Applications Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "analytics",
        label: "Analytics & Reports",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "employees",
        label: "Employee Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "paymentSettings",
        label: "Payment Settings",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "support",
        label: "Support Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "projects",
        label: "Project Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "results",
        label: "Results Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
      {
        name: "admitCards",
        label: "Admit Card Management",
        actions: ["create", "view", "edit", "delete", "download"],
      },
    ],
  };

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Permissions structure fetched", {
        permissionsStructure,
      }),
    );
});

/**
 * @swagger
 * /api/admin/roles/{id}:
 *   get:
 *     tags: [Admin - Roles]
 *     summary: Get a single role with assigned employees
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role details
 *       404:
 *         description: Role not found
 */
const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id).populate(
    "createdBy",
    "fullName employeeId",
  );
  if (!role) throw new ApiError(StatusCodes.NOT_FOUND, "Role not found");

  const [employees, employeeCount] = await Promise.all([
    Employee.find({ systemRole: role._id })
      .select("fullName employeeId department status")
      .limit(10),
    Employee.countDocuments({ systemRole: role._id }),
  ]);

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Role fetched", {
        role: { ...role.toObject(), employees, employeeCount },
      }),
    );
});

/**
 * @swagger
 * /api/admin/roles:
 *   post:
 *     tags: [Admin - Roles]
 *     summary: Create a new role
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleName]
 *             properties:
 *               roleName: { type: string }
 *               roleDescription: { type: string }
 *               permissions:
 *                 type: object
 *                 description: "Permission matrix — each module has create/view/edit/delete/download booleans"
 *     responses:
 *       201:
 *         description: Role created
 *       409:
 *         description: Role name already exists
 */
const createRole = asyncHandler(async (req, res) => {
  const { roleName, roleDescription, permissions } = req.body;

  const existing = await Role.findOne({ roleName });
  if (existing)
    throw new ApiError(
      StatusCodes.CONFLICT,
      "Role with this name already exists",
    );

  const role = await Role.create({
    roleName,
    roleDescription,
    permissions,
    createdBy: req.user.id,
  });
  await role.populate("createdBy", "fullName employeeId");
  await saveAuditLog(req, `Created role: ${roleName}`);

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "role_created",
    message: `New role "${roleName}" created`,
    timestamp: new Date(),
  });

  res
    .status(StatusCodes.CREATED)
    .json(
      new ApiResponse(StatusCodes.CREATED, "Role created successfully", {
        role,
      }),
    );
});

/**
 * @swagger
 * /api/admin/roles/{id}:
 *   put:
 *     tags: [Admin - Roles]
 *     summary: Update a role
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleName: { type: string }
 *               roleDescription: { type: string }
 *               permissions: { type: object }
 *     responses:
 *       200:
 *         description: Role updated
 */
const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(StatusCodes.NOT_FOUND, "Role not found");

  const { roleName, roleDescription, permissions } = req.body;

  if (roleName && roleName !== role.roleName) {
    const existing = await Role.findOne({ roleName });
    if (existing)
      throw new ApiError(StatusCodes.CONFLICT, "Role name already exists");
  }

  if (roleName !== undefined) role.roleName = roleName;
  if (roleDescription !== undefined) role.roleDescription = roleDescription;
  if (permissions !== undefined) role.permissions = permissions;

  await role.save();
  await role.populate("createdBy", "fullName employeeId");
  await saveAuditLog(req, `Updated role: ${role.roleName}`);

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "role_updated",
    message: `Role "${role.roleName}" updated`,
    timestamp: new Date(),
  });

  res
    .status(StatusCodes.OK)
    .json(
      new ApiResponse(StatusCodes.OK, "Role updated successfully", { role }),
    );
});

/**
 * @swagger
 * /api/admin/roles/{id}:
 *   delete:
 *     tags: [Admin - Roles]
 *     summary: Delete a role
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted
 *       400:
 *         description: Role has assigned employees
 */
const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(StatusCodes.NOT_FOUND, "Role not found");

  const employeeCount = await Employee.countDocuments({ systemRole: role._id });
  if (employeeCount > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot delete role — ${employeeCount} employee(s) are assigned to it`,
    );
  }

  await Role.findByIdAndDelete(req.params.id);
  await saveAuditLog(req, `Deleted role: ${role.roleName}`);

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "role_deleted",
    message: `Role "${role.roleName}" deleted`,
    timestamp: new Date(),
  });

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Role deleted successfully"));
});

module.exports = {
  getRoles,
  getPermissionsStructure,
  getRole,
  createRole,
  updateRole,
  deleteRole,
};


