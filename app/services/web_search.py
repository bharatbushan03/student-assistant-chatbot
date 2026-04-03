"""Web search and scraping service for fetching information about MIET."""

import logging
from typing import List, Dict, Optional
from functools import lru_cache
import requests
from urllib.parse import quote, urljoin
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# MIET Jammu official website and related sources
MIET_BASE_URL = "https://mietjmu.in"
MIET_SOURCES = [
    "mietjmu.in",
    "miet.ac.in",  # Alternative domain
]

# Key pages to scrape for basic information
MIET_INFO_PAGES = {
    "director": "/directors-msg-ccpe/",
    "chairperson": "/chairperson-message-ccpe/",
    "governing_body": "/governing-body/",
    "management": "/governing-body/",
    "about": "/",
}


def _fetch_page_content(relative_url: str) -> Optional[str]:
    """Fetch and return cleaned text content from a MIET page."""
    try:
        url = urljoin(MIET_BASE_URL, relative_url)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script and style elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()

        # Get main content area
        main_content = soup.find('main') or soup.find('div', class_='content') or soup.body
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
            # Clean up whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n'.join(lines)

        return None
    except Exception as exc:
        logger.debug("Failed to fetch %s: %s", relative_url, exc)
        return None


def _extract_people_info(text: str) -> Dict[str, str]:
    """Extract names and positions from page text."""
    people = {}

    # Common patterns for extracting names and titles
    lines = text.split('\n')

    for line in lines:
        line = line.strip()
        if len(line) < 5 or len(line) > 200:
            continue

        # Look for director/principal/chairman patterns
        lower = line.lower()

        if 'director' in lower and any(kw in lower for kw in ['message', 'desk', 'office']):
            # Try to extract the name
            parts = line.split()
            for i, part in enumerate(parts):
                if part.lower() == 'director':
                    # Name might be before or after
                    if i > 0:
                        people['director'] = ' '.join(parts[max(0, i-3):i]).strip()
                    break

        # Pattern: "Name - Designation" or "Designation: Name"
        if ' - ' in line or ':' in line:
            separator = ' - ' if ' - ' in line else ':'
            parts = line.split(separator)
            if len(parts) == 2:
                left, right = [p.strip() for p in parts]
                # Determine which is name and which is title
                if any(kw in left.lower() for kw in ['director', 'professor', 'dr.', 'mr.', 'mrs.', 'ms.']):
                    people[left] = right
                elif any(kw in right.lower() for kw in ['director', 'professor', 'dr.', 'mr.', 'mrs.', 'ms.']):
                    people[right] = left

    return people


