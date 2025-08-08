The goal is to rapidly get full context on the aforementioned GitHub Issue and the work-in-progress on its feature branch, so you know exactly what’s been done and what remains.

1. Fetch latest and switch to the feature branch

git fetch --all --prune
git checkout feature/<branch-name>

2. Read the Issue description and comments

gh issue view <issue-number> --json title,body,comments --jq '.'

3. Inspect the branch’s commit history

git log origin/main..HEAD --oneline --graph --decorate
git show --stat HEAD

4. List all files changed so far

git diff origin/main...HEAD --name-status

5. Review the full diff in context

git diff origin/main...HEAD | less -R

6. Blame key files to see who touched what

git blame path/to/important_file.js | sed -n '1,200p'

7. Search documentation for references to this feature (if any)

grep -R "<search-term>" -n .docs/
[ONLY IF ANY POTENTIALLY INTERESTING REFERENCES ARE FOUND] less .docs/<file-name>

With these steps, you’ll have:

- The Issue’s requirements and discussion
- A clear view of what code has changed
- Author and timing details for each change
- Any relevant docs pointers to deepen your understanding.
