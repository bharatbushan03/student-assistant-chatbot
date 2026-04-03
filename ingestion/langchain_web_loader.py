"""Scrape MIET Jammu website pages, clean, chunk, and save for embedding."""

import logging
from pathlib import Path

from langchain_community.document_loaders import WebBaseLoader

from app.config.settings import get_settings
from app.utils.text_cleaning import normalize_whitespace
from ingestion.clean import clean_text
from ingestion.chunk import chunk_texts

logger = logging.getLogger(__name__)

urls = [
    "https://mietjmu.in/admission_miet/how-to-apply/",
    "https://mietjmu.in/admission_miet/tuition-fees/",
    "https://mietjmu.in/admission_miet/",
    "https://mietjmu.in/btech-cse/",
    "https://mietjmu.in/cse-aiml/",
    "https://mietjmu.in/cse-cybersecurity/",
    "https://mietjmu.in/btech-ce/",
    "https://mietjmu.in/btech-ee/",
    "https://mietjmu.in/btech-ece/",
    "https://mietjmu.in/b-tech_lateral/",
    "https://mietjmu.in/mtech/",
    "https://mietjmu.in/mba/",
    "https://mietjmu.in/bba/",
    "https://mietjmu.in/bcom/",
    "https://mietjmu.in/bba-bfsi/",
    "https://mietjmu.in/bba-llb/",
    "https://mietjmu.in/llb-hons/",
    "https://mietjmu.in/bca-hons/",
    "https://mietjmu.in/mca/",
    "https://mietjmu.in/bjmc-course/",
    "https://mietjmu.in/faculty-applied-science-humanities/",
    "https://ccpe.mietjmu.in/",
    "https://tlc.mietjmu.in/",
    "https://mietjmu.in/academic-calendar/",
    "https://mietjmu.in/about-us/",
    "https://mietjmu.in/chairperson/",
    "https://mietjmu.in/directors_message/",
    "https://mietjmu.in/academic-collaboration/",
    "https://mietjmu.in/industrial-collaboration/",
    "https://mietjmu.in/rankings/",
    "https://mietjmu.in/campus-life/infra-maps/",
    "https://mietjmu.in/intranet/",
    "https://mietjmu.in/governing-body/",
    "https://mietjmu.in/academic-council/",
    "https://mietjmu.in/bos-2/",
    "https://mietjmu.in/finance_committee/",
    "https://mietjmu.in/coe/",
    "https://mietjmu.in/iqac/",
    "https://mietjmu.in/careers/",
    "https://mietjmu.in/freshmen-induction/",
    "https://mietjmu.in/tp-cell/",
    "https://mietjmu.in/clubs/",
    "https://mietjmu.in/alumni/",
    "https://mietjmu.in/sports/",
    "https://pi360.net/pi360_website/wordpress/",
    "https://mietjmu.in/campus-life/tedxmiet/",
    "https://mietjmu.in/campus-life/college-bootcamps/",
    "https://mietjmu.in/campus-life/college-sammilan-event/",
    "https://mietjmu.in/grievance/",
    "https://mietjmu.in/cash/",
    "https://mietjmu.in/anti_ragging/",
    "https://mietjmu.in/academics/",
    "https://mietjmu.in/research-development-cell/",
    "https://mietjmu.in/research-development-cell/crie_research/",
    "https://mietjmu.in/research-development-cell/innovation-entrepreneurship-research/",
    "https://mietjmu.in/centres-of-excellence/",
    "https://mietjmu.in/icngcis/",
    "https://mietjmu.in/news/",
    "https://mietjmu.in/cbc-eclerx-miet-jammu/",
    "https://mietjmu.in/miet-jammu-placement-coding-ninjas-bba-bfsi/",
]


def extract_title_from_url(url: str) -> str:
    """Extract a readable title from URL."""
    path = url.replace('https://', '').replace('http://', '').split('/')
    parts = [p for p in path[1:] if p]

    if not parts:
        return "MIET Jammu Home"

    title = parts[-1].replace('-', ' ').replace('_', ' ').title()
    return title


