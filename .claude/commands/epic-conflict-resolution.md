# Epic Conflict Resolution Strategy

This command helps you document and resolve conflicts between parallel epic branches by creating a detailed conflict resolution guide BEFORE the conflicts happen.

## When to Use This Command

Use this when:
- You have two epic branches being developed in parallel
- You know certain files will be modified by both epics
- You want to establish clear conflict resolution rules upfront
- You need to ensure consistent conflict resolution across team members

## Process

### 1. Create Conflict Resolution Guide

Create a merge strategy file in `docs/merge-strategies/`:

```bash
# Create directory if it doesn't exist
mkdir -p docs/merge-strategies

# Create strategy file named after the conflicting branches/issues
# Examples:
#   docs/merge-strategies/persona-overhaul-vs-concept-grouping.md
#   docs/merge-strategies/issue-123-vs-issue-456.md
```

### 2. Document Expected Conflicts

For each file that will be modified by both epics, document:

```markdown
# Epic Merge Strategy

## epic/persona-overhaul → master → epic/concept-grouping

### Conflict Resolution Rules

#### `app/(org)/standard-studies/asset-testing/form/StepSetup.tsx`
**Modified by**: Both epics
**Persona-overhaul changes**: Updates persona selector labels to "audience"
**Concept-grouping changes**: Adds concept grouping UI components
**Resolution**: MERGE BOTH - Keep concept grouping structure, apply audience terminology
**Specific instructions**:
- In imports: Keep both sets of new imports
- In PersonaSelector component: Change label="Select Personas" to label="Select Audiences"
- In concept grouping section: Keep all new functionality intact
- Example resolution:
  ```tsx
  // BEFORE (master)
  <PersonaSelector label="Select Personas" />
  
  // AFTER (merged)
  <PersonaSelector label="Select Audiences" />
  <ConceptGrouping /> {/* Keep from concept-grouping */}
  ```

#### `app/api/workflows/asset-testing/route.ts`
**Modified by**: Both epics
**Persona-overhaul changes**: Updates variable names from personas to audiences
**Concept-grouping changes**: Adds concept_groups processing logic
**Resolution**: MERGE BOTH - Apply renaming to concept-grouping logic
**Specific instructions**:
- Rename `personas` to `audiences` throughout
- Keep all concept_groups processing logic
- Update type imports to use both changes
```

### 3. Use Commit Message Tags

When making changes in either epic, use special commit tags:

```bash
# In persona-overhaul epic
git commit -m "feat: rename personas to audiences in StepSetup [CONFLICTS WITH epic/concept-grouping]"

# In concept-grouping epic  
git commit -m "feat: add concept grouping to StepSetup [CONFLICTS WITH epic/persona-overhaul]"
```

### 4. Create Pre-Merge Checklist

Before starting any merge, run:

```bash
# See all commits with conflict warnings
git log --oneline --grep="CONFLICTS WITH" --all

# Check the merge strategy document
ls docs/merge-strategies/
cat docs/merge-strategies/[relevant-strategy-file].md

# See which files are modified in both branches
git diff --name-only master..epic/persona-overhaul > persona-files.txt
git diff --name-only master..epic/concept-grouping > concept-files.txt
comm -12 <(sort persona-files.txt) <(sort concept-files.txt)
```

### 5. Resolving Conflicts

When the actual merge happens:

```bash
# Example: After persona-overhaul is merged to master
git checkout epic/concept-grouping
git merge master

# For each conflict, consult the relevant strategy file
# cat docs/merge-strategies/persona-overhaul-vs-concept-grouping.md
# Apply the documented resolution strategy

# Use git grep to ensure consistency
git grep -n "personas" -- "*.tsx" "*.ts" | grep -v "audiences"
```

### 6. Verification Script

Create a verification script to ensure resolutions were applied correctly:

```bash
# Check that audience terminology was applied
echo "Checking for missed persona references..."
git grep -i "select persona" -- "*.tsx" "*.ts"

# Check that concept grouping wasn't lost
echo "Verifying concept grouping components exist..."
git grep "ConceptGrouping" -- "*.tsx"
```

## Example Usage

1. Start by analyzing both epics:
   ```bash
   Task(description="Analyze epic conflicts", prompt="/analyze-merge-safety epic/persona-overhaul epic/concept-grouping")
   ```

2. Create the merge strategy document with specific resolution rules

3. Share with team so everyone knows how to resolve conflicts

4. When merging, follow the pre-documented rules

## Pro Tips

- Be VERY specific in resolution instructions (include code examples)
- Document not just WHAT to keep, but HOW to merge
- Include test commands to verify the merge was done correctly
- Update the strategy document as you discover new conflicts
- Consider creating automated tests that verify both features work together

Remember: The goal is to make conflict resolution mechanical and predictable, removing guesswork and ensuring consistency across the team.