const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

// Parse a Python file using regex (basic support, tree-sitter coming later)
function parsePythonFile(content, filePath) {
  const result = {
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    apiCalls: [],
    hasDefaultExport: false
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match: import x, import x.y, import x as y
    const importMatch = line.match(/^import\s+([\w\.]+)(?:\s+as\s+(\w+))?/);
    if (importMatch) {
      result.imports.push({
        source: importMatch[1],
        specifiers: [{ local: importMatch[2] || importMatch[1].split('.').pop(), imported: 'module', type: 'import' }],
        line: lineNum
      });
    }

    // Match: from x import y, z, ...
    const fromImportMatch = line.match(/^from\s+([\w\.]+)\s+import\s+(.+)/);
    if (fromImportMatch) {
      const source = fromImportMatch[1];
      const items = fromImportMatch[2].split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        return { local: parts[1] || parts[0], imported: parts[0].trim(), type: 'named' };
      });
      result.imports.push({
        source,
        specifiers: items,
        line: lineNum
      });
    }

    // Match: def function_name(...)
    const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const isPublic = !funcName.startsWith('_');
      result.functions.push({
        name: funcName,
        line: lineNum,
        exported: isPublic
      });
      if (isPublic) {
        result.exports.push({
          name: funcName,
          type: 'function',
          line: lineNum
        });
      }
    }

    // Match: class ClassName:
    const classMatch = line.match(/^class\s+(\w+)(?:\s*\(.*\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      const isPublic = !className.startsWith('_');
      result.classes.push({
        name: className,
        line: lineNum,
        exported: isPublic
      });
      if (isPublic) {
        result.exports.push({
          name: className,
          type: 'class',
          line: lineNum
        });
      }
    }

    // Match API calls: requests.get, httpx.post, aiohttp, etc.
    if (/\b(requests|httpx|aiohttp|urllib)\.(get|post|put|delete|patch|request)\s*\(/.test(line)) {
      const apiMatch = line.match(/\b(requests|httpx|aiohttp|urllib)\.(get|post|put|delete|patch|request)/);
      if (apiMatch) {
        result.apiCalls.push({
          method: `${apiMatch[1]}.${apiMatch[2]}`,
          line: lineNum
        });
      }
    }

    // Match fetch/async calls
    if (/\bfetch\s*\(/.test(line)) {
      result.apiCalls.push({
        method: 'fetch',
        line: lineNum
      });
    }
  }

  return result;
}

// Parse a single file and extract imports/exports
function parseFile(content, filePath) {
  const result = {
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    apiCalls: [],
    hasDefaultExport: false
  };

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator'
      ]
    });

    traverse(ast, {
      // Track imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const specifiers = path.node.specifiers.map(spec => ({
          local: spec.local?.name,
          imported: spec.imported?.name || 'default',
          type: spec.type
        }));
        result.imports.push({ source, specifiers, line: path.node.loc?.start.line });
      },

      // Track exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          const decl = path.node.declaration;
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            result.exports.push({
              name: decl.id.name,
              type: 'function',
              line: path.node.loc?.start.line
            });
            result.functions.push({
              name: decl.id.name,
              line: path.node.loc?.start.line,
              exported: true
            });
          } else if (decl.type === 'VariableDeclaration') {
            decl.declarations.forEach(d => {
              if (d.id.name) {
                result.exports.push({
                  name: d.id.name,
                  type: 'variable',
                  line: path.node.loc?.start.line
                });
              }
            });
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            result.exports.push({
              name: decl.id.name,
              type: 'class',
              line: path.node.loc?.start.line
            });
            result.classes.push({
              name: decl.id.name,
              line: path.node.loc?.start.line,
              exported: true
            });
          }
        }
        if (path.node.specifiers) {
          path.node.specifiers.forEach(spec => {
            result.exports.push({
              name: spec.exported?.name || spec.local?.name,
              type: 'reexport',
              line: path.node.loc?.start.line
            });
          });
        }
      },

      ExportDefaultDeclaration(path) {
        result.hasDefaultExport = true;
        const decl = path.node.declaration;
        if (decl.id?.name) {
          result.exports.push({
            name: decl.id.name,
            type: 'default',
            line: path.node.loc?.start.line
          });
        } else {
          result.exports.push({
            name: 'default',
            type: 'default',
            line: path.node.loc?.start.line
          });
        }
      },

      // Track function declarations
      FunctionDeclaration(path) {
        if (path.node.id && !result.functions.find(f => f.name === path.node.id.name)) {
          result.functions.push({
            name: path.node.id.name,
            line: path.node.loc?.start.line,
            exported: false
          });
        }
      },

      // Track class declarations
      ClassDeclaration(path) {
        if (path.node.id && !result.classes.find(c => c.name === path.node.id.name)) {
          result.classes.push({
            name: path.node.id.name,
            line: path.node.loc?.start.line,
            exported: false
          });
        }
      },

      // Track external API calls (fetch, axios, etc.)
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type === 'Identifier') {
          if (['fetch', 'axios'].includes(callee.name)) {
            result.apiCalls.push({
              method: callee.name,
              line: path.node.loc?.start.line
            });
          }
        }
        if (callee.type === 'MemberExpression') {
          const obj = callee.object?.name;
          const prop = callee.property?.name;
          if (obj === 'axios' || obj === 'fetch') {
            result.apiCalls.push({
              method: `${obj}.${prop}`,
              line: path.node.loc?.start.line
            });
          }
        }
      }
    });
  } catch (error) {
    console.error(`Failed to parse ${filePath}: ${error.message}`);
  }

  return result;
}

