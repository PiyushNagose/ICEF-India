const express = require("express");
const router = express.Router();
const {
  getProjectBySlug,
  getActiveProjects,
} = require("../../controllers/public/project.controller");
const { apiLimiter } = require("../../shared/middlewares/rateLimiter");

// GET /api/public/projects           → list all active projects
router.get("/", apiLimiter, getActiveProjects);

// GET /api/public/projects/:slug     → landing page for a specific project
router.get("/:slug", apiLimiter, getProjectBySlug);

module.exports = router;
