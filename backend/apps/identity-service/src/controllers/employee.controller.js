const { StatusCodes } = require("http-status-codes");
const Employee = require("../shared/models/Employee");
const Role = require("../shared/models/Role");
const ApiError = require("../shared/utils/ApiError");
const { ApiResponse, paginationMeta } = require("../shared/utils/ApiResponse");
const asyncHandler = require("../shared/utils/asyncHandler");
const { emitToAdmins, SOCKET_EVENTS } = require("../shared/socket/index");
const { getPaginationParams } = require("../shared/utils/helpers");
const { saveAuditLog } = require("../shared/middlewares/auditLog");
const { sendWelcomeEmail } = require("../shared/services/email.service");

const isSuperAdminRole = (role) =>
  role?.roleName?.trim().toLowerCase() === "super admin";

/**
 * @swagger
 * /api/admin/employees:
 *   get:
 *     tags: [Admin - Employees]
 *     summary: Get all employees
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Active, Inactive, "On Leave"] }
 *       - in: query
 *         name: department
 *         schema: { type: string }
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
 *         description: List of employees
 */
const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const {
    status,
    department,
    search,
    systemRole,
    role,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (department) filter.department = new RegExp(department, "i");
  if (systemRole || role) filter.systemRole = systemRole || role;
  if (search) {
    filter.$or = [
      { fullName: new RegExp(search, "i") },
      { officialEmail: new RegExp(search, "i") },
      { employeeId: new RegExp(search, "i") },
    ];
  }

  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .populate("systemRole", "roleName permissions")
      .populate("createdBy", "fullName employeeId")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Employees fetched", {
      employees: employees.map((e) => e.toSafeObject()),
      pagination: paginationMeta(total, page, limit),
    }),
  );
});

/**
 * @swagger
 * /api/admin/employees/stats:
 *   get:
 *     tags: [Admin - Employees]
 *     summary: Get employee statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employee stats
 */
const getEmployeeStats = asyncHandler(async (req, res) => {
  const [statusStats, departmentStats, roleStats] = await Promise.all([
    Employee.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Employee.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Employee.aggregate([
      {
        $lookup: {
          from: "roles",
          localField: "systemRole",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },
      { $group: { _id: "$role.roleName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Employee stats fetched", {
      statusStats,
      departmentStats,
      roleStats,
    }),
  );
});

/**
 * @swagger
 * /api/admin/employees/{id}:
 *   get:
 *     tags: [Admin - Employees]
 *     summary: Get single employee
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Employee details
 *       404:
 *         description: Employee not found
 */
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id)
    .populate("systemRole", "roleName permissions")
    .populate("createdBy", "fullName employeeId");

  if (!employee)
    throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found");

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Employee fetched", {
      employee: employee.toSafeObject(),
    }),
  );
});

/**
 * @swagger
 * /api/admin/employees:
 *   post:
 *     tags: [Admin - Employees]
 *     summary: Create a new employee
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, contactNumber, department, roleDesignation, employeeId, dateOfJoining, officialEmail, password, systemRole]
 *             properties:
 *               fullName: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               gender: { type: string, enum: [male, female, other] }
 *               contactNumber: { type: string }
 *               department: { type: string }
 *               roleDesignation: { type: string }
 *               employeeId: { type: string }
 *               dateOfJoining: { type: string, format: date }
 *               officialEmail: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               systemRole: { type: string, description: "Role ObjectId" }
 *     responses:
 *       201:
 *         description: Employee created
 *       409:
 *         description: Employee ID or email already exists
 */
