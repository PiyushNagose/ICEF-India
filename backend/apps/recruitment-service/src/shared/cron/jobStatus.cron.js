const cron = require("node-cron");
const Job = require("../models/Job");
const { emitToAdmins, SOCKET_EVENTS, emitBroadcast } = require("../socket/index");
const { invalidatePublicRecruitmentCache } = require("../utils/publicCache");

// Run every hour at minute 0
const startJobStatusCron = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      // Set to beginning of the day to ensure we only close jobs if their deadline was yesterday or earlier
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find all active jobs whose application deadline is strictly before the start of today
      const expiredJobs = await Job.find({
        status: "active",
        applicationDeadline: { $lt: startOfToday },
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
