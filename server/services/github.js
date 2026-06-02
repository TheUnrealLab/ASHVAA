const { Octokit } = require('@octokit/rest');

// Initialize Octokit with optional auth
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined
});

// File importance scoring - higher score = fetched first
const FILE_SCORES = {
  // Critical - entry points & config (score: 100)
  critical: [
    /^package\.json$/,
    /^README\.md$/i,
    /^CLAUDE\.md$/i,
    /^tsconfig\.json$/,
    /^index\.(ts|js|tsx|jsx)$/,
    /^(app|main|server|cli)\.(ts|js|tsx|jsx)$/,
    /^src\/index\.(ts|js|tsx|jsx)$/,
    /^src\/main\.(ts|js|tsx|jsx)$/,
    /^src\/app\.(ts|js|tsx|jsx)$/,
    // Python critical
    /^requirements\.txt$/,
    /^pyproject\.toml$/,
    /^setup\.py$/,
    /^main\.py$/,
    /^app\.py$/,
    /^src\/main\.py$/,
    /^src\/app\.py$/,
    /^manage\.py$/,                // Django
    /^wsgi\.py$/,
    /^asgi\.py$/
  ],
  // High priority - shared code that pages/routes IMPORT FROM (score: 80)
  // These must be analyzed to understand the dependency graph!
  high: [
    /\/components?\//i,           // UI components (shared)
    /\/lib\//i,                   // Library/utility code (shared)
    /\/store\//i,                 // State management (shared)
    /\/stores?\//i,               // State stores (shared)
    /\/hooks?\//i,                // React hooks (shared)
    /\/utils?\//i,                // Utility functions (shared)
    /\/helpers?\//i,              // Helper functions (shared)
    /\/services?\//i,             // Service layer (shared)
    /\/context\//i,               // React context (shared)
    /\/providers?\//i,            // React providers (shared)
    /\/core\//i,                  // Core business logic
    /\/common\//i,                // Common/shared code
    /\/shared\//i,                // Shared code
    // Python shared
    /\/schemas?\//i,              // Pydantic schemas (shared)
    /\/models?\//i,               // Data models (shared)
  ],
  // Medium priority - pages, routes, API endpoints (score: 50)
  medium: [
    /^src\//i,                    // Any file in src/
    /^lib\//i,                    // Any file in lib/
    /^packages?\//i,              // Monorepo packages
    /\/routes?\//i,
    /\/api\//i,
    /\/pages\//i,
    /\/app\//i,                   // Next.js app directory
    /\/commands?\//i,             // CLI commands
    /\/handlers?\//i,             // Request handlers
    // Python medium
    /\/agents?\//i,               // AI agents
    /\/views?\//i,                // Django/Flask views
    /\/routers?\//i,              // FastAPI routers
    /\/endpoints?\//i,
    /\/controllers?\//i
  ],
  // Lower priority - supporting files (score: 25)
  low: [
    /\/db\//i,
    /\/prisma\//i,
    /schema\./i,
    /\/config\//i,
    /\/types?\//i,
    /\/interfaces?\//i,
    // Python low priority
    /\/migrations?\//i,
    /\/tasks?\//i,                // Celery tasks
    /\/middleware\//i
  ]
};

// Files to skip
const SKIP_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.next\//,
  /\.cache\//,
  /\.test\.(ts|js|tsx|jsx)$/,
  /\.spec\.(ts|js|tsx|jsx)$/,
  /__tests__\//,
  /^tests?\//i,              // Skip tests/ or test/ folders at root
  /\/tests?\//i,             // Skip tests/ or test/ folders anywhere
  /fixtures?\//i,            // Skip fixtures/ folders (test data)
  /\.d\.ts$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.stories\.(ts|js|tsx|jsx)$/,  // Skip Storybook files
  /\.mock\.(ts|js|tsx|jsx)$/,     // Skip mock files
  // Python skip patterns
  /__pycache__\//,
  /\.pyc$/,
  /\.pyo$/,
  /\.egg-info\//,
  /venv\//,
  /\.venv\//,
  /env\//,
  /\.env\//,
  /test_.*\.py$/,            // Python test files
  /.*_test\.py$/,
  /conftest\.py$/,
  /pytest\.ini$/
];

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py'  // Python support
];

// Parse GitHub URL to get owner and repo
function parseRepoUrl(url) {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?\#]+)/,
    /^([^\/]+)\/([^\/]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
      };
    }
  }

  throw new Error(`Invalid GitHub URL: ${url}`);
}

// Score a file for importance
function scoreFile(path) {
  // Skip certain files
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(path)) return -1;
  }

  // Check extension
  const ext = '.' + path.split('.').pop();
  const isSourceFile = SUPPORTED_EXTENSIONS.includes(ext.toLowerCase());

  if (!isSourceFile) {
    // Allow README and config files
    if (!/\.(json|md)$/i.test(path)) return -1;
  }

  // Score by priority (higher = fetched first)
  // Critical: entry points & config
  for (const pattern of FILE_SCORES.critical) {
    if (pattern.test(path)) return 100;
  }
  // High: shared code (components, lib, hooks, store, utils)
  for (const pattern of FILE_SCORES.high) {
    if (pattern.test(path)) return 80;
  }
  // Medium: pages, routes, API endpoints
  for (const pattern of FILE_SCORES.medium) {
    if (pattern.test(path)) return 50;
  }
  // Low: supporting files (types, config, migrations)
  for (const pattern of FILE_SCORES.low) {
    if (pattern.test(path)) return 25;
  }

  // TypeScript/JavaScript files that don't match patterns still get decent score
  if (isSourceFile) {
    return 20;
  }

  // Default score for other supported files (JSON, MD)
  return 5;
}