const createEmployee = asyncHandler(async (req, res) => {
  const {
    fullName,
    dateOfBirth,
    gender,
    contactNumber,
    department,
    roleDesignation,
    employeeId,
    dateOfJoining,
    officialEmail,
    password,
    systemRole,
  } = req.body;

  // Check if email or employeeId exists in Employee collection
  const existing = await Employee.findOne({
    $or: [{ employeeId }, { officialEmail }],
  });
  if (existing)
    throw new ApiError(
      StatusCodes.CONFLICT,
      "Employee with this ID or email already exists",
    );

  // Check if email exists in User (Candidate) collection
  const User = require("../shared/models/User");
  const existingUser = await User.findOne({ email: officialEmail });
  if (existingUser)
    throw new ApiError(StatusCodes.CONFLICT, "Email already registered");

  const role = await Role.findById(systemRole);
  if (!role) throw new ApiError(StatusCodes.NOT_FOUND, "Role not found");
  if (isSuperAdminRole(role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Super Admin is reserved and cannot be assigned from employee creation",
    );
  }

  const employee = await Employee.create({
    fullName,
    dateOfBirth,
    gender,
    contactNumber,
    department,
    roleDesignation,
    employeeId,
    dateOfJoining,
    officialEmail,
    password,
    systemRole,
    createdBy: req.user.id,
    mustChangePassword: true,
  });

  await employee.populate("systemRole", "roleName permissions");
  await saveAuditLog(req, `Created employee: ${fullName} (${employeeId})`);

  const emailDelivery = await sendWelcomeEmail(
    officialEmail,
    fullName,
    employeeId,
    password,
  );
  if (!emailDelivery.success) {
    await saveAuditLog(
      req,
      `Welcome email not delivered for employee: ${fullName} (${employeeId})`,
    );
  }

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "employee_created",
    message: `New employee "${fullName}" added`,
    timestamp: new Date(),
  });

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Employee created successfully", {
      employee: employee.toSafeObject(),
      emailDelivery,
    }),
  );
});

/**
 * @swagger
 * /api/admin/employees/{id}:
 *   put:
 *     tags: [Admin - Employees]
 *     summary: Update an employee
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
 *               fullName: { type: string }
 *               status: { type: string, enum: [Active, Inactive, "On Leave"] }
 *               systemRole: { type: string }
 *     responses:
 *       200:
 *         description: Employee updated
 */
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee)
    throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found");

  const {
    fullName,
    dateOfBirth,
    gender,
    contactNumber,
    department,
    roleDesignation,
    dateOfJoining,
    systemRole,
    status,
    password,
  } = req.body;

  if (fullName !== undefined) employee.fullName = fullName;
  if (dateOfBirth !== undefined) employee.dateOfBirth = dateOfBirth;
  if (gender !== undefined) employee.gender = gender;
  if (contactNumber !== undefined) employee.contactNumber = contactNumber;
  if (department !== undefined) employee.department = department;
  if (roleDesignation !== undefined) employee.roleDesignation = roleDesignation;
  if (dateOfJoining !== undefined) employee.dateOfJoining = dateOfJoining;
  if (status !== undefined) employee.status = status;
  if (password !== undefined) {
    employee.password = password;
    employee.mustChangePassword = true;
  }
  if (systemRole !== undefined) {
    const role = await Role.findById(systemRole);
    if (!role) throw new ApiError(StatusCodes.NOT_FOUND, "Role not found");
    if (isSuperAdminRole(role)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Super Admin is reserved and cannot be assigned to employees",
      );
    }
    employee.systemRole = systemRole;
  }

  await employee.save();
  await employee.populate("systemRole", "roleName permissions");
  await saveAuditLog(req, `Updated employee: ${employee.fullName}`);

  if (password !== undefined) {
    const emailDelivery = await sendWelcomeEmail(
      employee.officialEmail,
      employee.fullName,
      employee.employeeId,
      password,
      "reset",
    );
    if (!emailDelivery.success) {
      await saveAuditLog(
        req,
        `Password reset email not delivered for employee: ${employee.fullName} (${employee.employeeId})`,
      );
    }
  }

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "employee_updated",
    message: `Employee "${employee.fullName}" updated`,
    timestamp: new Date(),
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Employee updated successfully", {
      employee: employee.toSafeObject(),
    }),
  );
});

/**
 * @swagger
 * /api/admin/employees/{id}:
 *   delete:
 *     tags: [Admin - Employees]
 *     summary: Delete an employee
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Employee deleted
 *       400:
 *         description: Cannot delete own account
 */
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee)
    throw new ApiError(StatusCodes.NOT_FOUND, "Employee not found");
  if (employee._id.toString() === req.user.id)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot delete your own account",
    );

  await Employee.findByIdAndDelete(req.params.id);
  await saveAuditLog(
    req,
    `Deleted employee: ${employee.fullName} (${employee.employeeId})`,
  );

  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "employee_deleted",
    message: `Employee "${employee.fullName}" deleted`,
    timestamp: new Date(),
  });

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Employee deleted successfully"));
});

module.exports = {
  getEmployees,
  getEmployeeStats,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
