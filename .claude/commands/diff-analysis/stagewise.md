Operate as an agent over a repository with **unstaged changes**. Work exclusively on the current diff set, including created, modified, deleted, and renamed files. Invoke `git diff` in its advanced modes to extract line-level, block-level, and metadata differences (e.g., git status --porcelain; git diff --name-status; git diff --stat;git diff --unified=3 --function-context; git diff --name-only --diff-filter=A; git diff --numstat; examine new files added if any; git diff --unified de specific files, etc.). Produce a comprehensive descriptive map of alterations without omitting technical granularity.

**CRITICAL**: For untracked files (marked ?? in git status), ALWAYS examine their actual content and line counts using `wc -l`, `head`, `file`, and direct file inspection commands. Git diff modes will NOT reveal untracked file contents. Compare untracked file sizes against their potential tracked counterparts or similar files in the repository to identify massive additions, new implementations, or significant content changes that require separate commit isolation. Never assume untracked files are simple additions without content analysis.

**MANDATORY COMPLETENESS CHECK**: 
1. Execute `git status --porcelain` to identify ALL files changed
2. For EVERY file listed, determine its nature:
   - Modified (M): Use `git diff --unified=3` to see all changes
   - Deleted (D): Note what was removed
   - Untracked (??): Use `wc -l` and Read tool to examine content
   - Renamed (R): Compare old vs new with `git show HEAD:old | wc -l` vs `wc -l new`
3. VERIFY: Count files analyzed matches total files in git status
4. NO FILE GETS SKIPPED - if you see a file, you analyze it

Partition the changes into logically cohesive commit units, guided by continuity of codepaths, structural consistency, functional affinity, or isolation of complete components. Keep grouping criteria open and adaptive, selecting the configuration that yields the most natural self-contained commit boundaries. Distinguish incidental or peripheral modifications—such as but not limited to documentation updates, configuration adjustments, or style file edits—and isolate them into independent commits to prevent contamination of the primary change groups.

Output must provide both a precise description of all modifications and their commit-ready grouping, ensuring no loss of information in the transition from diff to commits.
