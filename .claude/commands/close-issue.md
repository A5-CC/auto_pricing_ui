# Close Issue Command

This command documents the process for closing completed issues in AUTO_ANALYST development, where you want tracking without formal code review.

## CRITICAL: Check Branch Type First

**NEVER merge epic branches directly to master!** Epic branches should only be merged when the entire epic is complete and all conflicts are resolved.

## Process: PR for Tracking + Immediate Merge

Before closing ANY issue, you MUST determine:

1. **Is this issue part of an epic?**
   - Check if the branch name contains `epic/`
   - Check if the issue has an `epic:` label
   - Check if there are related issues in the same epic

2. **What is the target branch?**
   - If part of an epic → Target the epic branch (NOT master)
   - If standalone issue → Target master

3. **Should you create a PR at all?**
   - If work is on an epic branch → Maybe just close the issue
   - If work needs tracking → Create PR to appropriate branch

## Process A: Epic Issues (DO NOT MERGE TO MASTER)

For issues that are part of an epic, you MUST provide specific traceability to the code that resolves each issue:

### Option 1: Reference Specific Commits (Recommended)

```bash
# First, commit your changes mentioning ALL relevant issues for automatic GitHub linking
git add .
git commit -m "feat: implement [specific feature] (Issues #111 #112 #113 #114 #115 #116)"
git push origin epic/[epic-name]

# Get the full commit SHA
COMMIT_SHA=$(git rev-parse HEAD)

# Close each issue with specific commit reference
gh issue close 111 --comment "Completed in commit ${COMMIT_SHA} on epic/[epic-name] branch"
gh issue close 112 --comment "Completed in commit ${COMMIT_SHA} on epic/[epic-name] branch"
gh issue close 113 --comment "Completed in commit ${COMMIT_SHA} on epic/[epic-name] branch"
# ... repeat for each issue
```

**Benefits:**
- GitHub automatically creates "added a commit that references this issue" for ALL mentioned issues
- Full SHA traceability in issue comments
- Clean commit history with clear issue associations

### Option 2: Reference Multiple Commits

```bash
# If issue spans multiple commits, reference all relevant ones
gh issue close [ISSUE_NUMBER] --comment "Completed in commits [SHA1], [SHA2], [SHA3] on epic/[epic-name] branch"
```

### Option 3: Feature Branch Within Epic

```bash
# Create feature branch within epic for complex issues
# Naming convention: epic-feature/[epic-name]-issue-XX-[description]
git checkout -b epic-feature/concept-grouping-issue-111-draggable-cards
# ... make changes ...
git push origin epic-feature/concept-grouping-issue-111-draggable-cards

# Create PR within epic for documentation
gh pr create --title "feat: [description] (Issue #XX)" --base epic/[epic-name]

# Reference the feature branch and/or PR
gh issue close [ISSUE_NUMBER] --comment "Completed in epic-feature/concept-grouping-issue-111-draggable-cards branch (PR #YY) within epic/[epic-name]"
```

## Process B: Standalone Issues (PR to Master)

When you've completed work on a STANDALONE issue and want to close it properly with full tracking:

1. **Determine branch type and appropriate action**

   ```bash
   git branch --show-current
   ```

   - **If on an epic branch (epic/\*)**:
     - DO NOT merge to master
     - Either leave changes in the epic branch OR
     - Create a PR from epic to epic for documentation only
     - Add comment to the issue explaining the work is complete but waiting for epic merge

   - **If on master directly**:
     - Create a feature branch first
     - Continue with normal process

   - **If on a feature/bugfix branch**:
     - Continue with normal PR to master process

2. **For feature/bugfix branches only - Push the branch**

   ```bash
   git push origin feature/branch-name
   ```

3. **For feature/bugfix branches only - Create PR with comprehensive description**

   ```bash
   gh pr create --title "feat: [brief description] (Issue #XX)" --body "$(cat <<'EOF'
   ## Summary
   [Detailed description of what was implemented]

   ## Key Changes
   • [Bullet point list of major changes]
   • [Include architectural decisions]
   • [Note any UX improvements]

   Closes #XX
   EOF
   )" --head feature/branch-name --base master
   ```

4. **For feature/bugfix branches only - Immediately merge the PR**

   ```bash
   gh pr merge [PR_NUMBER] --merge
   ```

5. **Verify closure**

   ```bash
   gh pr view [PR_NUMBER]
   ```

## Key Principle: Specific Traceability Required

**CRITICAL**: Every issue closure MUST reference specific code implementations:

- ✅ **Specific commit SHA(s)**: `0dc5df44ec0c9a159d3d556ad7d80f6db6727419`
- ✅ **Feature branch within epic**: `epic-feature/concept-grouping-issue-111-draggable-cards`
- ✅ **PR number within epic**: `PR #123 to epic/concept-grouping`
- ❌ **Vague epic reference**: "Completed on epic/concept-grouping branch"

**Why**: Each issue represents specific work that must be traceable for debugging, code review, and project management.

## IMPORTANT WARNINGS

1. **NEVER automatically merge to master if the issue is part of an epic**
2. **ALWAYS verify the target branch before creating PRs**

## Commit References in Issue Comments

When referencing commits in issue comments, ALWAYS use the **full SHA hash** (40 characters) to ensure GitHub creates proper hyperlinks and provides complete traceability.

**Correct**: `0dc5df44ec0c9a159d3d556ad7d80f6db6727419`
**Incorrect**: `0dc5df4` or `0dc5df44` (short hashes don't create hyperlinks)

### Getting Full SHA Hash

```bash
# Get current commit SHA
git rev-parse HEAD

# Get specific commit SHA by partial reference
git rev-parse 0dc5df4

# List recent commits with full SHAs
git log --oneline --no-abbrev-commit -10
```

## IMPORTANT WARNINGS

1. **NEVER automatically merge to master if the issue is part of an epic**
2. **ALWAYS verify the target branch before creating PRs**

## Commit References in Issue Comments

**⚠️ CRITICAL**: Commits must be pushed to remote BEFORE referencing in issue comments. GitHub only creates hyperlinks for pushed commits and won't add them if you edit the comment later.

When referencing commits in issue comments (especially for epic branches where no single PR contains all changes), ALWAYS use the **full SHA hash** to ensure GitHub creates proper hyperlinks.

**Correct**: `0dc5df44ec0c9a159d3d556ad7d80f6db6727419`
**Incorrect**: `0dc5df4` or `0dc5df44`

Example comment:
```
Implementation completed in epic/concept-grouping branch across commits 0dc5df44ec0c9a159d3d556ad7d80f6db6727419 (main implementation) and 50d2a4284fb1c5e8d9a3b7f2e6c1d8a9b4c3e7f6 (validation fixes). Work will be available in master when epic is merged.
```
IMPORTANT: If you have to commit changes, internally use your /commit-or-push command. If you can't, just read @.claude/commands/commit-or-push.md file and follow the instructions.
