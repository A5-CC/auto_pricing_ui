# Analyze Merge Safety Command

This command performs a comprehensive analysis to determine if it's safe to start new work from master while another branch is in progress, assessing the risk of merge conflicts between parallel development branches.

## Usage
```
/analyze-merge-safety <existing-branch> <planned-work-description>
```

Where:
- `<existing-branch>`: The branch currently in progress (could be feature/, epic/, bugfix/, etc.)
- `<planned-work-description>`: Description of planned work (issue number, epic name, or work description)

## Process

### 1. Create comprehensive task list
Use TodoWrite to track:
- Analyze existing branch changes and affected files
- Research planned work scope and requirements  
- Map file overlap between both work streams
- Assess merge conflict risk and provide recommendation

### 2. Analyze the existing branch

```bash
# Switch to the existing branch
git checkout <existing-branch>

# View all commits unique to this branch
git log --oneline master..<existing-branch>

# List all files changed in the branch
git diff --name-only master...<existing-branch> | sort | uniq > /tmp/existing-branch-files.txt

# Get change statistics
git diff master...<existing-branch> --stat

# Identify key areas of change
git diff master...<existing-branch> --dirstat=files,10
```

### 3. Research the planned work

Search for related issues and documentation:
```bash
# If planned work is an issue number
gh issue view <issue-number> --json title,body,comments,labels

# Search for related issues  
gh issue list --search "<planned-work-keywords>" --json number,title,body --limit 20

# Check backlog for planning notes
grep -i "<planned-work-keywords>" .backlog/backlog.txt

# Find existing related files that might be affected
find . -name "*<related-keyword>*" -type f | grep -v node_modules | sort

# Search codebase for areas that might be affected
grep -r "<planned-work-keyword>" --include="*.ts" --include="*.tsx" | head -20
```

### 4. Map potential overlap

```bash
# For the planned work, identify files that would likely be modified
# Based on the research, create a list of files that the planned work would touch

# Find files in existing branch that mention keywords from planned work
git diff --name-only master...<existing-branch> | xargs grep -l "<planned-work-keyword>" 2>/dev/null | sort

# Analyze specific overlap areas based on the type of work
# Example: if both touch similar domain areas
echo "=== Domain files in existing branch ==="
git diff --name-only master...<existing-branch> | grep -E "<domain-pattern>" | sort

echo "=== Related component files in existing branch ==="  
git diff --name-only master...<existing-branch> | xargs grep -l "<component-keyword>" 2>/dev/null | sort
```

### 5. Deep dive into overlapping files

For each potentially overlapping file:
```bash
# See what changed in the existing branch
git diff master...<existing-branch> -- <file-path>

# Check if changes are in same sections or orthogonal
git diff master...<existing-branch> -- <file-path> | grep -A5 -B5 "<keyword-from-planned-work>"
```

### 6. Assess merge conflict risk

Create a comprehensive assessment considering:

1. **File overlap percentage**: How many files would both branches touch?
2. **Section overlap**: Do they modify the same parts of files?
3. **Semantic overlap**: Are the changes conceptually related or orthogonal?
4. **Dependency risk**: Does planned work depend on existing branch changes?
5. **Code proximity**: Are changes in same functions/components?
6. **Work scope**: Is this a small feature/bug or large epic?

### 7. Provide recommendation

Write a clear assessment with:
- **Risk level**: HIGH/MEDIUM/LOW
- **Specific conflict areas** identified
- **Recommended approach**:
  - Safe to proceed in parallel
  - Wait for existing branch to merge
  - Coordinate specific files
- **Mitigation strategies**:
  - Rebase frequency
  - File ownership assignment
  - Merge order recommendation

## Example Output Structure

```
## ASSESSMENT: [WORK DESCRIPTION] MERGE SAFETY

### Summary
Risk Level: LOW/MEDIUM/HIGH
Recommendation: SAFE/RISKY to start parallel development

### Analysis
1. **Existing Work**: [Description] (branch: xxx)
   - Changes: X files, +Y/-Z lines
   - Main areas: [list key areas]
   - Type: feature/epic/bugfix

2. **Planned Work**: [Description]  
   - Estimated scope: [based on issues/planning]
   - Main areas: [list expected areas]
   - Type: feature/epic/bugfix

3. **Overlap Analysis**
   - Direct file conflicts: X files
   - Semantic conflicts: [describe]
   - Risk areas: [specific concerns]

### Recommendation
[Detailed recommendation with reasoning]

### Mitigation Strategy
[If proceeding, how to minimize conflicts]
```

## Notes
- This analysis is most accurate when the planned work has clear requirements (issues, specs)
- Consider running this analysis periodically as both branches evolve
- For small fixes/features, the analysis can be lighter than for epics
- Document findings in issue comments for team visibility