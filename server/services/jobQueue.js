const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const JOBS_FILE = path.join(__dirname, '../data/jobs.json');

// In-memory job store (persisted to disk)
let jobs = {};

// Load existing jobs on startup
try {
  const data = fs.readFileSync(JOBS_FILE, 'utf-8');
  jobs = JSON.parse(data);
} catch (e) {
  jobs = {};
}

// Save jobs to disk
function persistJobs() {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// Job statuses
const STATUS = {
  QUEUED: 'queued',
  FETCHING: 'fetching',
  ANALYZING: 'analyzing',
  ENRICHING: 'enriching',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

// Create a new job
function createJob(repoUrl) {
  const jobId = uuidv4();
  const job = {
    id: jobId,
    repoUrl,
    status: STATUS.QUEUED,
    progress: 0,
    message: 'Job queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: null,
    error: null
  };

  jobs[jobId] = job;
  persistJobs();

  return job;
}

// Get a job by ID
function getJob(jobId) {
  return jobs[jobId] || null;
}

// Update job status
function updateJob(jobId, updates) {
  if (!jobs[jobId]) return null;

  jobs[jobId] = {
    ...jobs[jobId],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  persistJobs();
  return jobs[jobId];
}

// Mark job as fetching
function setFetching(jobId) {
  return updateJob(jobId, {
    status: STATUS.FETCHING,
    progress: 10,
    message: 'Fetching repository from GitHub...'
  });
}

// Mark job as analyzing
function setAnalyzing(jobId) {
  return updateJob(jobId, {
    status: STATUS.ANALYZING,
    progress: 30,
    message: 'Analyzing code structure...'
  });
}

// Mark job as enriching
function setEnriching(jobId) {
  return updateJob(jobId, {
    status: STATUS.ENRICHING,
    progress: 70,
    message: 'Enriching with AI insights...'
  });
}

// Mark job as complete
function setComplete(jobId, result) {
  return updateJob(jobId, {
    status: STATUS.COMPLETE,
    progress: 100,
    message: 'Analysis complete',
    result
  });
}

// Mark job as failed
function setFailed(jobId, error) {
  return updateJob(jobId, {
    status: STATUS.FAILED,
    message: `Failed: ${error}`,
    error
  });
}

// Get all jobs (for debugging)
function getAllJobs() {
  return Object.values(jobs);
}

// Process a job (called by worker)
async function processJob(jobId, processor) {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    await processor(job, {
      setFetching: () => setFetching(jobId),
      setAnalyzing: () => setAnalyzing(jobId),
      setEnriching: () => setEnriching(jobId),
      setComplete: (result) => setComplete(jobId, result),
      setFailed: (error) => setFailed(jobId, error)
    });
  } catch (error) {
    setFailed(jobId, error.message);
    throw error;
  }
}

module.exports = {
  STATUS,
  createJob,
  getJob,
  updateJob,
  setFetching,
  setAnalyzing,
  setEnriching,
  setComplete,
  setFailed,
  getAllJobs,
  processJob
};
