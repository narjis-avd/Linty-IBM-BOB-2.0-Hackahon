# Linty coding rules

- No hardcoded secrets or API keys in source; load them from the environment.
- Use parameterized queries — never build SQL by string concatenation.
- Avoid eval() and unsafe DOM injection (innerHTML / document.write).
- Handle promise rejections (.catch or try/catch).
- Use === / !== instead of == / != (except the safe `x == null` idiom).
- Prefer const/let over var.
- No leftover console.log in committed code.
- (TypeScript) avoid any; prefer unknown or a concrete type.
