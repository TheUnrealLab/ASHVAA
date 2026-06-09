const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const jobQueue = require('../services/jobQueue');
const github = require('../services/github');
const codeAnalyzer = require('../services/codeAnalyzer');
const securityScanner = require('../services/securityScanner');
const enricher = require('../services/enricher');

const DATA_DIR = path.join(__dirname, '../data');
const REPOS_FILE = path.join(DATA_DIR, 'repos.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Load repos from file
function loadRepos() {
  try {
    const data = fs.readFileSync(REPOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Save repos to file
function saveRepos(repos) {
  fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2));
}

// GET /api/repos - List all repos (excludes deleted)
router.get('/', (req, res) => {
  const repos = loadRepos();
  // Filter out soft-deleted repos
  const activeRepos = repos.filter(r => !r.deleted);
  res.json(activeRepos);
});

// POST /api/repos - Submit new repo for analysis
router.post('/', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  try {
    // Parse repo URL to validate
    const { owner, repo } = github.parseRepoUrl(repoUrl);
    const repoId = `${owner}-${repo}`;

    // Check if repo already exists
    const repos = loadRepos();
    const existingIndex = repos.findIndex(r => r.id === repoId);
    const existing = existingIndex !== -1 ? repos[existingIndex] : null;

    // If repo exists and is NOT deleted, return existing
    if (existing && !existing.deleted) {
      return res.json({
        jobId: existing.jobId,
        repoId,
        status: existing.status,
        message: 'Repo already exists'
      });
    }

    // Create new job
    const job = jobQueue.createJob(repoUrl);

    // If repo was soft-deleted, restore and re-analyze
    if (existing && existing.deleted) {
      console.log(`[${repoId}] Restoring deleted repo and re-analyzing...`);
      repos[existingIndex] = {
        id: repoId,
        owner,
        repo,
        repoUrl,
        jobId: job.id,
        status: 'queued',
        createdAt: existing.createdAt, // Keep original creation date
        restoredAt: new Date().toISOString(),
        healthScore: null,
        summary: null,
        deleted: false
      };
    } else {
      // Add new repo to list
      repos.push({
        id: repoId,
        owner,
        repo,
        repoUrl,
        jobId: job.id,
        status: 'queued',
        createdAt: new Date().toISOString(),
        healthScore: null,
        summary: null
      });
    }

    saveRepos(repos);

    // Start async processing
    processRepo(job.id, repoUrl, repoId);

    res.json({
      jobId: job.id,
      repoId,
      status: 'queued',
      message: existing?.deleted ? 'Repo restored and re-analyzing' : 'Analysis started'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/repos/:id - Get repo details
router.get('/:id', (req, res) => {
  const repos = loadRepos();
  const repo = repos.find(r => r.id === req.params.id);

  if (!repo) {
    return res.status(404).json({ error: 'Repo not found' });
  }

  // Get job status
  const job = repo.jobId ? jobQueue.getJob(repo.jobId) : null;

  res.json({
    ...repo,
    job: job ? {
      status: job.status,
      progress: job.progress,
      message: job.message
    } : null
  });
});

// GET /api/repos/:id/analysis - Get raw analysis
router.get('/:id/analysis', (req, res) => {
  const analysis = codeAnalyzer.loadAnalysis(req.params.id);

  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  res.json(analysis);
});

// GET /api/repos/:id/enriched - Get enriched analysis (for frontend rendering)
router.get('/:id/enriched', (req, res) => {
  const enriched = enricher.loadEnrichedAnalysis(req.params.id);

  if (!enriched) {
    // Fall back to raw analysis
    const analysis = codeAnalyzer.loadAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    return res.json(analysis);
  }

  res.json(enriched);
});

// POST /api/repos/:id/rescan - Force re-analyze a repo
router.post('/:id/rescan', (req, res) => {
  const repos = loadRepos();
  const repo = repos.find(r => r.id === req.params.id);

  if (!repo) {
    return res.status(404).json({ error: 'Repo not found' });
  }

  // Create new job for re-analysis
  const job = jobQueue.createJob(repo.repoUrl);

  // Update repo state
  repo.jobId = job.id;
  repo.status = 'queued';
  repo.error = null;
  repo.rescannedAt = new Date().toISOString();
  saveRepos(repos);

  // Start async processing
  processRepo(job.id, repo.repoUrl, repo.id);

  console.log(`[${repo.id}] Rescan requested`);

  res.json({
    jobId: job.id,
    repoId: repo.id,
    status: 'queued',
    message: 'Rescan started'
  });
});

// DELETE /api/repos/:id - Soft delete a repo (marks as deleted, keeps data)
router.delete('/:id', (req, res) => {
  const repos = loadRepos();
  const repo = repos.find(r => r.id === req.params.id);

  if (!repo) {
    return res.status(404).json({ error: 'Repo not found' });
  }

  // Soft delete - just mark as deleted, keep all data
  repo.deleted = true;
  repo.deletedAt = new Date().toISOString();
  saveRepos(repos);

  console.log(`[${req.params.id}] Soft-deleted repo`);

  res.json({ success: true, message: 'Repo deleted (can be restored by re-adding)' });
});

// Async processing function
async function processRepo(jobId, repoUrl, repoId) {
  try {
    // Step 1: Fetch repo from GitHub
    jobQueue.setFetching(jobId);
    console.log(`[${repoId}] Fetching from GitHub...`);

    const repoData = await github.fetchRepo(repoUrl);
    updateRepoStatus(repoId, 'fetching');

    // Step 2: Analyze code structure
    jobQueue.setAnalyzing(jobId);
    console.log(`[${repoId}] Analyzing code...`);

    const analysis = await codeAnalyzer.analyze(repoData);
    updateRepoStatus(repoId, 'analyzing');

    // Step 3: Run security scanner
    console.log(`[${repoId}] Scanning for security issues...`);
    const securityFindings = securityScanner.scan(repoData.files);
    analysis.securityFindings = securityFindings;
    analysis.summary.securityFindingsCount = securityFindings.length;

    // Save raw analysis
    await codeAnalyzer.saveAnalysis(repoId, analysis);

    // Step 4: Enrich with Claude
    jobQueue.setEnriching(jobId);
    console.log(`[${repoId}] Enriching with AI...`);
    updateRepoStatus(repoId, 'enriching');

    const enriched = await enricher.enrich(analysis, repoData.files);

    // Save enriched analysis
    await enricher.saveEnrichedAnalysis(repoId, enriched);

    // Step 5: Complete
    jobQueue.setComplete(jobId, {
      repoId,
      summary: enriched.summary,
      healthScore: enriched.executiveSummary?.healthScore || 70
    });

    // Update repo with final data
    updateRepoWithAnalysis(repoId, enriched);

    console.log(`[${repoId}] Analysis complete!`);
  } catch (error) {
    console.error(`[${repoId}] Analysis failed:`, error);
    jobQueue.setFailed(jobId, error.message);
    updateRepoStatus(repoId, 'failed', error.message);
  }
}

// Update repo status
function updateRepoStatus(repoId, status, error = null) {
  const repos = loadRepos();
  const repo = repos.find(r => r.id === repoId);
  if (repo) {
    repo.status = status;
    if (error) repo.error = error;
    repo.updatedAt = new Date().toISOString();
    saveRepos(repos);
  }
}

// Update repo with analysis results
function updateRepoWithAnalysis(repoId, enriched) {
  const repos = loadRepos();
  const repo = repos.find(r => r.id === repoId);
  if (repo) {
    repo.status = 'complete';
    repo.healthScore = enriched.executiveSummary?.healthScore || 70;
    repo.summary = {
      headline: enriched.executiveSummary?.headline,
      framework: enriched.summary.framework,
      languages: enriched.summary.languages,
      fileCount: enriched.summary.fileCount,
      totalFiles: enriched.summary.totalFiles,
      nodeCount: enriched.summary.nodeCount,
      deadCodeCount: enriched.summary.deadCodeCount,
      securityFindingsCount: enriched.securityFindings?.length || 0,
      criticalCount: enriched.securityFindings?.filter(f => f.severity === 'critical').length || 0,
      highCount: enriched.securityFindings?.filter(f => f.severity === 'high').length || 0,
      estimatedTokens: enriched.summary.estimatedTokens,
      tokenLimitHit: enriched.summary.fileCount < enriched.summary.totalFiles
    };
    repo.updatedAt = new Date().toISOString();
    saveRepos(repos);
  }
}

module.exports = router;
