# Create Issue Command

This command documents the mindset for creating GitHub issues that actually help developers get shit done. The goal is to front-load all the context and investigation work so the person implementing doesn't waste time hunting through codebases, figuring out patterns, or making assumptions about how things should work. Good issues are dense with technical specifics - file paths, line numbers, existing patterns to follow, component references, state management approaches. They cut through vague requirements and corporate speak to give developers exactly what they need: a clear problem statement, technical context from the existing codebase, and concrete acceptance criteria. This approach saves hours of discovery work and prevents the back-and-forth of "wait, how does this actually work in our system?"

## Philosophy

- **Be direct and concise** - No corporate speak or unnecessary verbosity
- **Technical precision** - Reference specific files, line numbers, and code snippets
- **Problem-focused** - Clearly state what's broken/missing and why it matters
- **Actionable** - Provide clear acceptance criteria without over-specification
- **Contextual** - Include technical context that helps the developer understand existing patterns, components, and approaches used in the codebase

## Approach

1. **Investigate thoroughly** - Read relevant files, understand existing patterns, find similar implementations in the codebase

2. **Provide technical context** - When applicable, include:
   - Existing component patterns to follow (with file references)
   - State management approaches used (loading states, optimistic updates)
   - Styling patterns and class conventions
   - API patterns and data flow
   - Similar implementations to reference

3. **Use specific references** - Include file paths, line numbers, component names, function signatures

4. **Be helpful, not verbose** - Dense technical info is valuable, corporate fluff is not

5. **Focus on developer experience** - Save the future developer time by providing context they'd otherwise have to hunt for

6. **Proper labeling** - Use appropriate labels like `enhancement`, `bug`, `epic:name`

## What NOT to Do

Don't write corporate AI slop bullshit that sounds like it came from a product manager's fever dream. Avoid generic bullets like "implement modern UI/UX best practices" or "enhance user experience with improved functionality" - that's meaningless garbage that could apply to any project. Don't write vague acceptance criteria like "feature works as expected" or "UI looks modern" - what the fuck does that even mean? Skip the generic testing bullets ("ensure comprehensive error handling") unless you specify exactly which errors and how to handle them. The worst issues are full of talkative bullet points that sound professional but provide zero actionable information. Instead of "leverage cutting-edge design patterns for optimal performance," say "use AlertDialog from @/components/ui/alert-dialog like tool-card.tsx line 119." One specific file reference with line numbers is worth more than ten generic corporate bullets. The goal is technical density, not word count. NOT TWO ISSUES CAN LOOK THE SAME. WRITE TEXT THAT IS ACTUALLY MEANT TO BE READ AND UNDERSTOOD BY A DEVELOPER AND NOT JUST A FUCKING PRODUCT MANAGER OR SCRUM MASTER TO SENTIRSE BIEN CONSIGO MISMO EN SU MEANINGLESS LIFE.

## Labels to Use

- `enhancement` - New features or improvements
- `bug` - Something is broken
- `epic:name` - Part of a specific epic (e.g., `epic:concept-grouping`)

The mental model here is simple: you're writing for a competent developer who's smart but doesn't know this specific codebase. They can read code, understand patterns, and make good technical decisions - but they shouldn't have to spelunk through your entire repo to figure out "oh, we use AlertDialog for confirmations" or "oh, we handle loading states with isDeleting props" or "oh, our delete buttons follow this specific styling pattern." Do that investigation work upfront and hand it to them on a silver platter. Include the specific imports they'll need, the components to reference, the line numbers where similar logic exists. Think of it as technical documentation disguised as a GitHub issue - you're not just describing what to build, you're showing them exactly how to build it in the context of your existing system. This approach eliminates the most frustrating part of development: not knowing how things are supposed to work in this particular codebase.
