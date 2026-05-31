const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Build context string from files for a specific node
function buildNodeContext(node, files) {
  const filePath = node.path;
  const content = files[filePath];

  if (!content) return null;

  // Get relevant lines around exports/functions
  const lines = content.split('\n');
  const relevantLines = [];

  // Include first 50 lines for context
  relevantLines.push(...lines.slice(0, 50));

  // Include lines around functions/exports
  for (const fn of node.functions || []) {
    const start = Math.max(0, fn.line - 3);
    const end = Math.min(lines.length, fn.line + 10);
    relevantLines.push(`\n--- Function ${fn.name} at line ${fn.line} ---`);
    relevantLines.push(...lines.slice(start, end));
  }

  return relevantLines.join('\n').substring(0, 3000); // Limit context size
}

// Enrich a batch of nodes with Claude
async function enrichNodes(nodes, files, summary) {
  const enrichedNodes = [];

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;

  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);

    // Build prompt for batch
    const nodesContext = batch.map(node => {
      const context = buildNodeContext(node, files);
      return `
## File: ${node.path}
- Label: ${node.label}
- Cluster: ${node.cluster}
- Exports: ${node.exports?.map(e => e.name).join(', ') || 'none'}
- Functions: ${node.functions?.map(f => f.name).join(', ') || 'none'}
- Is Critical Path: ${node.critical}
- Is Dead Code: ${node.dead}
${context ? `\nCode Preview:\n\`\`\`\n${context}\n\`\`\`` : ''}
`;
    }).join('\n---\n');

    const prompt = `You are analyzing a ${summary.framework || 'JavaScript'} codebase. For each file below, provide:

1. **role**: A technical one-sentence description of what this file does (for engineers)
2. **plain**: A plain-English explanation for non-engineers (no jargon, explain like they're a smart PM)
3. **notes**: 2-4 bullet points with specific line references, e.g., "line:42, handles user authentication"

Repository context:
- Framework: ${summary.framework}
- Languages: ${summary.languages?.join(', ')}
- Total files: ${summary.fileCount}

Files to analyze:
${nodesContext}

Respond with a JSON array matching this exact structure:
[
  {
    "path": "exact/file/path.js",
    "role": "Technical description...",
    "plain": "Plain English explanation...",
    "notes": ["line:X, description", "line:Y, description"]
  }
]

Only return valid JSON, no markdown code blocks or extra text.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = response.content[0].text;

      // Parse JSON response
      let enrichments;
      try {
        // Try to extract JSON if wrapped in code blocks
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        enrichments = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (parseError) {
        console.error('Failed to parse Claude response:', parseError.message);
        enrichments = [];
      }

      // Merge enrichments with nodes
      for (const node of batch) {
        const enrichment = enrichments.find(e => e.path === node.path);
        enrichedNodes.push({
          ...node,
          role: enrichment?.role || `${node.cluster} module`,
          plain: enrichment?.plain || `A ${node.cluster} file in the project`,
          notes: enrichment?.notes || []
        });
      }
    } catch (error) {
      console.error(`Claude API error for batch ${i}: ${error.message}`);
      // Fall back to basic enrichment
      for (const node of batch) {
        enrichedNodes.push({
          ...node,
          role: `${node.cluster} module handling ${node.label}`,
          plain: `A file that contributes to the ${node.cluster} functionality`,
          notes: []
        });
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < nodes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return enrichedNodes;
}

// Enrich security findings with Claude explanations
async function enrichSecurityFindings(findings, files) {
  if (!findings || findings.length === 0) return [];

  // Group findings by file for context
  const findingsByFile = {};
  for (const finding of findings) {
    if (!findingsByFile[finding.file]) {
      findingsByFile[finding.file] = [];
    }
    findingsByFile[finding.file].push(finding);
  }

  const prompt = `You are a security analyst reviewing code findings. For each security issue below, provide:

1. **explanation**: A clear explanation of WHY this is a security risk
2. **fix**: A specific recommendation to fix this issue
3. **priority**: Rate as "must-fix", "should-fix", or "consider"

Findings:
${JSON.stringify(findings.slice(0, 20), null, 2)}

Respond with a JSON array:
[
  {
    "ruleId": "rule-id",
    "file": "path/to/file.js",
    "line": 42,
    "explanation": "Why this is risky...",
    "fix": "How to fix it...",
    "priority": "must-fix"
  }
]

Only return valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const enrichments = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    // Merge enrichments with findings
    return findings.map(finding => {
      const enrichment = enrichments.find(
        e => e.ruleId === finding.ruleId && e.file === finding.file && e.line === finding.line
      );
      return {
        ...finding,
        explanation: enrichment?.explanation || finding.description,
        fix: enrichment?.fix || 'Review and address this security concern',
        priority: enrichment?.priority || 'should-fix'
      };
    });
  } catch (error) {
    console.error('Failed to enrich security findings:', error.message);
    return findings.map(f => ({
      ...f,
      explanation: f.description,
      fix: 'Review and address this security concern',
      priority: f.severity === 'critical' ? 'must-fix' : 'should-fix'
    }));
  }
}

// Generate executive summary
async function generateSummary(analysis) {
  const prompt = `Analyze this codebase and provide a brief executive summary.

Codebase stats:
- Framework: ${analysis.summary.framework}
- Languages: ${analysis.summary.languages?.join(', ')}
- Files analyzed: ${analysis.summary.fileCount}
- Total nodes: ${analysis.summary.nodeCount}
- Clusters: ${analysis.clusters?.map(c => c.label).join(', ')}
- Critical path length: ${analysis.summary.criticalPathLength}
- Dead code items: ${analysis.summary.deadCodeCount}
- Security findings: ${analysis.securityFindings?.length || 0}

Critical path files: ${analysis.criticalPath?.slice(0, 5).join(', ')}

Provide a JSON response:
{
  "headline": "One-line summary of what this codebase does",
  "architecture": "2-3 sentences describing the architecture",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "healthScore": 85
}

Health score: 0-100 based on code organization, dead code, security issues.
Only return valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch (error) {
    console.error('Failed to generate summary:', error.message);
    return {
      headline: `A ${analysis.summary.framework} application`,
      architecture: 'Unable to generate architecture summary',
      strengths: [],
      concerns: [],
      healthScore: 70
    };
  }
}

// Main enrichment function
async function enrich(analysis, files) {
  console.log(`Enriching ${analysis.nodes.length} nodes with Claude...`);

  // Enrich nodes with role, plain, notes
  const enrichedNodes = await enrichNodes(analysis.nodes, files, analysis.summary);

  // Enrich security findings
  const enrichedFindings = await enrichSecurityFindings(
    analysis.securityFindings,
    files
  );

  // Generate executive summary
  const executiveSummary = await generateSummary(analysis);

  // Build enriched analysis
  const enriched = {
    ...analysis,
    nodes: enrichedNodes,
    securityFindings: enrichedFindings,
    executiveSummary,
    enrichedAt: new Date().toISOString()
  };

  return enriched;
}

// Save enriched analysis to file
async function saveEnrichedAnalysis(repoId, enriched) {
  const dir = path.join(__dirname, '../data/enriched');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${repoId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2));

  return filePath;
}

// Load enriched analysis from file
function loadEnrichedAnalysis(repoId) {
  const filePath = path.join(__dirname, '../data/enriched', `${repoId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

module.exports = {
  enrich,
  enrichNodes,
  enrichSecurityFindings,
  generateSummary,
  saveEnrichedAnalysis,
  loadEnrichedAnalysis
};