def should_skip_url(url: str) -> bool:
    """Skip binary document links that are not suitable for HTML scraping."""
    lower = url.lower()
    return lower.endswith((".pdf", ".doc", ".docx", ".ppt", ".pptx"))


def enhance_document_content(doc, url: str) -> str:
    """
    Enhance document content with better structure and metadata.

    Prepends URL-derived context to help with retrieval.
    """
    title = extract_title_from_url(url)

    # Extract metadata if available
    source_info = f"Source: {url}\nPage: {title}\n\n"

    # Get the page content
    content = doc.page_content if hasattr(doc, 'page_content') else str(doc)

    # Combine with source info
    return source_info + content


def save_chunks(chunks: list[str], output_path: Path) -> None:
    """Save chunks with proper formatting."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for i, chunk in enumerate(chunks):
            # Add chunk separator for better visibility
            f.write(f"===CHUNK_{i}===\n")
            f.write(normalize_whitespace(chunk))
            f.write("\n\n")
    logger.info("Saved %d chunks to %s", len(chunks), output_path)


def main():
    settings = get_settings()
    documents = []
    failed_urls = []

    logger.info("Starting to load %d URLs...", len(urls))

    for i, url in enumerate(urls, 1):
        if should_skip_url(url):
            logger.info("[%d/%d] Skipping non-HTML URL: %s", i, len(urls), url)
            continue

        try:
            logger.info("[%d/%d] Loading: %s", i, len(urls), url)

            # Configure loader with better extraction
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            loader = WebBaseLoader(
                url,
                verify_ssl=True,
                continue_on_failure=True,
                header=headers,
                timeout=30,
            )

            docs = loader.load()

            if docs:
                # Enhance each document with source info
                for doc in docs:
                    enhanced_content = enhance_document_content(doc, url)
                    doc.page_content = enhanced_content
                    documents.append(doc)

                logger.info("  ✓ Loaded %d docs from %s", len(docs), url)
            else:
                logger.warning("  ⚠ No content from %s", url)
                failed_urls.append(url)

        except Exception as exc:
            logger.warning("  ✗ Failed to load %s: %s", url, exc)
            failed_urls.append(url)

    logger.info("\n" + "="*60)
    logger.info("Successfully loaded %d documents from %d URLs", len(documents), len(urls) - len(failed_urls))

    if failed_urls:
        logger.warning("Failed to load %d URLs:", len(failed_urls))
        for url in failed_urls:
            logger.warning("  - %s", url)
    logger.info("="*60 + "\n")

    if not documents:
        logger.error("No documents were loaded! Check URLs and connectivity.")
        return

    # Clean documents
    logger.info("Cleaning %d documents...", len(documents))
    cleaned_docs = [clean_text(doc.page_content) for doc in documents]

    # Filter out empty documents
    cleaned_docs = [doc for doc in cleaned_docs if doc and len(doc.strip()) > 50]

    # Remove near-duplicate documents before chunking to reduce noisy retrieval.
    unique_docs = []
    seen_fingerprints = set()
    for doc in cleaned_docs:
        fingerprint = " ".join(doc.lower().split())[:300]
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        unique_docs.append(doc)

    cleaned_docs = unique_docs
    logger.info("After cleaning: %d documents with content", len(cleaned_docs))

    # Chunk with larger size and overlap for better context
    logger.info("Chunking documents...")
    chunks = chunk_texts(cleaned_docs, chunk_size=1500, chunk_overlap=300)
    logger.info("Created %d chunks", len(chunks))

    # Log chunk statistics
    chunk_lengths = [len(chunk) for chunk in chunks]
    if chunk_lengths:
        avg_length = sum(chunk_lengths) / len(chunk_lengths)
        min_length = min(chunk_lengths)
        max_length = max(chunk_lengths)
        logger.info("Chunk stats - Avg: %.0f chars, Min: %d chars, Max: %d chars",
                   avg_length, min_length, max_length)

    save_chunks(chunks, settings.processed_chunks_path)
    logger.info("Done! Knowledge base prepared.")


if __name__ == "__main__":
    import os
    os.environ.setdefault("USER_AGENT", "student-assistant-chatbot/0.1")
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    main()
