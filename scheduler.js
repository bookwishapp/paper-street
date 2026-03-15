const cron = require('node-cron');
const { runSquareSync } = require('./services/squareSync');
const { runNudgeMailer } = require('./services/nudgeMailer');
const { runNewsletterGenerator } = require('./services/newsletterGenerator');

// Store job references for health endpoint
const scheduledJobs = {
  squareSync: null,
  nudgeMailer: null,
  newsletterGenerator: null
};

// Store last run times for monitoring
const lastRunTimes = {
  squareSync: null,
  nudgeMailer: null,
  newsletterGenerator: null
};

function initializeScheduler() {
  console.log('🕐 Initializing cron scheduler...');

  // Square Sync - Sundays at 11 PM PT
  // Using America/Los_Angeles timezone for accurate PT handling
  scheduledJobs.squareSync = cron.schedule('0 23 * * 0', async () => {
    console.log('[Square Sync] Starting scheduled sync...');
    lastRunTimes.squareSync = new Date();
    try {
      const result = await runSquareSync();
      console.log('[Square Sync] Completed successfully', result);
    } catch (error) {
      console.error('[Square Sync] Failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Los_Angeles"
  });

  // Nudge Mailer - Mondays at 9 AM PT
  scheduledJobs.nudgeMailer = cron.schedule('0 9 * * 1', async () => {
    console.log('[Nudge Mailer] Starting scheduled nudge campaign...');
    lastRunTimes.nudgeMailer = new Date();
    try {
      const result = await runNudgeMailer();
      console.log('[Nudge Mailer] Completed successfully', result);
    } catch (error) {
      console.error('[Nudge Mailer] Failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Los_Angeles"
  });

  // Newsletter Generator - Tuesdays at 9 AM PT
  scheduledJobs.newsletterGenerator = cron.schedule('0 9 * * 2', async () => {
    console.log('[Newsletter] Starting scheduled newsletter generation...');
    lastRunTimes.newsletterGenerator = new Date();
    try {
      const result = await runNewsletterGenerator();
      console.log('[Newsletter] Completed successfully', result);
    } catch (error) {
      console.error('[Newsletter] Failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Los_Angeles"
  });

  console.log('✅ Cron scheduler initialized with the following jobs:');
  console.log('  - Square Sync: Sundays 11 PM PT');
  console.log('  - Nudge Mailer: Mondays 9 AM PT');
  console.log('  - Newsletter Generator: Tuesdays 9 AM PT');
}

// Manual trigger functions for testing
async function triggerSquareSync() {
  console.log('[Manual] Triggering Square sync...');
  lastRunTimes.squareSync = new Date();
  return await runSquareSync();
}

async function triggerNudgeMailer() {
  console.log('[Manual] Triggering nudge mailer...');
  lastRunTimes.nudgeMailer = new Date();
  return await runNudgeMailer();
}

async function triggerNewsletterGenerator() {
  console.log('[Manual] Triggering newsletter generator...');
  lastRunTimes.newsletterGenerator = new Date();
  return await runNewsletterGenerator();
}

// Get job status for health endpoint
function getJobStatus() {
  return {
    jobs: {
      squareSync: {
        scheduled: scheduledJobs.squareSync !== null,
        lastRun: lastRunTimes.squareSync,
        nextRun: getNextRunTime('0 23 * * 0', 'America/Los_Angeles')
      },
      nudgeMailer: {
        scheduled: scheduledJobs.nudgeMailer !== null,
        lastRun: lastRunTimes.nudgeMailer,
        nextRun: getNextRunTime('0 9 * * 1', 'America/Los_Angeles')
      },
      newsletterGenerator: {
        scheduled: scheduledJobs.newsletterGenerator !== null,
        lastRun: lastRunTimes.newsletterGenerator,
        nextRun: getNextRunTime('0 9 * * 2', 'America/Los_Angeles')
      }
    }
  };
}

// Helper to calculate next run time (simplified)
function getNextRunTime(cronExpression, timezone) {
  // This is a simplified version - in production you might want to use
  // a library like cron-parser for accurate next run time calculation
  const now = new Date();
  const parts = cronExpression.split(' ');
  const dayOfWeek = parseInt(parts[4]);

  const next = new Date();
  // Set to Pacific timezone offset (simplified)
  next.setHours(next.getHours() - 8); // Rough PST offset

  // Find next occurrence
  while (next.getDay() !== dayOfWeek || next <= now) {
    next.setDate(next.getDate() + 1);
  }

  // Set time from cron expression
  next.setHours(parseInt(parts[1]));
  next.setMinutes(parseInt(parts[0]));
  next.setSeconds(0);

  return next;
}

// Graceful shutdown
function stopScheduler() {
  console.log('Stopping all scheduled jobs...');
  Object.values(scheduledJobs).forEach(job => {
    if (job) job.stop();
  });
}

process.on('SIGTERM', stopScheduler);
process.on('SIGINT', stopScheduler);

module.exports = {
  initializeScheduler,
  triggerSquareSync,
  triggerNudgeMailer,
  triggerNewsletterGenerator,
  getJobStatus,
  stopScheduler
};