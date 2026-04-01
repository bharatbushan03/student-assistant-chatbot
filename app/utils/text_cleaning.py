import re
from typing import List


def normalize_whitespace(text: str) -> str:
    """
    Clean whitespace while preserving document structure.

    Preserves paragraph breaks (double newlines) and list structure
    while removing excessive whitespace and non-breaking spaces.
    """
    # Replace non-breaking spaces with regular spaces
    text = text.replace("\u00a0", " ")
    text = text.replace("\u200b", "")  # Remove zero-width spaces
    text = text.replace("\ufeff", "")  # Remove BOM

    # Preserve paragraph breaks - replace with placeholder
    text = re.sub(r'\n\s*\n', '[[PARA_BREAK]]', text)

    # Normalize other whitespace
    text = re.sub(r'[\t\r\f\v]+', ' ', text)
    text = re.sub(r' +', ' ', text)

    # Restore paragraph breaks
    text = text.replace('[[PARA_BREAK]]', '\n\n')

    # Clean up lines within paragraphs
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        cleaned = line.strip()
        if cleaned:
            cleaned_lines.append(cleaned)

    return '\n\n'.join(cleaned_lines)


def extract_headings_and_content(text: str) -> List[dict]:
    """
    Extract sections with their headings for better chunking.

    Returns a list of dicts with 'heading' and 'content' keys.
    """
    sections = []
    lines = text.split('\n')
    current_heading = ""
    current_content = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Detect headings (lines that look like headers)
        is_heading = (
            line.isupper() or
            (len(line) < 100 and line.endswith(':')) or
            line.startswith(('#', '##', '###')) or
            (len(line) < 80 and not any(c.islower() for c in line))
        )

        if is_heading:
            if current_content:
                sections.append({
                    'heading': current_heading,
                    'content': '\n'.join(current_content)
                })
            current_heading = line.lstrip('#').strip()
            current_content = []
        else:
            current_content.append(line)

    # Don't forget the last section
    if current_content:
        sections.append({
            'heading': current_heading,
            'content': '\n'.join(current_content)
        })

    return sections