// Resolve import path to actual file path
function resolveImport(importSource, fromFile, files) {
  const isPython = fromFile.endsWith('.py');

  if (isPython) {
    // Python import resolution
    // Handle relative imports (from . import x, from .. import x)
    if (importSource.startsWith('.')) {
      const dir = path.dirname(fromFile);
      let resolved;

      if (importSource === '.') {
        resolved = dir;
      } else if (importSource.startsWith('..')) {
        const parentDir = path.dirname(dir);
        resolved = path.join(parentDir, importSource.slice(2).replace(/\./g, '/')).replace(/\\/g, '/');
      } else {
        resolved = path.join(dir, importSource.slice(1).replace(/\./g, '/')).replace(/\\/g, '/');
      }

      // Try .py extension and __init__.py
      const candidates = [
        resolved + '.py',
        resolved + '/__init__.py',
        resolved
      ];
      for (const candidate of candidates) {
        if (files[candidate]) return candidate;
      }
    } else {
      // Absolute Python import (e.g., from src.agents import x)
      const resolved = importSource.replace(/\./g, '/');
      const candidates = [
        resolved + '.py',
        'src/' + resolved + '.py',
        resolved + '/__init__.py',
        'src/' + resolved + '/__init__.py'
      ];
      for (const candidate of candidates) {
        if (files[candidate]) return candidate;
      }
    }

    return null; // External package
  }

  // JavaScript/TypeScript import resolution
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  if (importSource.startsWith('.')) {
    // Relative import
    const dir = path.dirname(fromFile);
    let resolved = path.join(dir, importSource).replace(/\\/g, '/');

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (files[candidate]) return candidate;
    }
  }

  // Handle path aliases (common patterns: @/, ~/, #/)
  // @/ typically maps to src/ in Next.js/Vite projects
  if (importSource.startsWith('@/') || importSource.startsWith('~/') || importSource.startsWith('#/')) {
    const aliasPath = importSource.slice(2); // Remove @/ or ~/ or #/

    // Try common alias mappings
    const aliasMappings = [
      `src/${aliasPath}`,           // @/foo → src/foo
      `app/${aliasPath}`,           // @/foo → app/foo
      aliasPath,                    // @/foo → foo (root level)
    ];

    for (const mapping of aliasMappings) {
      for (const ext of extensions) {
        const candidate = mapping + ext;
        if (files[candidate]) return candidate;
      }
    }
  }

  // Handle bare imports that might be local (e.g., components/Button in some setups)
  // Only if it looks like a local path (contains /)
  if (importSource.includes('/') && !importSource.startsWith('@') && !importSource.includes('node_modules')) {
    const possiblePaths = [
      `src/${importSource}`,
      importSource,
    ];

    for (const basePath of possiblePaths) {
      for (const ext of extensions) {
        const candidate = basePath + ext;
        if (files[candidate]) return candidate;
      }
    }
  }

  return null; // External package
}

