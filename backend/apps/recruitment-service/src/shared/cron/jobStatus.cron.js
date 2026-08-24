const cron = require("node-cron");
const Job = require("../models/Job");
const { emitToAdmins, SOCKET_EVENTS, emitBroadcast } = require("../socket/index");
const { invalidatePublicRecruitmentCache } = require("../utils/publicCache");

// Run every hour at minute 0
const startJobStatusCron = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      // Find all active jobs whose application deadline has passed
      const expiredJobs = await Job.find({
        status: "active",
        applicationDeadline: { $lt: now },
      });

      if (expiredJobs.length > 0) {
        console.log(`[Cron] Found ${expiredJobs.length} expired jobs to close.`);
        for (const job of expiredJobs) {
          job.status = "closed";
          await job.save();

          // Real-time notifications
          emitToAdmins(SOCKET_EVENTS.JOB_UPDATED, {
            type: "job_closed",
            message: `Job "${job.title}" has been automatically closed as the deadline passed.`,
            job: job.toObject(),
            timestamp: new Date(),
          });

          // Broadcast to public
          emitBroadcast(SOCKET_EVENTS.JOB_UPDATED, {
            type: "job_closed",
            message: `Job "${job.title}" is no longer accepting applications.`,
            jobId: job._id,
            timestamp: new Date(),
          });
        }
        
        await invalidatePublicRecruitmentCache();
        console.log(`[Cron] Closed ${expiredJobs.length} expired jobs.`);
      }
    } catch (error) {
      console.error("[Cron] Error auto-closing expired jobs:", error);
    }
  });
};

module.exports = { startJobStatusCron };
