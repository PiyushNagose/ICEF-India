const Project = require("../models/Project");
const ApiError = require("../utils/ApiError");
const { getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const { emitToAdmins, SOCKET_EVENTS } = require("../socket/index");
const { assertProjectTimeline } = require("../utils/timeline");

const createProject = async (data, createdBy) => {
  if (data.endDate) data.closureDate = data.endDate;
  else if (data.closureDate) data.endDate = data.closureDate;
  assertProjectTimeline(data);
  const project = await Project.create({ ...data, createdBy });
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "project_created",
    project,
  });
  return project;
};

const getProjects = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = new RegExp(query.department, "i");
  if (query.state) filter.state = new RegExp(query.state, "i");

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .populate("createdBy", "fullName employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Project.countDocuments(filter),
  ]);

  return { projects, meta: paginationMeta(total, page, limit) };
};

const getProjectById = async (id) => {
  const project = await Project.findById(id).populate(
    "createdBy",
    "fullName employeeId",
  );
  if (!project) throw new ApiError(404, "Project not found");
  return project;
};

const updateProject = async (id, data, updatedBy) => {
  const existing = await Project.findById(id);
  if (!existing) throw new ApiError(404, "Project not found");
  if (data.endDate) data.closureDate = data.endDate;
  else if (data.closureDate) data.endDate = data.closureDate;
  assertProjectTimeline({ ...existing.toObject(), ...data });
  const project = await Project.findByIdAndUpdate(
    id,
    { ...data },
    { new: true, runValidators: true },
  );
  if (!project) throw new ApiError(404, "Project not found");
  emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
    type: "project_updated",
    projectId: id,
  });
  return project;
};

const deleteProject = async (id) => {
  const project = await Project.findByIdAndDelete(id);
  if (!project) throw new ApiError(404, "Project not found");
  return { message: "Project deleted successfully" };
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
};

