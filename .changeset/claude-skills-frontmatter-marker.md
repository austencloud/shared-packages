---
"@austencloud/claude-skills": patch
---

Write the managed-by marker as a YAML comment on line 2 of each synced SKILL.md
and AGENT.md, so the frontmatter opens the file. Codex skipped any synced skill
whose first line was the old HTML comment, and Claude Code showed that comment
as the description of every synced skill.

Sync now refuses a template that does not open with a closed frontmatter block,
and `clean` treats a file as managed only when the marker sits at its top.
