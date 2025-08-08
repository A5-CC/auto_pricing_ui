# Continue Issue Command

This command helps you continue work on a GitHub Issue by reading the issue details, analyzing the latest checkpoint from the onboarding file, and actively investigating the current workspace state to identify what work has been completed and what remains pending.

## Process

1. **Read the GitHub Issue**:
   ```bash
   gh issue view $ARGUMENTS --json title,body,comments --jq '.'
   ```

2. **Read and analyze the onboarding file**:
   ```bash
   # Read the onboarding file for context
   cat .claude/tasks/issue-$ARGUMENTS/onboarding.md
   ```
   - Locate the most recent "CHECKPOINT" section within the onboarding file
   - Review documented progress, completed tasks, and any "Still Pending" or "Next Steps" sections
   - Note what the last checkpoint indicates should be the current state

3. **ACTIVE WORKSPACE INVESTIGATION** - Gather current state observations:
   
   **Git Status Analysis:**
   ```bash
   # Get detailed status with untracked files
   git status --porcelain -u
   
   # Show staged changes in detail
   git diff --cached --stat
   git diff --cached --name-only
   
   # Show unstaged changes in detail  
   git diff --stat
   git diff --name-only
   
   # Show recent commits for context
   git log --oneline -10
   
   # Compare current branch with main/master
   git diff main...HEAD --stat
   git diff main...HEAD --name-only
   ```
   
   **File Investigation:**
   - For each modified file from git status, use Read tool to examine current content
   - Focus on files that appear frequently in git diff output
   - Pay special attention to new untracked files that might be relevant to the issue
   - Look for TODO comments, incomplete implementations, or debug code

4. **Synthesize Findings**:
   - Cross-reference checkpoint status with actual workspace state from step 3
   - Compare onboarding file expectations vs actual workspace state
   - Identify discrepancies between documented progress and current file states
   - Identify what work has been completed but not documented
   - Identify what work was documented as done but may need adjustment
   - Note any new developments or changes since last checkpoint

5. **Check in with the user**:
   - Present OBSERVATIONS from workspace investigation alongside checkpoint info
   - Highlight any discrepancies found between documented vs actual state
   - Ask the user to confirm current priorities
   - Offer specific, actionable next steps based on both historical context and current state

## Key Points

- The onboarding file serves as your memory between sessions
- The CHECKPOINT sections contain the most critical information about current progress
- **The user is the source of truth** for what should be done next, not the onboarding file
- Always check in with the user before proceeding with any work
- Use checkpoint information to inform your questions and recommendations, not to decide what to do

## Example Flow

```bash
# 1. Read issue details
gh issue view 75 --json title,body,comments --jq '.'

# 2. Read and analyze onboarding context
cat .claude/tasks/issue-75/onboarding.md
# Focus on latest CHECKPOINT section within the onboarding file

# 3. ACTIVE WORKSPACE INVESTIGATION
git status --porcelain -u
git diff --cached --stat && git diff --cached --name-only
git diff --stat && git diff --name-only  
git log --oneline -10
git diff main...HEAD --stat

# 4. Read modified files found in git status
# Use Read tool for each file showing changes
# Look for: TODOs, incomplete code, debug statements

# 5. Synthesize and present findings:
# "OBSERVATIONS from workspace investigation:
# - Found 3 unstaged changes in components/task-details/
# - New untracked file: concept-group-viewer.tsx
# - Last checkpoint says X was completed, but file Y still shows TODO comments
# - Recent commits show work on Z feature
# 
# Based on both checkpoint and current state, it appears A and B are pending.
# Does this match your understanding? What would you like to work on next?"
```

This command ensures continuity between work sessions by leveraging the comprehensive context stored in onboarding files.