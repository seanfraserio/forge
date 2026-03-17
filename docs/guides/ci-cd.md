# CI/CD Integration

How to automate Forge deployments with continuous integration pipelines.

---

## GitHub Actions workflow

To set up automated agent deployment on every push to `main`, create `.github/workflows/forge-deploy.yml`:

```yaml
name: Forge Deploy

on:
  push:
    branches: [main]
    paths:
      - "forge.yaml"
      - "prompts/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @openforge-ai/cli
      - run: forge validate

  deploy-dev:
    needs: validate
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @openforge-ai/cli
      - run: forge deploy --env dev
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  deploy-production:
    needs: deploy-dev
    runs-on: ubuntu-latest
    environment:
      name: production
      # Requires manual approval via GitHub environment protection rules
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @openforge-ai/cli
      - run: forge deploy --env production
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

To configure the required secrets, go to your repository's **Settings > Secrets and variables > Actions** and add `ANTHROPIC_API_KEY`. If you use OpenAI, add `OPENAI_API_KEY` instead.

---

## GitLab CI

To set up the equivalent pipeline in GitLab CI, create `.gitlab-ci.yml`:

```yaml
stages:
  - validate
  - deploy-dev
  - deploy-production

validate:
  stage: validate
  image: node:20-alpine
  script:
    - npm install -g @openforge-ai/cli
    - forge validate

deploy-dev:
  stage: deploy-dev
  image: node:20-alpine
  script:
    - npm install -g @openforge-ai/cli
    - forge deploy --env dev
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
  only:
    - main

deploy-production:
  stage: deploy-production
  image: node:20-alpine
  script:
    - npm install -g @openforge-ai/cli
    - forge deploy --env production
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
  when: manual
  only:
    - main
```

Add `ANTHROPIC_API_KEY` under **Settings > CI/CD > Variables** in your GitLab project.

---

## Branch-based deployments

To deploy different environments based on the branch, use conditional logic in your workflow.

### GitHub Actions

```yaml
name: Forge Branch Deploy

on:
  push:
    branches: [dev, main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @openforge-ai/cli

      - name: Deploy to dev
        if: github.ref == 'refs/heads/dev'
        run: forge deploy --env dev
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: forge deploy --env production
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### GitLab CI

```yaml
deploy:
  image: node:20-alpine
  script:
    - npm install -g @openforge-ai/cli
    - |
      if [ "$CI_COMMIT_BRANCH" = "dev" ]; then
        forge deploy --env dev
      elif [ "$CI_COMMIT_BRANCH" = "main" ]; then
        forge deploy --env production
      fi
```

---

## Gated deployments

To require manual approval before deploying to production, use environment protection rules.

### GitHub Actions

1. Go to **Settings > Environments** in your GitHub repository.
2. Create an environment named `production`.
3. Enable **Required reviewers** and add the approvers.
4. Reference the environment in your workflow job:

```yaml
deploy-production:
  runs-on: ubuntu-latest
  environment:
    name: production
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
    - run: npm install -g @openforge-ai/cli
    - run: forge deploy --env production
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

When the workflow reaches `deploy-production`, GitHub pauses execution and notifies the designated reviewers. The job runs only after a reviewer approves it.

### GitLab CI

Set `when: manual` on the production stage (shown in the GitLab CI example above). A pipeline maintainer must click the manual play button in the GitLab UI to trigger the production deployment.

---

## Rollback in CI

To trigger a rollback from CI, run `forge rollback` in your pipeline.

### Manual rollback workflow (GitHub Actions)

```yaml
name: Forge Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to roll back"
        required: true
        default: "production"
        type: choice
        options:
          - dev
          - staging
          - production

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @openforge-ai/cli
      - run: forge rollback --env ${{ inputs.environment }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

This workflow appears under the **Actions** tab with a **Run workflow** button. Select the target environment and run it manually.

### Automatic rollback on failure

To roll back automatically when a deployment health check fails:

```yaml
deploy-production:
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
    - run: npm install -g @openforge-ai/cli

    - name: Deploy
      id: deploy
      run: forge deploy --env production
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

    - name: Rollback on failure
      if: failure() && steps.deploy.outcome == 'failure'
      run: forge rollback --env production
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

If the deploy step fails, the rollback step executes automatically, restoring the previous agent configuration from `.forge/state.json`.
