const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Security rules (deterministic, NOT Claude)
const SECURITY_RULES = [
  {
    id: 'eval-usage',
    severity: 'high',
    title: 'Dangerous eval() usage',
    description: 'eval() can execute arbitrary code and is a security risk',
    check: (ast, content) => {
      const findings = [];
      traverse(ast, {
        CallExpression(path) {
          if (path.node.callee.name === 'eval') {
            findings.push({
              line: path.node.loc?.start.line,
              code: content.split('\n')[path.node.loc?.start.line - 1]?.trim()
            });
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'exec-usage',
    severity: 'high',
    title: 'Command injection risk',
    description: 'child_process.exec can execute arbitrary shell commands',
    check: (ast, content) => {
      const findings = [];
      traverse(ast, {
        CallExpression(path) {
          const callee = path.node.callee;
          if (callee.type === 'MemberExpression') {
            const obj = callee.object?.name;
            const prop = callee.property?.name;
            if ((obj === 'child_process' || obj === 'cp') && ['exec', 'execSync'].includes(prop)) {
              findings.push({
                line: path.node.loc?.start.line,
                code: content.split('\n')[path.node.loc?.start.line - 1]?.trim()
              });
            }
          }
        },
        ImportDeclaration(path) {
          if (path.node.source.value === 'child_process') {
            const hasExec = path.node.specifiers.some(s =>
              s.imported?.name === 'exec' || s.imported?.name === 'execSync'
            );
            if (hasExec) {
              findings.push({
                line: path.node.loc?.start.line,
                code: 'Importing exec from child_process'
              });
            }
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'dangerous-html',
    severity: 'high',
    title: 'XSS vulnerability risk',
    description: 'dangerouslySetInnerHTML can lead to XSS attacks',
    check: (ast, content) => {
      const findings = [];
      traverse(ast, {
        JSXAttribute(path) {
          if (path.node.name?.name === 'dangerouslySetInnerHTML') {
            findings.push({
              line: path.node.loc?.start.line,
              code: content.split('\n')[path.node.loc?.start.line - 1]?.trim()
            });
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'sql-injection',
    severity: 'critical',
    title: 'Potential SQL injection',
    description: 'String concatenation in SQL queries can lead to SQL injection',
    check: (ast, content) => {
      const findings = [];
      // Simple regex-based check for template literals with SQL
      const sqlPatterns = [
        /`.*SELECT.*\$\{/i,
        /`.*INSERT.*\$\{/i,
        /`.*UPDATE.*\$\{/i,
        /`.*DELETE.*\$\{/i,
        /`.*WHERE.*\$\{/i
      ];

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of sqlPatterns) {
          if (pattern.test(line)) {
            findings.push({
              line: index + 1,
              code: line.trim()
            });
            break;
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'hardcoded-secret',
    severity: 'high',
    title: 'Hardcoded secret detected',
    description: 'Secrets should be stored in environment variables, not in code',
    check: (ast, content) => {
      const findings = [];
      const secretPatterns = [
        { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, name: 'password' },
        { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/, name: 'secret' },
        { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/, name: 'API key' },
        { pattern: /auth[_-]?token\s*[:=]\s*['"][^'"]+['"]/, name: 'auth token' },
        { pattern: /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/, name: 'private key' }
      ];

      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        for (const { pattern, name } of secretPatterns) {
          if (pattern.test(line.toLowerCase())) {
            findings.push({
              line: index + 1,
              code: line.trim().substring(0, 60) + (line.length > 60 ? '...' : ''),
              secretType: name
            });
            break;
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'jwt-secret-literal',
    severity: 'critical',
    title: 'JWT secret hardcoded',
    description: 'JWT secrets should be stored in environment variables',
    check: (ast, content) => {
      const findings = [];
      traverse(ast, {
        CallExpression(path) {
          const callee = path.node.callee;
          if (callee.type === 'MemberExpression') {
            const obj = callee.object?.name;
            const prop = callee.property?.name;
            if (obj === 'jwt' && ['sign', 'verify'].includes(prop)) {
              // Check if secret is a string literal
              const args = path.node.arguments;
              if (args.length >= 2) {
                const secretArg = args[1];
                if (secretArg.type === 'StringLiteral') {
                  findings.push({
                    line: path.node.loc?.start.line,
                    code: content.split('\n')[path.node.loc?.start.line - 1]?.trim()
                  });
                }
              }
            }
          }
        }
      });
      return findings;
    }
  },
  {
    id: 'no-rate-limit',
    severity: 'medium',
    title: 'API endpoint without rate limiting',
    description: 'API endpoints should have rate limiting to prevent abuse',
    check: (ast, content) => {
      const findings = [];
      // Check for Express route handlers without rate limiting middleware
      const hasRateLimit = content.includes('rateLimit') || content.includes('rate-limit');
      if (!hasRateLimit) {
        traverse(ast, {
          CallExpression(path) {
            const callee = path.node.callee;
            if (callee.type === 'MemberExpression') {
              const obj = callee.object?.name;
              const prop = callee.property?.name;
              if (['app', 'router'].includes(obj) && ['get', 'post', 'put', 'delete', 'patch'].includes(prop)) {
                // Check first argument for route path
                const firstArg = path.node.arguments[0];
                if (firstArg?.type === 'StringLiteral' && firstArg.value.includes('/api')) {
                  findings.push({
                    line: path.node.loc?.start.line,
                    code: `${prop.toUpperCase()} ${firstArg.value}`,
                    endpoint: firstArg.value
                  });
                }
              }
            }
          }
        });
      }
      return findings;
    }
  },
  {
    id: 'unvalidated-input',
    severity: 'medium',
    title: 'Unvalidated user input',
    description: 'User input should be validated before use',
    check: (ast, content) => {
      const findings = [];
      // Check for direct use of req.body/req.params/req.query without validation
      traverse(ast, {
        MemberExpression(path) {
          const obj = path.node.object;
          const prop = path.node.property?.name;
          if (obj?.name === 'req' && ['body', 'params', 'query'].includes(prop)) {
            // Check if parent is assignment or direct usage without validation
            const parent = path.parent;
            if (parent.type === 'MemberExpression' || parent.type === 'CallExpression') {
              // Direct property access without validation
              findings.push({
                line: path.node.loc?.start.line,
                code: content.split('\n')[path.node.loc?.start.line - 1]?.trim(),
                inputType: prop
              });
            }
          }
        }
      });
      // Limit to first 3 findings to avoid noise
      return findings.slice(0, 3);
    }
  }
];

// Scan a single file for security issues
function scanFile(content, filePath) {
  const findings = [];

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

    for (const rule of SECURITY_RULES) {
      const ruleFindings = rule.check(ast, content);
      for (const finding of ruleFindings) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          file: filePath,
          line: finding.line,
          code: finding.code,
          ...finding
        });
      }
    }
  } catch (error) {
    // Skip files that can't be parsed
    console.error(`Security scan failed for ${filePath}: ${error.message}`);
  }

  return findings;
}

// Scan all files in analysis
function scan(files) {
  const allFindings = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      const findings = scanFile(content, filePath);
      allFindings.push(...findings);
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allFindings;
}

// Get summary of findings
function getSummary(findings) {
  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    byRule: {}
  };

  for (const finding of findings) {
    summary.byRule[finding.ruleId] = (summary.byRule[finding.ruleId] || 0) + 1;
  }

  return summary;
}

module.exports = {
  SECURITY_RULES,
  scanFile,
  scan,
  getSummary
};
