# Claude Code Review Action

A GitHub Action that performs automated code reviews using Claude AI.

## Features
- Analyzes code changes in pull requests
- Provides detailed feedback on code quality
- Identifies potential issues and suggests improvements
- Checks for security issues and best practices

## Usage

Add this to your GitHub workflow file (e.g. `.github/workflows/review.yml`):

```yaml
name: Claude Code Review

permissions:
  contents: read
  pull-requests: write

on:
  # Run on new/updated PRs
  pull_request:
    types: [opened, reopened, synchronize]
  
  # Allow manual triggers for existing PRs
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'Pull Request Number'
        required: true
        type: string

jobs:
  code-review:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Run Claude Review
        uses: pacnpal/claude-code-review@v1.0.6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-key: ${{ secrets.ANTHROPIC_API_KEY }}
          pr-number: ${{ github.event.pull_request.number || inputs.pr_number }}
```

## Setup

1. Create repository secret `ANTHROPIC_API_KEY` with your Claude API key from Anthropic
2. The `GITHUB_TOKEN` is automatically provided by GitHub Actions

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `anthropic-key` | Anthropic API key for Claude | Yes | N/A |
| `pr-number` | Pull request number to review | Yes | N/A |

## Outputs

| Output | Description |
|--------|-------------|
| `diff_size` | Size of the relevant code changes |
| `review` | Generated code review content |

## Review Format

The action provides detailed code reviews covering:

1. Potential conflicts with existing codebase
2. Code correctness and potential bugs  
3. Security vulnerabilities and risks
4. Performance implications
5. Maintainability and readability issues
6. Adherence to best practices
7. Suggestions for improvements

Each issue found includes:
- Clear problem explanation
- Severity rating (Critical/High/Medium/Low)
- Specific recommendations
- Code examples where helpful

## Example Review

```markdown
# Claude Code Review

1. **Potential conflicts with existing codebase**:
   - No apparent conflicts identified
   
2. **Code correctness and potential bugs**:
   - **Medium Severity**: Potential null pointer in user handling
   - Recommendation: Add null check before accessing user object
   
3. **Security vulnerabilities and risks**: 
   - **High Severity**: SQL injection vulnerability in query construction
   - Recommendation: Use parameterized queries
```

## Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Make changes to `action.js`

4. Build the action:
```bash
npm run build
```

5. Run tests:
```bash
npm test
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Support

- Open an issue for bugs/feature requests
- Submit a PR to contribute
- Contact maintainers for other questions