// Fetch repository tree
async function fetchTree(owner, repo, branch = 'main') {
  try {
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: 'true'
    });

    return data.tree.filter(item => item.type === 'blob');
  } catch (error) {
    // Try 'master' if 'main' fails
    if (branch === 'main') {
      return fetchTree(owner, repo, 'master');
    }
    throw error;
  }
}

// Fetch file content
async function fetchFile(owner, repo, path) {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path
    });

    // Decode base64 content
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch ${path}: ${error.message}`);
    return null;
  }
}

// Main fetch function - smart repo fetching
async function fetchRepo(repoUrl, options = {}) {
  const { maxFiles = 200, maxTokens = 100000 } = options;
  const { owner, repo } = parseRepoUrl(repoUrl);

  console.log(`Fetching repo: ${owner}/${repo}`);

  // Step 1: Get file tree (metadata only)
  const tree = await fetchTree(owner, repo);
  console.log(`Found ${tree.length} files in tree`);

  // Step 2: Score and sort files
  const scoredFiles = tree
    .map(file => ({
      ...file,
      score: scoreFile(file.path)
    }))
    .filter(file => file.score > 0)
    .sort((a, b) => b.score - a.score);

  console.log(`${scoredFiles.length} files after filtering and scoring`);

  // Step 3: Download top N files
  const filesToFetch = scoredFiles.slice(0, maxFiles);
  const files = {};
  let totalTokens = 0;

  for (const file of filesToFetch) {
    // Rough token estimate (4 chars per token)
    if (totalTokens > maxTokens) {
      console.log(`Token limit reached at ${Object.keys(files).length} files`);
      break;
    }

    const content = await fetchFile(owner, repo, file.path);
    if (content) {
      files[file.path] = content;
      totalTokens += Math.ceil(content.length / 4);
    }
  }

  console.log(`Fetched ${Object.keys(files).length} files, ~${totalTokens} tokens`);

  // Build summary
  const summary = {
    owner,
    repo,
    fileCount: Object.keys(files).length,
    totalFiles: tree.length,
    estimatedTokens: totalTokens,
    languages: detectLanguages(files),
    framework: detectFramework(files)
  };

  return {
    owner,
    repo,
    tree: scoredFiles.map(f => ({ path: f.path, score: f.score })),
    files,
    summary
  };
}

// Detect primary languages
function detectLanguages(files) {
  const extensions = {};
  for (const path of Object.keys(files)) {
    const ext = '.' + path.split('.').pop();
    extensions[ext] = (extensions[ext] || 0) + 1;
  }

  const sorted = Object.entries(extensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return sorted.map(([ext]) => {
    switch (ext) {
      case '.ts': case '.tsx': return 'TypeScript';
      case '.js': case '.jsx': return 'JavaScript';
      case '.py': return 'Python';
      case '.json': return 'JSON';
      default: return ext;
    }
  });
}

// Detect framework
function detectFramework(files) {
  // Check for Python frameworks first
  const requirements = files['requirements.txt'] || '';
  const pyproject = files['pyproject.toml'] || '';
  const pythonDeps = requirements + pyproject;

  if (pythonDeps) {
    if (/fastapi/i.test(pythonDeps)) return 'FastAPI';
    if (/django/i.test(pythonDeps)) return 'Django';
    if (/flask/i.test(pythonDeps)) return 'Flask';
    if (/streamlit/i.test(pythonDeps)) return 'Streamlit';
    if (/langchain/i.test(pythonDeps)) return 'LangChain';
    if (/openai/i.test(pythonDeps)) return 'OpenAI SDK';

    // Check if it's a Python project without specific framework
    const hasPythonFiles = Object.keys(files).some(f => f.endsWith('.py'));
    if (hasPythonFiles) return 'Python';
  }

  // Check for Node.js frameworks
  const packageJson = files['package.json'];
  if (!packageJson) {
    // Check if it's a pure Python project
    const hasPythonFiles = Object.keys(files).some(f => f.endsWith('.py'));
    if (hasPythonFiles) return 'Python';
    return 'Unknown';
  }

  try {
    const pkg = JSON.parse(packageJson);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) return 'Next.js';
    if (deps.react && deps['react-dom']) return 'React';
    if (deps.vue) return 'Vue';
    if (deps.express) return 'Express';
    if (deps.fastify) return 'Fastify';
    if (deps.koa) return 'Koa';
    if (deps.nest) return 'NestJS';

    return 'Node.js';
  } catch {
    return 'Unknown';
  }
}

module.exports = {
  parseRepoUrl,
  fetchRepo,
  fetchTree,
  fetchFile
};
