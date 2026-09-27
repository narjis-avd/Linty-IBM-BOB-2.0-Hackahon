You are writing the final summary of an automated code review for a developer.

Issues found (JSON):
{{analysis_json}}

Fixes applied (JSON):
{{fixes_json}}

Tests generated: {{test_count}}

Return output in JSON:

{
  "summary": "3-4 sentences: what was wrong, what was fixed, what the tests now guard against",
  "recommendations": ["Short, concrete follow-up the developer should do next"]
}

Rules:
- Only state facts that appear in the JSON above. Do not invent numbers, percentages or time savings.
- 2 to 4 recommendations, each under 20 words.
- Respond with the JSON object only: no markdown fences, no text before or after it.