@lru_cache(maxsize=1)
def get_miet_basic_info() -> Dict[str, str]:
    """
    Fetch and cache basic information about MIET from official website.

    Returns a dict with keys like 'director', 'chairperson', etc.
    """
    import re

    info = {}

    # Try multiple URL patterns for director's message page
    director_urls = [
        "/directors-msg-ccpe/",
        "/directors_message/",
        "/directors-msg/",
        "/director-message/",
        "/director/",
    ]

    director_content = None
    for url_path in director_urls:
        director_content = _fetch_page_content(url_path)
        if director_content:
            logger.debug("Found director content at: %s", url_path)
            break

    if director_content:
        # Strategy 1: Look for heading patterns with director name
        # Pattern: "Prof. Ankur Gupta" or "Dr. Ankur Gupta" in headings
        heading_matches = re.findall(
            r'((?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            director_content[:3000]
        )
        if heading_matches:
            # Take the first match that looks like a full name (at least 2 words)
            for match in heading_matches:
                # Clean the match - remove newlines and extra text
                clean_match = match.split('\n')[0].strip()
                words = clean_match.replace('Dr.', '').replace('Prof.', '').replace('Mr.', '').replace('Mrs.', '').replace('Ms.', '').strip().split()
                if len(words) >= 2:  # Full name, not just title
                    info['director'] = clean_match
                    logger.info("Found director name in heading: %s", info['director'])
                    break

        # Strategy 2: Look for "Director" keyword near a name
        if 'director' not in info:
            # Find lines containing both "Director" and a name pattern
            for line in director_content.split('\n'):
                line_lower = line.lower()
                if 'director' in line_lower and len(line) < 150:
                    name_match = re.search(r'((?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', line)
                    if name_match:
                        info['director'] = name_match.group(1)
                        logger.info("Found director in context line: %s", info['director'])
                        break

        # Strategy 3: Look for name patterns in first 500 chars (often contains heading)
        if 'director' not in info:
            matches = re.findall(r'((?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', director_content[:500])
            if matches:
                info['director'] = matches[0]
                logger.info("Found director from early content: %s", info['director'])

    # Try about page for general info
    about_content = _fetch_page_content("/about-us/")
    if about_content:
        # Look for key people mentioned
        for line in about_content.split('\n')[:100]:  # Check first 100 lines
            line_lower = line.lower()
            if 'founder' in line_lower or 'chairperson' in line_lower:
                # Extract potential names
                matches = re.findall(r'((?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', line)
                if matches:
                    if 'founder' in line_lower:
                        info['founder'] = matches[0]
                    if 'chairperson' in line_lower:
                        info['chairperson'] = matches[0]

    # Try governing body page for chairperson and other officials
    governing_content = _fetch_page_content("/governing-body/")
    if governing_content:
        # Look for chairperson - often appears near name
        lines = governing_content.split('\n')
        for i, line in enumerate(lines):
            line_lower = line.lower()
            # Chairperson pattern: "Dr. Renu Gupta\nChairperson" or "Chairperson...Dr. Renu Gupta"
            if 'chairperson' in line_lower:
                # Check this line and nearby lines for name
                search_area = '\n'.join(lines[max(0,i-2):i+3])
                name_match = re.search(r'((?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', search_area)
                if name_match:
                    # Clean the extracted name
                    info['chairperson'] = name_match.group(1).split('\n')[0].strip()
                    logger.info("Found chairperson: %s", info['chairperson'])
                    break

        # Also look for other officials
        for line in lines[:150]:
            line_lower = line.lower()
            if any(kw in line_lower for kw in ['secretary', 'treasurer', 'member', 'director']):
                matches = re.findall(r'((?:Shri|Smt\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', line)
                if matches:
                    full_match = matches[0]
                    if 'secretary' in line_lower and 'secretary' not in info:
                        info['secretary'] = full_match
                    elif 'treasurer' in line_lower and 'treasurer' not in info:
                        info['treasurer'] = full_match

    # Try fetching contact page for address/phone
    contact_content = _fetch_page_content("/contact-us/")
    if not contact_content:
        # Try alternate contact URLs
        contact_content = _fetch_page_content("/contact/")

    if contact_content:
        # Extract address
        for line in contact_content.split('\n'):
            line = line.strip()
            # Look for address patterns
            if any(kw in line.lower() for kw in ['address', 'phone', 'email', 'fax', 'jammu', 'uthogral']):
                if len(line) > 20 and len(line) < 300:
                    if 'address' not in info and any(kw in line.lower() for kw in ['jammu', 'uthogral', 'miet']):
                        info['address'] = line
                    elif 'phone' not in info and any(c.isdigit() for c in line):
                        info['phone'] = line
                    elif 'email' not in info and '@' in line:
                        info['email'] = line

    # If we couldn't find director, try a broader scrape
    if 'director' not in info:
        # Try scraping the homepage for any director mention
        home_content = _fetch_page_content("/")
        if home_content:
            # Look for "Director" mentions in first 3000 chars
            director_section = home_content[:3000]
            matches = re.findall(r'(Dr\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*[-–]\s*Director', director_section, re.IGNORECASE)
            if matches:
                info['director'] = matches[0]
            else:
                # Try reverse pattern: Director - Name
                matches = re.findall(r'Director\s*[-:]\s*(Dr\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', director_section, re.IGNORECASE)
                if matches:
                    info['director'] = matches[0]

    logger.info("Extracted basic MIET info: %s", info)
    return info


def search_web(query: str, num_results: int = 3) -> List[Dict[str, str]]:
    """
    Search the web for MIET-related information using DuckDuckGo.

    Args:
        query: Search query
        num_results: Number of results to return

    Returns:
        List of dicts with 'title', 'url', and 'snippet' keys
    """
    try:
        # Use DuckDuckGo HTML search and parse results
        search_url = f"https://html.duckduckgo.com/html/?q={quote(query)}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        response = requests.get(search_url, headers=headers, timeout=10)
        response.raise_for_status()

        results = []
        html_content = response.text

        # Parse search results from DuckDuckGo HTML
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')

        for result in soup.select('.result', limit=num_results):
            title_elem = result.select_one('.result__title')
            snippet_elem = result.select_one('.result__snippet')
            url_elem = result.select_one('.result__url')

            if title_elem and snippet_elem:
                title = title_elem.get_text(strip=True)
                snippet = snippet_elem.get_text(strip=True)
                url = url_elem.get('href') if url_elem else ''

                # Decode DuckDuckGo URL redirect
                if url and url.startswith('/l/?kh='):
                    from urllib.parse import parse_qs, urlparse
                    parsed = urlparse(url)
                    params = parse_qs(parsed.query)
                    if 'uddg' in params:
                        url = params['uddg'][0]

                results.append({
                    'title': title,
                    'url': url,
                    'snippet': snippet
                })

        logger.info("Web search returned %d results", len(results))
        return results

    except Exception as exc:
        logger.error("Web search failed: %s", exc)
        return []


