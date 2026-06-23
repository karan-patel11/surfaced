PROMPT_GENERATION = """You are simulating how real buyers research products using AI assistants.

Category: {category}
Brands in consideration: {brands}

Generate {n} distinct, natural questions a real prospective buyer would ask an
AI assistant when researching this category. Span the funnel:
- broad discovery ("best X for Y")
- comparison ("X vs Y for [use case]")
- constraint-driven ("most affordable X", "X for small teams", "X with [feature]")
- bottom-funnel ("is X worth it", "alternatives to X")

Rules:
- Write questions a buyer would actually type, not marketing copy.
- Do NOT mention every brand by name; most questions should be brand-neutral so
  we can measure which brands the AI surfaces on its own.
- A few comparison questions may name 2 brands.
- No numbering, no preamble.

Return ONLY a JSON array of strings:
["question one", "question two", ...]
"""

EXTRACTION = """You are analyzing an AI assistant's answer to extract brand visibility data.

The buyer asked: "{prompt}"

The AI assistant answered:
\"\"\"
{answer}
\"\"\"

Brands we are tracking: {tracked_brands}

For EACH tracked brand, determine how it appeared in this answer. Be strict:
judge only what the text actually says.

Return ONLY this JSON object, no other text:
{
  "brands": [
    {
      "name": "<brand>",
      "mentioned": true/false,
      "position": <1-based order of first mention among brands, or null if absent>,
      "recommended": true/false,
      "sentiment": "positive" | "neutral" | "negative" | "absent",
      "context": "<<=12 word snippet of how it was framed, or empty if absent>"
    }
  ],
  "other_brands_mentioned": ["<any untracked brand the answer named>"]
}

Rules:
- "mentioned" is true only if the brand name actually appears.
- "recommended" requires explicit endorsement language, not mere inclusion in a list.
- "position" ranks tracked brands by first appearance; absent brands get null.
- Capture untracked brands in other_brands_mentioned.
"""
