# /linty

Analyze the current file for security and quality issues using the Linty rules.

Detected issues:
- Hardcoded secrets / API keys
- SQL injection
- eval()
- Unsafe DOM injection (innerHTML / document.write)
- Unsafe shell commands (exec / spawn)
- Unhandled promise rejections
- Loose equality (== / !=)
- var (prefer const/let)
- Leftover console.log
- Loosely typed any (TypeScript)
