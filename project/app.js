// STRATUM Frontend Application
// API client and UI rendering

const API_BASE = 'http://localhost:3001/api';

// ════════ API CLIENT ════════

const api = {
  // Fetch all repos
  async getRepos() {
    const res = await fetch(`${API_BASE}/repos`);
    if (!res.ok) throw new Error('Failed to fetch repos');
    return res.json();
  },

  // Get single repo details
  async getRepo(id) {
    const res = await fetch(`${API_BASE}/repos/${id}`);
    if (!res.ok) throw new Error('Repo not found');
    return res.json();
  },

  // Submit new repo for analysis
  async submitRepo(repoUrl) {
    const res = await fetch(`${API_BASE}/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit repo');
    }
    return res.json();
  },

  // Get job status
  async getJob(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error('Job not found');
    return res.json();
  },

  // Get enriched analysis for rendering
  async getEnrichedAnalysis(repoId) {
    const res = await fetch(`${API_BASE}/repos/${repoId}/enriched`);
    if (!res.ok) throw new Error('Analysis not found');
    return res.json();
  },

  // Delete a repo
  async deleteRepo(id) {
    const res = await fetch(`${API_BASE}/repos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete repo');
    return res.json();
  },

  // Rescan a repo (force re-analysis)
  async rescanRepo(id) {
    const res = await fetch(`${API_BASE}/repos/${id}/rescan`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to start rescan');
    return res.json();
  }
};

// ════════ DASHBOARD ════════

const dashboard = {
  repos: [],
  pollIntervals: {},

  async init() {
    await this.loadRepos();
    this.bindEvents();
  },

  async loadRepos() {
    try {
      this.repos = await api.getRepos();
      this.render();
      this.updateStats();
      this.checkPartialScans();

      // Start polling for any in-progress jobs
      this.repos.forEach(repo => {
        if (repo.status !== 'complete' && repo.status !== 'failed' && repo.jobId) {
          this.startPolling(repo.id, repo.jobId);
        }
      });
    } catch (error) {
      console.error('Failed to load repos:', error);
      this.showError('Failed to load projects');
    }
  },

  render() {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;

    const cards = this.repos.map(repo => this.renderCard(repo)).join('');
    const addCard = this.renderAddCard();

    grid.innerHTML = cards + addCard;
  },

  renderCard(repo) {
    const isLoading = !['complete', 'failed'].includes(repo.status);
    const healthClass = this.getHealthClass(repo.healthScore);

    if (isLoading) {
      return `
        <div class="project-card-wrapper" data-id="${repo.id}">
          <div class="project-card loading">
            <div class="card-content">
              <div class="card-header">
                <div>
                  <h3 class="card-title">${repo.owner}/${repo.repo}</h3>
                  <p class="card-sub">${this.getStatusMessage(repo.status)}</p>
                </div>
                <div class="spinner"></div>
              </div>
              <div class="card-stats" style="visibility: hidden;">
                <div class="stat-mini"><span class="stat-value">--</span><span class="stat-label">Files</span></div>
                <div class="stat-mini"><span class="stat-value">--</span><span class="stat-label">Nodes</span></div>
                <div class="stat-mini"><span class="stat-value">--</span><span class="stat-label">Issues</span></div>
              </div>
              <div class="progress mt-auto">
                <div class="progress-bar" style="width: ${this.getProgress(repo.status)}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (repo.status === 'failed') {
      return `
        <div class="project-card-wrapper" data-id="${repo.id}">
          <div class="project-card failed">
            <div class="card-content">
              <div class="card-header">
                <div>
                  <h3 class="card-title">${repo.owner}/${repo.repo}</h3>
                  <p class="card-sub text-acc">Analysis failed</p>
                </div>
                <button class="btn btn-sm" onclick="event.stopPropagation(); dashboard.retryRepo('${repo.id}')">Retry</button>
              </div>
              <p class="card-error">${repo.error || 'Unknown error'}</p>
              <div class="card-badges" style="margin-top: auto;"></div>
            </div>
          </div>
          <button class="card-delete-btn" onclick="event.stopPropagation(); dashboard.deleteRepo('${repo.id}')" title="Delete repo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
            </svg>
          </button>
        </div>
      `;
    }

    const summary = repo.summary || {};
    const partialScan = summary.tokenLimitHit || (summary.totalFiles && summary.fileCount < summary.totalFiles);

    return `
      <div class="project-card-wrapper" data-id="${repo.id}">
        <a href="report.html?id=${repo.id}" class="project-card">
          <div class="card-content">
            <div class="card-header">
              <div>
                <h3 class="card-title">${repo.owner}/${repo.repo}</h3>
                <p class="card-sub">${summary.headline || summary.framework || 'JavaScript'}</p>
              </div>
              <div class="health-score ${healthClass}">${repo.healthScore || '--'}</div>
            </div>
            <div class="card-stats">
              <div class="stat-mini">
                <span class="stat-value">${summary.fileCount || 0}${summary.totalFiles ? '/' + summary.totalFiles : ''}</span>
                <span class="stat-label">Files</span>
              </div>
              <div class="stat-mini">
                <span class="stat-value">${summary.nodeCount || 0}</span>
                <span class="stat-label">Nodes</span>
              </div>
              <div class="stat-mini">
                <span class="stat-value">${summary.securityFindingsCount || 0}</span>
                <span class="stat-label">Issues</span>
              </div>
            </div>
            <div class="card-badges">
              ${partialScan ? `<span class="badge badge-info" title="Token limit reached - not all files were analyzed">Partial</span>` : ''}
              ${summary.criticalCount > 0 ? `<span class="badge badge-critical">${summary.criticalCount} Critical</span>` : ''}
              ${summary.highCount > 0 ? `<span class="badge badge-high">${summary.highCount} High</span>` : ''}
              ${summary.deadCodeCount > 0 ? `<span class="badge badge-medium">${summary.deadCodeCount} Dead</span>` : ''}
            </div>
          </div>
        </a>
        <button class="card-rescan-btn" onclick="event.stopPropagation(); dashboard.rescanRepo('${repo.id}')" title="Rescan repo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button class="card-delete-btn" onclick="event.stopPropagation(); dashboard.deleteRepo('${repo.id}')" title="Delete repo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
          </svg>
        </button>
      </div>
    `;
  },

  renderAddCard() {
    return `
      <div class="project-card-wrapper">
        <button class="project-card add-card" onclick="dashboard.openModal()">
          <div class="add-icon">+</div>
          <span>Add Repository</span>
        </button>
      </div>
    `;
  },

  updateStats() {
    const totalEl = document.getElementById('statTotal');
    const issuesEl = document.getElementById('statIssues');
    const criticalEl = document.getElementById('statCritical');

    if (totalEl) totalEl.textContent = this.repos.length;

    const totalIssues = this.repos.reduce((sum, r) =>
      sum + (r.summary?.securityFindingsCount || 0), 0);
    if (issuesEl) issuesEl.textContent = totalIssues;

    const criticalCount = this.repos.reduce((sum, r) =>
      sum + (r.summary?.criticalCount || 0), 0);
    if (criticalEl) criticalEl.textContent = criticalCount;
  },

  getHealthClass(score) {
    if (!score) return '';
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'bad';
  },

  getStatusMessage(status) {
    const messages = {
      queued: 'Queued for analysis...',
      fetching: 'Fetching from GitHub...',
      analyzing: 'Analyzing code structure...',
      enriching: 'Enriching with AI...'
    };
    return messages[status] || 'Processing...';
  },

  getProgress(status) {
    const progress = {
      queued: 5,
      fetching: 20,
      analyzing: 50,
      enriching: 80
    };
    return progress[status] || 10;
  },

  bindEvents() {
    // Modal close on overlay click
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }

    // Form submission
    const form = document.getElementById('repoForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  openModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('active');
    const input = document.getElementById('repoUrl');
    if (input) input.focus();
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    const form = document.getElementById('repoForm');
    if (form) form.reset();
    this.clearError();
  },

  async handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('repoUrl');
    const btn = document.getElementById('submitBtn');
    const repoUrl = input.value.trim();

    if (!repoUrl) {
      this.showFormError('Please enter a GitHub URL');
      return;
    }

    // Validate GitHub URL
    if (!repoUrl.includes('github.com') && !repoUrl.match(/^[\w-]+\/[\w-]+$/)) {
      this.showFormError('Please enter a valid GitHub URL or owner/repo');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';

    try {
      const result = await api.submitRepo(repoUrl);
      this.closeModal();

      // Add to local state and render
      if (result.repoId) {
        const newRepo = {
          id: result.repoId,
          owner: result.repoId.split('-')[0],
          repo: result.repoId.split('-').slice(1).join('-'),
          jobId: result.jobId,
          status: result.status,
          createdAt: new Date().toISOString()
        };

        // Check if already exists
        const existing = this.repos.find(r => r.id === result.repoId);
        if (!existing) {
          this.repos.unshift(newRepo);
        }

        this.render();
        this.startPolling(result.repoId, result.jobId);
      }
    } catch (error) {
      this.showFormError(error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Analyze Repository';
    }
  },

  startPolling(repoId, jobId) {
    // Clear existing interval
    if (this.pollIntervals[repoId]) {
      clearInterval(this.pollIntervals[repoId]);
    }

    // Poll every 2 seconds
    this.pollIntervals[repoId] = setInterval(async () => {
      try {
        const job = await api.getJob(jobId);

        // Update local state
        const repo = this.repos.find(r => r.id === repoId);
        if (repo) {
          repo.status = job.status;

          if (job.status === 'complete') {
            // Fetch full repo data
            const fullRepo = await api.getRepo(repoId);
            Object.assign(repo, fullRepo);
            this.stopPolling(repoId);
          } else if (job.status === 'failed') {
            repo.error = job.error;
            this.stopPolling(repoId);
          }

          this.render();
          this.updateStats();
        }
      } catch (error) {
        console.error('Polling error:', error);
        this.stopPolling(repoId);
      }
    }, 2000);
  },

  stopPolling(repoId) {
    if (this.pollIntervals[repoId]) {
      clearInterval(this.pollIntervals[repoId]);
      delete this.pollIntervals[repoId];
    }
  },

  async retryRepo(repoId) {
    const repo = this.repos.find(r => r.id === repoId);
    if (!repo) return;

    try {
      const result = await api.submitRepo(`https://github.com/${repo.owner}/${repo.repo}`);
      repo.jobId = result.jobId;
      repo.status = 'queued';
      repo.error = null;
      this.render();
      this.startPolling(repoId, result.jobId);
    } catch (error) {
      this.showError('Failed to retry: ' + error.message);
    }
  },

  async rescanRepo(repoId) {
    const repo = this.repos.find(r => r.id === repoId);
    if (!repo) return;

    try {
      const result = await api.rescanRepo(repoId);
      repo.jobId = result.jobId;
      repo.status = 'queued';
      repo.error = null;
      this.render();
      this.startPolling(repoId, result.jobId);
      this.showToast('Rescan started for ' + repo.owner + '/' + repo.repo);
    } catch (error) {
      this.showError('Failed to rescan: ' + error.message);
    }
  },

  async deleteRepo(repoId) {
    const repo = this.repos.find(r => r.id === repoId);
    if (!repo) return;

    // Confirm deletion
    if (!confirm(`Delete ${repo.owner}/${repo.repo}? You can re-add it later.`)) {
      return;
    }

    try {
      await api.deleteRepo(repoId);
      // Remove from local state
      this.repos = this.repos.filter(r => r.id !== repoId);
      this.render();
      this.updateStats();
    } catch (error) {
      this.showError('Failed to delete: ' + error.message);
    }
  },

  showFormError(message) {
    const errorEl = document.getElementById('formError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  },

  clearError() {
    const errorEl = document.getElementById('formError');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  },

  showError(message) {
    console.error(message);
    this.showToast(message, 'error');
  },

  showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Auto-hide after 4 seconds
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
  },

  checkPartialScans() {
    const partialRepos = this.repos.filter(r =>
      r.status === 'complete' && r.summary?.tokenLimitHit
    );

    if (partialRepos.length > 0) {
      this.showPartialScanBanner(partialRepos.length);
    }
  },

  showPartialScanBanner(count) {
    // Only show once per session
    if (this.partialBannerShown) return;
    this.partialBannerShown = true;

    const existing = document.querySelector('.partial-scan-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.className = 'partial-scan-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>
          <strong>${count} repo${count > 1 ? 's have' : ' has'} partial analysis</strong> —
          Token limits mean not all files were scanned. This is a work in progress.
          <a href="#" onclick="dashboard.dismissBanner(event)">Dismiss</a>
        </span>
      </div>
    `;

    const main = document.querySelector('main') || document.body;
    main.insertBefore(banner, main.firstChild);

    setTimeout(() => banner.classList.add('show'), 10);
  },

  dismissBanner(e) {
    e.preventDefault();
    const banner = document.querySelector('.partial-scan-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 300);
    }
  }
};

// ════════ REPORT PAGE ════════

const report = {
  repoId: null,
  analysis: null,
  selectedNode: null,
  svg: null,
  nodesGroup: null,
  edgesGroup: null,
  nodePositions: {},  // Store node positions for dragging
  viewBox: { x: 0, y: 0, w: 1000, h: 800 },
  draggingNode: null,
  isPanning: false,
  panStart: { x: 0, y: 0 },

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.repoId = params.get('id');

    if (!this.repoId) {
      window.location.href = 'dashboard.html';
      return;
    }

    await this.loadAnalysis();
    this.bindEvents();
  },

  async loadAnalysis() {
    try {
      this.analysis = await api.getEnrichedAnalysis(this.repoId);
      this.renderHeader();
      this.renderSidebar();
      this.renderMap();
    } catch (error) {
      console.error('Failed to load analysis:', error);
      document.getElementById('mapContainer').innerHTML =
        '<p class="text-mut" style="padding:40px;">Failed to load analysis. Try refreshing.</p>';
    }
  },

  renderHeader() {
    const titleEl = document.getElementById('repoTitle');
    const subtitleEl = document.getElementById('repoSubtitle');

    if (titleEl && this.analysis.fingerprint) {
      titleEl.textContent = `${this.analysis.fingerprint.owner}/${this.analysis.fingerprint.repo}`;
    }
    if (subtitleEl && this.analysis.executiveSummary) {
      subtitleEl.textContent = this.analysis.executiveSummary.headline || '';
    }
  },

  renderSidebar() {
    const summaryEl = document.getElementById('summaryPanel');
    if (!summaryEl || !this.analysis) return;

    const { summary, executiveSummary, securityFindings, deadCode } = this.analysis;
    const healthClass = dashboard.getHealthClass(executiveSummary?.healthScore);

    summaryEl.innerHTML = `
      <div class="sidebar-section">
        <div class="flex-between mb-md">
          <span class="kick">Health Score</span>
          <div class="health-score ${healthClass}">${executiveSummary?.healthScore || '--'}</div>
        </div>
        ${executiveSummary?.architecture ? `<p class="text-mut">${executiveSummary.architecture}</p>` : ''}
      </div>

      <div class="sidebar-section">
        <h4 class="kick mb-md">Statistics</h4>
        <div class="sidebar-stats">
          <div class="sidebar-stat">
            <span class="stat-value">${summary?.fileCount || 0}</span>
            <span class="stat-label">Files</span>
          </div>
          <div class="sidebar-stat">
            <span class="stat-value">${summary?.nodeCount || 0}</span>
            <span class="stat-label">Nodes</span>
          </div>
          <div class="sidebar-stat">
            <span class="stat-value">${summary?.edgeCount || 0}</span>
            <span class="stat-label">Edges</span>
          </div>
          <div class="sidebar-stat">
            <span class="stat-value">${summary?.deadCodeCount || 0}</span>
            <span class="stat-label">Dead Code</span>
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <h4 class="kick mb-md">Security Findings</h4>
        ${this.renderSecuritySummary(securityFindings)}
      </div>

      ${deadCode?.length ? `
        <div class="sidebar-section">
          <h4 class="kick mb-md">Dead Code Found</h4>
          <ul class="sidebar-list concerns">
            ${deadCode.slice(0, 5).map(d => `<li><code>${d.name}</code> in ${d.file}</li>`).join('')}
            ${deadCode.length > 5 ? `<li class="text-faint">+ ${deadCode.length - 5} more...</li>` : ''}
          </ul>
        </div>
      ` : ''}

      ${executiveSummary?.strengths?.length ? `
        <div class="sidebar-section">
          <h4 class="kick mb-md">Strengths</h4>
          <ul class="sidebar-list">
            ${executiveSummary.strengths.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${executiveSummary?.concerns?.length ? `
        <div class="sidebar-section">
          <h4 class="kick mb-md">Concerns</h4>
          <ul class="sidebar-list concerns">
            ${executiveSummary.concerns.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="sidebar-section">
        <h4 class="kick mb-md">Controls</h4>
        <p class="text-faint" style="font-size:12px;">
          Scroll to zoom<br>
          Drag background to pan<br>
          Drag nodes to reposition<br>
          Click node for details
        </p>
      </div>
    `;
  },

  renderSecuritySummary(findings) {
    if (!findings || findings.length === 0) {
      return '<p class="text-mut">No security issues found</p>';
    }

    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const medium = findings.filter(f => f.severity === 'medium').length;

    let html = `<div class="flex gap-sm flex-wrap mb-md">
      ${critical > 0 ? `<span class="badge badge-critical">${critical} Critical</span>` : ''}
      ${high > 0 ? `<span class="badge badge-high">${high} High</span>` : ''}
      ${medium > 0 ? `<span class="badge badge-medium">${medium} Medium</span>` : ''}
    </div>`;

    // Show first few findings with details
    html += '<ul class="sidebar-list concerns">';
    findings.slice(0, 3).forEach(f => {
      html += `<li><strong>${f.title}</strong><br><code style="font-size:10px;">${f.file}:${f.line}</code></li>`;
    });
    if (findings.length > 3) {
      html += `<li class="text-faint">+ ${findings.length - 3} more issues...</li>`;
    }
    html += '</ul>';

    return html;
  },

  renderMap() {
    const container = document.getElementById('mapContainer');
    if (!container || !this.analysis) return;

    // Use dagre for initial layout
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 180;
    const nodeHeight = 90;

    // Add nodes
    this.analysis.nodes.forEach(node => {
      g.setNode(node.id, { label: node.label, width: nodeWidth, height: nodeHeight, ...node });
    });

    // Add edges
    this.analysis.edges.forEach(edge => {
      g.setEdge(edge.from, edge.to, edge);
    });

    // Compute layout
    dagre.layout(g);

    // Store positions
    g.nodes().forEach(id => {
      const node = g.node(id);
      this.nodePositions[id] = { x: node.x, y: node.y, w: nodeWidth, h: nodeHeight };
    });

    // Calculate viewBox
    let maxX = 0, maxY = 0;
    g.nodes().forEach(id => {
      const pos = this.nodePositions[id];
      maxX = Math.max(maxX, pos.x + pos.w / 2 + 60);
      maxY = Math.max(maxY, pos.y + pos.h / 2 + 60);
    });
    this.viewBox = { x: 0, y: 0, w: Math.max(maxX, 800), h: Math.max(maxY, 600) };

    // Create SVG
    container.innerHTML = '';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.shapeRendering = 'geometricPrecision';
    this.updateViewBox();

    // Defs for markers
    this.svg.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
          <path d="M0,0 L12,4 L0,8 L3,4 Z" fill="#8a8a8a"/>
        </marker>
        <marker id="arrow-critical" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
          <path d="M0,0 L12,4 L0,8 L3,4 Z" fill="#D4AF37"/>
        </marker>
        <marker id="arrow-api" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
          <path d="M0,0 L12,4 L0,8 L3,4 Z" fill="#ff6b9d"/>
        </marker>
      </defs>
    `;

    // Create groups for edges (behind) and nodes (front)
    this.edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.edgesGroup.setAttribute('class', 'edges-layer');
    this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesGroup.setAttribute('class', 'nodes-layer');

    this.svg.appendChild(this.edgesGroup);
    this.svg.appendChild(this.nodesGroup);

    // Render edges
    this.renderEdges(g);

    // Render nodes
    this.renderNodes(g);

    container.appendChild(this.svg);

    // Setup interactions
    this.setupInteractions(container);
  },

  renderEdges(g) {
    this.edgesGroup.innerHTML = '';

    g.edges().forEach(e => {
      const edge = g.edge(e);
      const fromPos = this.nodePositions[e.v];
      const toPos = this.nodePositions[e.w];

      if (!fromPos || !toPos) return;

      // Calculate edge points
      const x1 = fromPos.x + fromPos.w / 2;
      const y1 = fromPos.y;
      const x2 = toPos.x - toPos.w / 2;
      const y2 = toPos.y;

      // Create curved path
      const midX = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

      const color = edge.kind === 'critical' ? '#D4AF37' : edge.kind === 'api' ? '#ff6b9d' : '#555';
      const marker = edge.kind === 'critical' ? 'arrow-critical' : edge.kind === 'api' ? 'arrow-api' : 'arrow';

      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', edge.kind === 'critical' ? '2.5' : '1.5');
      path.setAttribute('marker-end', `url(#${marker})`);
      path.setAttribute('data-from', e.v);
      path.setAttribute('data-to', e.w);

      // Edge label
      if (edge.label) {
        const labelX = midX;
        const labelY = (y1 + y2) / 2 - 8;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#8a8a8a');
        text.setAttribute('font-size', '9');
        text.setAttribute('font-family', 'monospace');
        text.textContent = edge.label;
        this.edgesGroup.appendChild(text);
      }

      this.edgesGroup.appendChild(path);
    });
  },

  renderNodes(g) {
    this.nodesGroup.innerHTML = '';

    g.nodes().forEach(id => {
      const node = g.node(id);
      const pos = this.nodePositions[id];

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'map-node');
      group.setAttribute('data-id', id);
      group.setAttribute('transform', `translate(${pos.x - pos.w/2}, ${pos.y - pos.h/2})`);
      group.style.cursor = 'grab';

      // Node background
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', pos.w);
      rect.setAttribute('height', pos.h);
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', '#1a1a1a');
      rect.setAttribute('stroke', this.getClusterColor(node.cluster));
      rect.setAttribute('stroke-width', node.critical ? '2.5' : '1.5');

      // Node label (filename)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pos.w / 2);
      label.setAttribute('y', 28);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#e8e8e8');
      label.setAttribute('font-family', 'monospace');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '500');
      label.textContent = node.label.length > 22 ? node.label.slice(0, 20) + '...' : node.label;

      // Sub-label (cluster or role hint)
      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', pos.w / 2);
      sub.setAttribute('y', 48);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('fill', node.dead ? '#E0A93B' : '#8a8a8a');
      sub.setAttribute('font-family', 'monospace');
      sub.setAttribute('font-size', '10');
      sub.textContent = node.dead ? 'DEAD CODE' : (node.cluster || '').toUpperCase();

      // Function count badge
      if (node.functions?.length > 0) {
        const fnBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        fnBadge.setAttribute('x', pos.w / 2);
        fnBadge.setAttribute('y', 68);
        fnBadge.setAttribute('text-anchor', 'middle');
        fnBadge.setAttribute('fill', '#666');
        fnBadge.setAttribute('font-family', 'monospace');
        fnBadge.setAttribute('font-size', '9');
        fnBadge.textContent = `${node.functions.length} fn · ${node.exports?.length || 0} exports`;
        group.appendChild(fnBadge);
      }

      // Critical path indicator
      if (node.critical) {
        const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        star.setAttribute('cx', pos.w - 12);
        star.setAttribute('cy', '12');
        star.setAttribute('r', '5');
        star.setAttribute('fill', '#D4AF37');
        group.appendChild(star);
      }

      // Dead code indicator
      if (node.dead) {
        const deadDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        deadDot.setAttribute('cx', '12');
        deadDot.setAttribute('cy', '12');
        deadDot.setAttribute('r', '5');
        deadDot.setAttribute('fill', '#E0A93B');
        group.appendChild(deadDot);
      }

      group.appendChild(rect);
      group.appendChild(label);
      group.appendChild(sub);

      // Node events
      group.addEventListener('mousedown', (e) => this.startNodeDrag(e, id, node));
      group.addEventListener('click', (e) => {
        if (!this.draggingNode) this.selectNode(node);
      });

      this.nodesGroup.appendChild(group);
    });
  },

  updateViewBox() {
    const { x, y, w, h } = this.viewBox;
    this.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  },

  getClusterColor(cluster) {
    const colors = {
      entry: '#4ea1ff',
      routes: '#7bd389',
      services: '#c792ea',
      data: '#ffb86b',
      components: '#4ea1ff',
      pages: '#4ea1ff',
      hooks: '#c792ea',
      config: '#666',
      external: '#ff6b9d',
      other: '#8a8a8a'
    };
    return colors[cluster] || colors.other;
  },

  setupInteractions(container) {
    // Wheel zoom (crisp - modifies viewBox)
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert mouse position to SVG coordinates
      const svgX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.w;
      const svgY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.h;

      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const newW = this.viewBox.w * factor;
      const newH = this.viewBox.h * factor;

      // Limit zoom
      if (newW < 200 || newW > 5000) return;

      // Zoom centered on cursor
      this.viewBox.x = svgX - (mouseX / rect.width) * newW;
      this.viewBox.y = svgY - (mouseY / rect.height) * newH;
      this.viewBox.w = newW;
      this.viewBox.h = newH;

      this.updateViewBox();
    });

    // Pan with drag on background
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.map-node')) return;
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const rect = container.getBoundingClientRect();
        const dx = (e.clientX - this.panStart.x) * (this.viewBox.w / rect.width);
        const dy = (e.clientY - this.panStart.y) * (this.viewBox.h / rect.height);

        this.viewBox.x -= dx;
        this.viewBox.y -= dy;
        this.updateViewBox();

        this.panStart = { x: e.clientX, y: e.clientY };
      }

      if (this.draggingNode) {
        this.dragNode(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.draggingNode = null;
      container.style.cursor = 'default';
      document.querySelectorAll('.map-node').forEach(n => n.style.cursor = 'grab');
    });
  },

  startNodeDrag(e, nodeId, nodeData) {
    e.stopPropagation();
    const container = document.getElementById('mapContainer');
    const rect = container.getBoundingClientRect();

    this.draggingNode = {
      id: nodeId,
      data: nodeData,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { ...this.nodePositions[nodeId] }
    };

    e.target.closest('.map-node').style.cursor = 'grabbing';
  },

  dragNode(e) {
    if (!this.draggingNode) return;

    const container = document.getElementById('mapContainer');
    const rect = container.getBoundingClientRect();

    // Convert mouse delta to SVG coordinates
    const dx = (e.clientX - this.draggingNode.startMouse.x) * (this.viewBox.w / rect.width);
    const dy = (e.clientY - this.draggingNode.startMouse.y) * (this.viewBox.h / rect.height);

    // Update position
    const pos = this.nodePositions[this.draggingNode.id];
    pos.x = this.draggingNode.startPos.x + dx;
    pos.y = this.draggingNode.startPos.y + dy;

    // Update node transform
    const group = document.querySelector(`.map-node[data-id="${this.draggingNode.id}"]`);
    if (group) {
      group.setAttribute('transform', `translate(${pos.x - pos.w/2}, ${pos.y - pos.h/2})`);
    }

    // Redraw edges connected to this node
    this.updateEdgesForNode(this.draggingNode.id);
  },

  updateEdgesForNode(nodeId) {
    // Find and update all edges connected to this node
    document.querySelectorAll(`path[data-from="${nodeId}"], path[data-to="${nodeId}"]`).forEach(path => {
      const fromId = path.getAttribute('data-from');
      const toId = path.getAttribute('data-to');
      const fromPos = this.nodePositions[fromId];
      const toPos = this.nodePositions[toId];

      if (!fromPos || !toPos) return;

      const x1 = fromPos.x + fromPos.w / 2;
      const y1 = fromPos.y;
      const x2 = toPos.x - toPos.w / 2;
      const y2 = toPos.y;
      const midX = (x1 + x2) / 2;

      path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    });
  },

  selectNode(node) {
    this.selectedNode = node;

    // Highlight selected
    document.querySelectorAll('.map-node rect').forEach(rect => {
      rect.setAttribute('stroke-width', '1.5');
    });
    const selected = document.querySelector(`.map-node[data-id="${node.id}"] rect`);
    if (selected) {
      selected.setAttribute('stroke-width', '3');
    }

    this.renderNodeDetails(node);
  },

  renderNodeDetails(node) {
    const panel = document.getElementById('nodePanel');
    if (!panel) return;

    // Find related security findings
    const findings = this.analysis.securityFindings?.filter(f => f.file === node.path) || [];

    // Build imports/exports info
    const importsHtml = node.imports?.length ? `
      <div class="node-section">
        <h4 class="kick">Imports</h4>
        <ul class="node-notes">
          ${node.imports.slice(0, 5).map(i => `<li><code>${i.source}</code></li>`).join('')}
          ${node.imports.length > 5 ? `<li class="text-faint">+ ${node.imports.length - 5} more</li>` : ''}
        </ul>
      </div>
    ` : '';

    const exportsHtml = node.exports?.length ? `
      <div class="node-section">
        <h4 class="kick">Exports</h4>
        <div class="node-exports">
          ${node.exports.map(e => `<span class="badge">${e.name}${e.line ? ':' + e.line : ''}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const functionsHtml = node.functions?.length ? `
      <div class="node-section">
        <h4 class="kick">Functions</h4>
        <ul class="node-notes">
          ${node.functions.map(f => `<li><code>${f.name}()</code> <span class="text-faint">line ${f.line}</span></li>`).join('')}
        </ul>
      </div>
    ` : '';

    const findingsHtml = findings.length ? `
      <div class="node-section">
        <h4 class="kick">Security Issues</h4>
        <ul class="node-notes concerns">
          ${findings.map(f => `<li><strong>${f.title}</strong><br>Line ${f.line}: ${f.description}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="node-panel-header">
        <span class="kick">Node Details</span>
        <button class="node-panel-close" id="closeNodePanel">&times;</button>
      </div>
      <div class="node-detail">
        <h3 class="node-title">${node.label}</h3>
        <p class="node-path mono" style="word-break:break-all;">${node.path}</p>

        ${node.role ? `
          <div class="node-section">
            <h4 class="kick">Role</h4>
            <p>${node.role}</p>
          </div>
        ` : ''}

        ${node.plain ? `
          <div class="node-section">
            <h4 class="kick">Plain English</h4>
            <p class="text-mut">${node.plain}</p>
          </div>
        ` : ''}

        ${node.notes?.length ? `
          <div class="node-section">
            <h4 class="kick">Notes</h4>
            <ul class="node-notes">
              ${node.notes.map(n => `<li class="mono">${n}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${functionsHtml}
        ${exportsHtml}
        ${importsHtml}
        ${findingsHtml}

        <div class="node-meta">
          ${node.critical ? '<span class="badge badge-critical">Critical Path</span>' : ''}
          ${node.dead ? '<span class="badge badge-medium">Dead Code</span>' : ''}
          <span class="badge">${node.cluster}</span>
          ${node.importDepth ? `<span class="badge">${node.importDepth} importers</span>` : ''}
        </div>
      </div>
    `;

    panel.classList.add('active');

    // Re-bind close button
    document.getElementById('closeNodePanel')?.addEventListener('click', () => {
      panel.classList.remove('active');
      document.querySelectorAll('.map-node rect').forEach(rect => {
        rect.setAttribute('stroke-width', '1.5');
      });
    });
  },

  zoomIn() {
    this.viewBox.w *= 0.8;
    this.viewBox.h *= 0.8;
    this.updateViewBox();
  },

  zoomOut() {
    this.viewBox.w *= 1.25;
    this.viewBox.h *= 1.25;
    this.updateViewBox();
  },

  resetView() {
    // Recalculate viewBox from node positions
    let maxX = 0, maxY = 0;
    Object.values(this.nodePositions).forEach(pos => {
      maxX = Math.max(maxX, pos.x + pos.w / 2 + 60);
      maxY = Math.max(maxY, pos.y + pos.h / 2 + 60);
    });
    this.viewBox = { x: 0, y: 0, w: Math.max(maxX, 800), h: Math.max(maxY, 600) };
    this.updateViewBox();
  },

  bindEvents() {
    const closeBtn = document.getElementById('closeNodePanel');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('nodePanel').classList.remove('active');
        document.querySelectorAll('.map-node rect').forEach(rect => {
          rect.setAttribute('stroke-width', '1.5');
        });
      });
    }
  }
};

// ════════ INITIALIZATION ════════

document.addEventListener('DOMContentLoaded', () => {
  // Determine which page we're on
  if (document.getElementById('projectGrid')) {
    dashboard.init();
  } else if (document.getElementById('mapContainer')) {
    report.init();
  }
});