def scrape_miet_page(relative_url: str) -> Dict[str, any]:
    """
    Scrape a specific MIET page and extract structured information.

    Args:
        relative_url: URL path relative to MIET_BASE_URL (e.g., "/directors_message/")

    Returns:
        Dict with 'title', 'content', 'links', and 'people' keys
    """
    try:
        url = urljoin(MIET_BASE_URL, relative_url)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract title
        title = soup.find('h1')
        page_title = title.get_text(strip=True) if title else soup.title.string if soup.title else "Unknown"

        # Remove script and style elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()

        # Get main content
        main_content = soup.find('main') or soup.find('div', class_='content') or soup.find('article') or soup.body
        content = ""
        if main_content:
            # Extract text from paragraphs
            paragraphs = main_content.find_all('p')
            content = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])

        # Extract links
        links = []
        if main_content:
            for link in main_content.find_all('a', href=True):
                href = link['href']
                text = link.get_text(strip=True)
                if text and href:
                    links.append({'text': text, 'url': urljoin(MIET_BASE_URL, href)})

        # Extract people (names with titles)
        import re
        people = []
        if content:
            matches = re.findall(r'(Dr\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)', content)
            people = list(set(matches))  # Deduplicate

        return {
            'title': page_title,
            'content': content[:5000] if content else "",  # Limit content size
            'links': links[:20],  # Limit links
            'people': people
        }

    except Exception as exc:
        logger.error("Failed to scrape %s: %s", relative_url, exc)
        return {'title': '', 'content': '', 'links': [], 'people': [], 'error': str(exc)}


def _is_basic_info_query(query: str) -> bool:
    """Check if query is asking for basic institutional information."""
    lower = query.lower()
    basic_info_keywords = [
        'director', 'principal', 'chairperson', 'founder', 'owner',
        'management', 'governing body', 'trustee', 'secretary',
        'address', 'contact', 'phone', 'email', 'location',
        'established', 'founded', 'year', 'accreditation', 'affiliation',
        'who is', 'who are', 'name of', 'head', 'chief', 'president'
    ]
    return any(kw in lower for kw in basic_info_keywords)


def search_miet_specific(query: str) -> str:
    """
    Search for MIET-specific information and return a summary.

    First tries direct scraping for basic info queries, then falls back to web search.

    Args:
        query: The user's question about MIET

    Returns:
        Summary of findings or empty string if search failed
    """
    lower_query = query.lower()

    # Special handling for director query
    if 'director' in lower_query:
        logger.info("Director query detected, fetching from MIET website")
        try:
            miet_info = get_miet_basic_info()
            if miet_info and 'director' in miet_info:
                return f"Director of MIET Jammu: {miet_info['director']}"
        except Exception as exc:
            logger.error("Failed to get director info: %s", exc)

    # For other basic info queries, try direct scraping first
    if _is_basic_info_query(query):
        logger.info("Basic info query detected, scraping MIET website directly")
        try:
            miet_info = get_miet_basic_info()
            if miet_info:
                context_parts = []
                for key, value in miet_info.items():
                    context_parts.append(f"{key.replace('_', ' ').title()}: {value}")
                if context_parts:
                    return "\n".join(context_parts)
        except Exception as exc:
            logger.error("Failed to get basic info from scraping: %s", exc)

    # Build a targeted search query for MIET
    miet_query = f"MIET Jammu {query}"

    results = search_web(miet_query, num_results=5)

    if not results:
        # Try alternative search
        results = search_web(f"Model Institute of Engineering and Technology Jammu {query}", num_results=3)

    if not results:
        return ""

    # Build context from search results
    context_parts = []
    for i, result in enumerate(results, 1):
        context_parts.append(
            f"[Source {i}: {result['title']}]\n{result['snippet']}"
        )

    return "\n\n".join(context_parts)
