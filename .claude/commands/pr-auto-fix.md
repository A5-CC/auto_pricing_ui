You are an AI assistant tasked with analyzing the last Claude comment in a GitHub Pull Request and automatically applying the recommended code changes. Your goal is to parse actionable recommendations from Claude's PR review and implement them automatically, excluding testing-related suggestions that require manual intervention.

You will be given a PR number to analyze:

<pr_number> #$ARGUMENTS </pr_number>

Follow these steps to complete the task, make a todo list and think ultrahard:

1. Analyze the Pull Request:
   - Use `gh pr view` to fetch all comments from the specified PR
   - Identify the most recent comment from Claude (look for "Claude finished" signature or claude[bot] user)
   - If the last comment is not from Claude, search backwards through the comment history to find the most recent Claude review

2. Parse Claude's recommendations:
   - Extract actionable code improvement suggestions from the comment
   - Categorize recommendations into:
     
     **Auto-apply (no confirmation needed):**
     - Unused imports removal
     - Code cleanup and consistency fixes  
     - Security improvements
     - Performance optimizations
     - Style and formatting fixes
     
     **Apply with confirmation:**
     - UX/Design consistency issues
     - Breaking changes
     - Documentation updates (only if claude.md or appropriate docs exist)
     
     **SKIP (require manual decisions):**
     - Test coverage recommendations
     - Architectural changes

3. Research the codebase:
   - Examine the files mentioned in Claude's recommendations
   - Understand the current code structure and patterns
   - Verify that the recommended changes are still applicable

4. Present a plan:
   - Based on the parsed recommendations, outline a plan for implementing the fixes
   - Separate recommendations into categories:
     - **Auto-apply changes**: List changes that will be applied immediately
     - **Confirmation required**: Present UX changes, breaking changes, and documentation updates
   - For confirmation-required changes, ask the user: "Do you want to apply [UX changes/breaking changes/documentation updates]?"
   - Check for existing documentation files (claude.md, README.md, docs/) before proposing documentation updates
   - Present this plan in <plan> tags

5. Apply the changes:
   - Implement auto-apply changes immediately using Edit/MultiEdit tools
   - For confirmation-required changes:
     - Wait for user confirmation before proceeding with each category
     - Apply only the categories the user approves
   - Make focused, atomic changes for each recommendation
   - Ensure all changes maintain code quality and consistency

6. Commit the changes:
   - Stage all modified files
   - Create a commit with the message: "fix: apply Claude PR review recommendations"
   - Include reference to the original PR in the commit description

Remember to be thorough in parsing Claude's recommendations and conservative in applying changes. 

**Implementation Guidelines:**
- Auto-apply only low-risk code quality improvements
- Request user confirmation for UX changes, breaking changes, and documentation updates
- Only create documentation if appropriate files already exist in the project
- Be explicit about what changes require confirmation and why
- Focus on maintaining code consistency and avoiding regressions

Your implementation should balance automation with user control, ensuring that potentially impactful changes receive proper review.