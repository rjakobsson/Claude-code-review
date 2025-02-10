// action.js
const core = require('@actions/core');
const github = require('@actions/github');
const { exec } = require('@actions/exec');

async function getPRDetails(octokit, context, prNumber) {
  try {
    console.log(`Getting details for PR #${prNumber}`);
    
    // Get PR info
    const { data: pr } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: parseInt(prNumber)
    });

    return {
      number: pr.number,
      base: {
        sha: pr.base.sha,
        ref: pr.base.ref
      },
      head: {
        sha: pr.head.sha,
        ref: pr.head.ref
      }
    };
  } catch (error) {
    throw new Error(`Failed to get PR details: ${error.message}`);
  }
}

async function setupGitConfig() {
  // Configure git to fetch PR refs
  await exec('git', ['config', '--local', '--add', 'remote.origin.fetch', '+refs/pull/*/head:refs/remotes/origin/pr/*']);
  await exec('git', ['fetch', 'origin']);
}

async function getDiff(baseSha, headSha) {
  let diffContent = '';
  
  try {
    // Get the full diff with context
    await exec('git', ['diff', '-U10', baseSha, headSha], {
      listeners: {
        stdout: (data) => {
          diffContent += data.toString();
        }
      }
    });

    // Filter for relevant files
    const lines = diffContent.split('\n');
    let filtered = '';
    let keep = false;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        keep = false;
        // Check if file type should be included
        if (line.match(/\.(js|ts|py|cpp|h|java|cs)$/) && 
            !line.match(/(package-lock\.json|yarn\.lock|\.md|\.json)/)) {
          keep = true;
        }
      }
      if (keep) {
        filtered += line + '\n';
      }
    }

    return filtered;
  } catch (error) {
    throw new Error(`Failed to generate diff: ${error.message}`);
  }
}

async function analyzeWithClaude(diffContent, anthropicKey) {
  if (!diffContent.trim()) {
    return null;
  }

  const prompt = `You are performing a code review. Please analyze this code diff and provide a thorough review that covers:

1. Potential conflicts with existing codebase
2. Code correctness and potential bugs
3. Security vulnerabilities or risks
4. Performance implications
5. Maintainability and readability issues
6. Adherence to best practices and coding standards
7. Suggestions for improvements

For each issue found:
- Explain the problem clearly
- Rate the severity (Critical/High/Medium/Low)
- Provide specific recommendations for fixes
- Include code examples where helpful

If no issues are found in a particular area, explicitly state that. If it's a dependency update, evaluate with strict scrutiny the implications of the change.

Here is the code diff to review:

\`\`\`
${diffContent}
\`\`\``;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    const data = await response.json();
    if (!data.content?.[0]?.text) {
      throw new Error(`API Error: ${JSON.stringify(data)}`);
    }

    return data.content[0].text;
  } catch (error) {
    throw new Error(`Claude API error: ${error.message}`);
  }
}

async function postReview(octokit, context, review, prNumber) {
  try {
    // Escape special characters for proper formatting
    const escapedReview = review
      .replace(/(?<=[\s\n])`([^`]+)`(?=[\s\n])/g, '\\`$1\\`')
      .replace(/```/g, '\\`\\`\\`')
      .replace(/\${/g, '\\${');

    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: `# Claude Code Review\n\n${escapedReview}`
    });
  } catch (error) {
    throw new Error(`Failed to post review: ${error.message}`);
  }
}

async function run() {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const anthropicKey = core.getInput('anthropic-key', { required: true });
    
    // Initialize GitHub client
    const octokit = github.getOctokit(token);
    const context = github.context;

    // Get PR number from event or input
    let prNumber;
    if (context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request.number;
    } else {
      prNumber = core.getInput('pr-number', { required: true });
    }

    // Set up git configuration
    await setupGitConfig();

    // Get PR details
    const pr = await getPRDetails(octokit, context, prNumber);
    console.log(`Retrieved details for PR #${pr.number}`);

    // Generate diff
    console.log('Generating diff...');
    const diff = await getDiff(pr.base.sha, pr.head.sha);
    
    if (!diff) {
      console.log('No relevant changes found');
      core.setOutput('diff_size', '0');
      return;
    }

    core.setOutput('diff_size', diff.length.toString());

    // Analyze with Claude
    console.log('Analyzing with Claude...');
    const review = await analyzeWithClaude(diff, anthropicKey);
    
    if (!review) {
      console.log('No review generated');
      return;
    }

    // Post review
    console.log('Posting review...');
    await postReview(octokit, context, review, pr.number);

    // Set outputs
    core.setOutput('review', review);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
