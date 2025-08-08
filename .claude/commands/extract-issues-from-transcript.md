You are an AI assistant tasked with systematically analyzing meeting transcripts to identify actionable development tasks and convert them into properly prioritized GitHub issues, while avoiding duplicates.

You will be given a meeting transcript to analyze:

<transcript>
$ARGUMENTS
</transcript>

## Process

1. **Create task tracking**

   Use TodoWrite to create a structured plan for the analysis

2. **Read and analyze the transcript thoroughly**

   Look for:
   - Explicit requests ("I can log this as a ticket")
   - Bug reports and issues mentioned
   - Feature requests and enhancements
   - Process improvements
   - Technical debt items
   - User experience problems

3. **Check for existing issues to avoid duplicates**

   ```bash
   gh issue list --limit 100 --state all
   ```

4. **Cross-reference transcript items with existing issues**

   Identify:
   - Items already covered by open issues
   - Items covered by closed issues that may need reopening
   - Completely new items that need tickets

5. **Create new issues with proper priority tagging and task type**

   For each new issue, use GraphQL API to set task type:
   ```bash
   # Get current repository details
   REPO_INFO=$(gh repo view --json owner,name)
   OWNER=$(echo $REPO_INFO | jq -r '.owner.login')
   NAME=$(echo $REPO_INFO | jq -r '.name')
   REPO_ID=$(gh api graphql -f query="query { repository(owner: \"$OWNER\", name: \"$NAME\") { id } }" --jq '.data.repository.id')
   
   # Create issue with task type
   gh api graphql -f query="mutation { 
     createIssue(input: {
       repositoryId: \"$REPO_ID\", 
       title: \"[Clear, actionable title]\", 
       body: \"[Brief description with context from meeting]\", 
       issueTypeId: \"[TASK_TYPE_ID]\"
     }) { 
       issue { id number title } 
     } 
   }"
   ```

   Task type IDs (use issueTypeId):
   - **Feature**: `IT_kwDOA88nvs4Auh0K` - New functionality, enhancements
   - **Bug**: `IT_kwDOA88nvs4Auh0H` - Fixes, corrections, error handling  
   - **Task**: `IT_kwDOA88nvs4Auh0E` - Process improvements, maintenance

   Priority guidelines:
   - **High**: Security, blocking issues, explicit urgent requests
   - **Medium**: Features that improve UX, performance optimizations
   - **Low**: Nice-to-haves, future considerations, process improvements

   Note: Add priority labels after creation with: `gh issue edit [ISSUE_NUMBER] --add-label "priority:high|medium|low"`

6. **Provide summary report**

   Organize results into:
   - Issues already covered (don't need new tickets)
   - High priority new issues created
   - Medium priority new issues created  
   - Low priority new issues created
   - Items excluded and why

## Best Practices

- Keep issue descriptions brief initially - they can be expanded later
- Include meeting context in issue body for traceability
- Use consistent labeling (enhancement, bug, process)
- Always add priority labels (priority:high, priority:medium, priority:low)
- Reference the meeting date/transcript in issues when relevant
- Focus on actionable items, not just discussion points

With this process, you'll have:

- A complete audit of actionable items from the meeting
- Properly prioritized GitHub issues ready for development
- No duplicate work from existing issues
- Clear traceability from discussion to implementation