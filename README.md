# ASHVAA

**AI-powered codebase analysis and visualization tool.**

Analyze GitHub repositories to understand code architecture, detect security issues, identify dead code, and visualize dependency graphs.

## Features

- **Dependency Graph Visualization** — Interactive map of how files connect and depend on each other
- **Security Scanning** — Detects common vulnerabilities (SQL injection, XSS, etc.)
- **Dead Code Detection** — Finds exports that are never imported
- **AI-Powered Insights** — Claude enriches analysis with plain-English explanations
- **Health Scoring** — Overall codebase health score based on multiple factors

## Tech Stack

- **Frontend**: Vanilla JS, HTML, CSS (served statically)
- **Backend**: Node.js + Express
- **AI**: Claude API for code enrichment
- **Parsing**: Babel for JS/TS, custom parser for Python

## Quick Start

```bash
# Install dependencies
cd server
npm install

# Set up environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY and GITHUB_TOKEN to .env

# Start the server
node index.js

# Open in browser
open http://localhost:3001/dashboard.html
```

## Project Structure

```
├── project/              # Frontend files
│   ├── dashboard.html    # Main dashboard
│   ├── report.html       # Analysis report view
│   ├── app.js            # Frontend logic
│   └── shared-styles.css # Shared CSS
│
├── server/               # Backend
│   ├── index.js          # Express server
│   ├── routes/
│   │   └── repos.js      # API endpoints
│   └── services/
│       ├── github.js     # GitHub API integration
│       ├── codeAnalyzer.js   # AST parsing & analysis
│       ├── securityScanner.js # Vulnerability detection
│       ├── enricher.js   # Claude AI enrichment
│       └── jobQueue.js   # Background job processing
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/repos` | List all analyzed repos |
| POST | `/api/repos` | Submit repo for analysis |
| GET | `/api/repos/:id` | Get repo details |
| POST | `/api/repos/:id/rescan` | Force re-analysis |
| DELETE | `/api/repos/:id` | Soft delete repo |
| GET | `/api/repos/:id/enriched` | Get enriched analysis |
| GET | `/api/jobs/:id` | Get job status |

## How It Works

1. **Fetch** — Downloads repo files from GitHub (prioritizes shared code like components, lib, hooks)
2. **Analyze** — Parses AST to extract imports, exports, functions, classes
3. **Scan** — Runs security rules against the code
4. **Enrich** — Claude AI adds explanations, identifies patterns, calculates health score
5. **Visualize** — Renders interactive dependency graph with dagre layout

## Known Limitations

- Token limits mean large repos get partial analysis (~100k tokens max)
- Path alias resolution supports `@/`, `~/`, `#/` patterns (common in Next.js/Vite)
- Python support is basic (no virtual env resolution)

## License

MIT
