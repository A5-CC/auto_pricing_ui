Operate as an agent over a repository with **unpushed commits**. Work exclusively on commits that exist locally but have not been pushed to the remote branch. Invoke `git log`, `git show`, and `git diff` in their advanced modes to extract commit-level, line-level, block-level, and metadata differences across all unpushed commits. Produce a comprehensive descriptive map of alterations without omitting technical granularity.

**CRITICAL**: For each unpushed commit, analyze both the commit message and the actual changes to understand the intent vs implementation. Use `git show --stat`, `git show --name-status`, and `git show --unified=3` for each commit to capture complete change context.

**MANDATORY COMPLETENESS CHECK**:
1. Execute `git log --oneline origin/master..HEAD` (or appropriate upstream) to identify ALL unpushed commits
2. For EVERY commit listed, determine its nature:
   - Use `git show <commit> --stat` to see file change summary
   - Use `git show <commit> --name-status` to see file operations (A/M/D/R)
   - Use `git show <commit> --unified=3` to see detailed line changes
   - Cross-reference commit message with actual changes for consistency
3. VERIFY: Count commits analyzed matches total unpushed commits
4. NO COMMIT GETS SKIPPED - if you see a commit, you analyze it completely

**COMMIT RELATIONSHIP ANALYSIS**:
- Examine logical dependencies between commits
- Identify commits that build upon each other vs independent changes
- Look for commits that should be squashed together
- Spot commits that introduce and then fix issues
- Find commits with overlapping file changes that might conflict

Partition the unpushed commits into logically cohesive groups, guided by:
- Feature completion boundaries
- Bug fix isolation
- Refactoring scope
- Component or module affinity
- Functional independence

Distinguish different types of commits:
- Feature additions
- Bug fixes
- Refactoring changes
- Documentation updates
- Configuration adjustments
- Style/formatting changes

**RECOMMENDATIONS OUTPUT**:
1. **Commit Quality Assessment**: Evaluate each commit's message clarity and change scope
2. **Squash Opportunities**: Identify commits that should be combined
3. **Reorder Suggestions**: Recommend logical commit sequence
4. **Split Recommendations**: Identify commits doing too many things
5. **Push Strategy**: Suggest whether to push as-is, rebase, or restructure

Output must provide both a precise description of all commit modifications and their reorganization recommendations, ensuring optimal commit history before pushing to remote.