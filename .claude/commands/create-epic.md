# Create Epic Command

No fucking around with GitHub Projects or Milestones - just labels and tracking issues that actually work. The goal is to create a structured epic that developers can navigate and complete without hunting through scattered information or dealing with corporate project management theater.

Epic = label + issues. Create an epic label, optionally create a tracking issue if the epic needs coordination, then create individual issues with proper technical context.

## The System

1. Create epic label: `gh label create "epic:epic-name" --description "Brief scope" --color "0052CC"`
2. Create individual issues with `epic:epic-name` label
3. If you need coordination, create a tracking issue. When other issues mention it, GitHub auto-tracks them.

## Epic Labels

```bash
gh label create "epic:pricing-extraction" --description "Storage facility pricing scraping" --color "0052CC"
```

## Individual Issues

- Use `epic:epic-name` label
- Follow anti-slop philosophy: technical context, file references, concrete acceptance criteria
- If mentioning tracking issue: `Related to #123` - GitHub handles the rest

## Optional Tracking Issue

Only if epic needs coordination. Title starts with `[EPIC TRACKING]` and that's it - write whatever makes sense.

Other issues mention this one, GitHub shows the connections automatically.

## Mental Model

Epic label groups work. Issues contain technical context. Tracking issue provides overview if needed. GitHub handles the relationship magic when issues reference each other.