// Identify cluster for a file
function identifyCluster(filePath) {
  const p = filePath.toLowerCase();

  // Entry points - JS/TS
  if (/^(index|app|main|server)\.(ts|js|tsx|jsx)$/.test(p)) return 'entry';
  if (/^src\/(index|app|main)\.(ts|js|tsx|jsx)$/.test(p)) return 'entry';

  // Entry points - Python
  if (/^(main|app|cli|run|__main__)\.py$/.test(p)) return 'entry';
  if (/^src\/(main|app)\.py$/.test(p)) return 'entry';
  if (/manage\.py$/.test(p)) return 'entry';  // Django
  if (/wsgi\.py$/.test(p) || /asgi\.py$/.test(p)) return 'entry';

  // Routes/API
  if (/routes?\//.test(p)) return 'routes';
  if (/api\//.test(p)) return 'routes';
  if (/pages\/api\//.test(p)) return 'routes';
  if (/controllers?\//.test(p)) return 'routes';
  if (/routers?\//.test(p)) return 'routes';  // FastAPI routers
  if (/views?\//.test(p)) return 'routes';    // Django/Flask views
  if (/endpoints?\//.test(p)) return 'routes';

  // Services/Core
  if (/services?\//.test(p)) return 'services';
  if (/lib\//.test(p)) return 'services';
  if (/core\//.test(p)) return 'services';
  if (/utils?\//.test(p)) return 'services';
  if (/helpers?\//.test(p)) return 'services';
  if (/agents?\//.test(p)) return 'services';  // AI agents

  // Data layer
  if (/models?\//.test(p)) return 'data';
  if (/db\//.test(p)) return 'data';
  if (/prisma\//.test(p)) return 'data';
  if (/schema/.test(p)) return 'data';
  if (/repositories?\//.test(p)) return 'data';
  if (/migrations?\//.test(p)) return 'data';

  // Components (for frontend)
  if (/components?\//.test(p)) return 'components';
  if (/pages?\//.test(p) && !/api\//.test(p)) return 'pages';
  if (/hooks?\//.test(p)) return 'hooks';
  if (/templates?\//.test(p)) return 'components';  // Jinja/Django templates

  // Config
  if (/config\//.test(p)) return 'config';
  if (/\.config\.(ts|js)$/.test(p)) return 'config';
  if (/settings?\.py$/.test(p)) return 'config';  // Django settings
  if (/config\.py$/.test(p)) return 'config';

  return 'other';
}

// Calculate import depth (how many files import this file)
function calculateImportDepth(filePath, importGraph) {
  let depth = 0;
  for (const [, imports] of Object.entries(importGraph)) {
    if (imports.includes(filePath)) depth++;
  }
  return depth;
}

// Find critical path through the codebase
function findCriticalPath(files, parsedFiles, importGraph) {
  // Find entry points (files with no importers)
  const allImported = new Set(Object.values(importGraph).flat());
  const entryPoints = Object.keys(files).filter(f => !allImported.has(f));

  // Score files by importance (imports + exports + being imported)
  const scores = {};
  for (const [file, parsed] of Object.entries(parsedFiles)) {
    const importDepth = calculateImportDepth(file, importGraph);
    const exportCount = parsed.exports.length;
    const importCount = parsed.imports.filter(i => resolveImport(i.source, file, files)).length;

    scores[file] = {
      file,
      score: importDepth * 3 + exportCount * 2 + importCount,
      isEntry: entryPoints.includes(file),
      cluster: identifyCluster(file)
    };
  }

  // Build critical path from highest-scoring entry point
  const sortedScores = Object.values(scores).sort((a, b) => b.score - a.score);
  const criticalPath = [];

  // Start with best entry point
  const bestEntry = sortedScores.find(s => s.isEntry) || sortedScores[0];
  if (bestEntry) {
    criticalPath.push(bestEntry.file);

    // Follow imports to build path
    let current = bestEntry.file;
    const visited = new Set([current]);
    let depth = 0;

    while (depth < 10) {
      const parsed = parsedFiles[current];
      if (!parsed) break;

      // Find best next hop
      const nextOptions = parsed.imports
        .map(i => resolveImport(i.source, current, files))
        .filter(f => f && !visited.has(f))
        .map(f => ({ file: f, ...scores[f] }))
        .sort((a, b) => (b?.score || 0) - (a?.score || 0));

      if (nextOptions.length === 0) break;

      current = nextOptions[0].file;
      criticalPath.push(current);
      visited.add(current);
      depth++;
    }
  }

  return criticalPath;
}

// Find dead code (exported but never imported)
function findDeadCode(parsedFiles, importGraph) {
  const deadCode = [];
  const allImportedItems = new Set();

  // Collect all imported items
  for (const [file, parsed] of Object.entries(parsedFiles)) {
    for (const imp of parsed.imports) {
      for (const spec of imp.specifiers) {
        allImportedItems.add(`${imp.source}:${spec.imported}`);
      }
    }
  }

  // Find exports that are never imported
  for (const [file, parsed] of Object.entries(parsedFiles)) {
    for (const exp of parsed.exports) {
      // Check if this export is imported anywhere
      const isUsed = Object.entries(parsedFiles).some(([otherFile, otherParsed]) => {
        if (otherFile === file) return false;
        return otherParsed.imports.some(imp => {
          const resolved = resolveImport(imp.source, otherFile, { [file]: true });
          return resolved === file && imp.specifiers.some(s => s.imported === exp.name || s.imported === 'default');
        });
      });

      if (!isUsed && exp.type !== 'default') {
        deadCode.push({
          file,
          name: exp.name,
          type: exp.type,
          line: exp.line
        });
      }
    }
  }

  return deadCode;
}

// Main analysis function
async function analyze(repoData) {
  const { owner, repo, files, summary } = repoData;
  const repoId = `${owner}-${repo}`;

  console.log(`Analyzing ${Object.keys(files).length} files...`);

  // Parse all files
  const parsedFiles = {};
  for (const [filePath, content] of Object.entries(files)) {
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      parsedFiles[filePath] = parseFile(content, filePath);
    } else if (/\.py$/.test(filePath)) {
      parsedFiles[filePath] = parsePythonFile(content, filePath);
    }
  }

  // Build import graph
  const importGraph = {};
  for (const [filePath, parsed] of Object.entries(parsedFiles)) {
    importGraph[filePath] = parsed.imports
      .map(imp => resolveImport(imp.source, filePath, files))
      .filter(Boolean);
  }

  // Build exports map
  const exportsMap = {};
  for (const [filePath, parsed] of Object.entries(parsedFiles)) {
    exportsMap[filePath] = parsed.exports.map(e => e.name);
  }

  // Build callers map
  const callersMap = {};
  for (const [filePath, parsed] of Object.entries(parsedFiles)) {
    for (const exp of parsed.exports) {
      const key = `${filePath}:${exp.name}`;
      callersMap[key] = [];

      // Find files that import this
      for (const [otherFile, otherParsed] of Object.entries(parsedFiles)) {
        if (otherFile === filePath) continue;
        for (const imp of otherParsed.imports) {
          const resolved = resolveImport(imp.source, otherFile, files);
          if (resolved === filePath) {
            if (imp.specifiers.some(s => s.imported === exp.name || s.imported === 'default')) {
              callersMap[key].push(`${otherFile}:${imp.line}`);
            }
          }
        }
      }
    }
  }

  // Group files into clusters
  const clusters = {};
  for (const filePath of Object.keys(parsedFiles)) {
    const cluster = identifyCluster(filePath);
    if (!clusters[cluster]) {
      clusters[cluster] = {
        id: cluster,
        label: cluster.charAt(0).toUpperCase() + cluster.slice(1),
        files: []
      };
    }
    clusters[cluster].files.push(filePath);
  }

  // Find critical path
  const criticalPath = findCriticalPath(files, parsedFiles, importGraph);

  // Find dead code
  const deadCode = findDeadCode(parsedFiles, importGraph);

  // Build nodes
  const nodes = Object.entries(parsedFiles).map(([filePath, parsed]) => {
    const cluster = identifyCluster(filePath);
    const isCritical = criticalPath.includes(filePath);
    const isDead = deadCode.some(d => d.file === filePath);
    const importDepth = calculateImportDepth(filePath, importGraph);

    return {
      id: filePath.replace(/[\/\.]/g, '-'),
      path: filePath,
      label: path.basename(filePath),
      cluster,
      critical: isCritical,
      dead: isDead,
      exports: parsed.exports,
      imports: parsed.imports,
      functions: parsed.functions,
      classes: parsed.classes,
      apiCalls: parsed.apiCalls,
      importDepth,
      // These will be filled by Claude enricher
      role: null,
      plain: null,
      notes: []
    };
  });

  // Build edges
  const edges = [];
  for (const [filePath, imports] of Object.entries(importGraph)) {
    const fromId = filePath.replace(/[\/\.]/g, '-');

    for (const targetPath of imports) {
      const toId = targetPath.replace(/[\/\.]/g, '-');
      const isCritical = criticalPath.includes(filePath) && criticalPath.includes(targetPath);

      // Determine edge type
      let kind = 'normal';
      if (isCritical) kind = 'critical';
      else if (identifyCluster(targetPath) === 'data') kind = 'db';
      else if (parsedFiles[filePath]?.apiCalls.length > 0) kind = 'api';

      edges.push({
        from: fromId,
        to: toId,
        kind,
        label: '', // Will be filled by enricher
        critical: isCritical
      });
    }
  }

  // Build analysis object
  const analysis = {
    fingerprint: {
      repoId,
      owner,
      repo,
      analyzedAt: new Date().toISOString(),
      analysisVersion: '1.0'
    },
    summary: {
      ...summary,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: Object.keys(clusters).length,
      deadCodeCount: deadCode.length,
      criticalPathLength: criticalPath.length
    },
    clusters: Object.values(clusters),
    nodes,
    edges,
    imports: importGraph,
    exports: exportsMap,
    callers: callersMap,
    criticalPath,
    deadCode,
    securityFindings: [] // Will be filled by security scanner
  };

  return analysis;
}

// Save analysis to file
async function saveAnalysis(repoId, analysis) {
  const dir = path.join(__dirname, '../data/analyses');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${repoId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2));

  return filePath;
}

// Load analysis from file
function loadAnalysis(repoId) {
  const filePath = path.join(__dirname, '../data/analyses', `${repoId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

module.exports = {
  parseFile,
  analyze,
  saveAnalysis,
  loadAnalysis,
  identifyCluster,
  findCriticalPath,
  findDeadCode
};
