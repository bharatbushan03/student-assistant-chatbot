"""Load and parse local custom user documents, outputting raw chunks for vector embeddings."""

import logging
from pathlib import Path

from langchain_community.document_loaders import PDFMinerLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config.settings import get_settings, PROJECT_ROOT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_local_chunks():
    settings = get_settings()
    raw_dir = PROJECT_ROOT / "data" / "raw_documents"
    output_path = settings.processed_chunks_path.parent / "local_chunks.txt"
    
    if not raw_dir.exists():
        logger.info(f"Directory {raw_dir} does not exist. Skipping.")
        return []
        
    documents = []
    
    # Iterate through all files and parse them accordingly
    valid_files = 0
    for file_path in raw_dir.iterdir():
        if file_path.is_file():
            loader = None
            if file_path.suffix.lower() == ".pdf":
                loader = PDFMinerLoader(str(file_path))
            elif file_path.suffix.lower() in [".txt", ".md", ".csv"]:
                # Added fallback for basic text parsing
                loader = TextLoader(str(file_path), encoding="utf-8", autodetect_encoding=True)
            elif file_path.suffix.lower() == ".docx":
                loader = Docx2txtLoader(str(file_path))
                
            if loader:
                try:
                    docs = loader.load()
                    documents.extend(docs)
                    valid_files += 1
                    logger.info("Loaded document: %s", file_path.name)
                except Exception as e:
                    logger.error("Failed to load %s: %s", file_path.name, e)
                    
    if not documents:
        logger.info("No supported documents found in raw_documents.")
        return []
        
    # Split text into overlapping segments
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunked_docs = text_splitter.split_documents(documents)
    
    # Clean up and format chunks
    chunks = []
    for d in chunked_docs:
        c = d.page_content.replace("\n", " ").replace("\r", " ").strip()
        if c:
            chunks.append(c)
            
    # Save the chunks to a separate local file so we don't overwrite web data
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(chunk + "\n")
            
    logger.info("Successfully extracted %d chunks from %d local files.", len(chunks), valid_files)
    return chunks

if __name__ == "__main__":
    generate_local_chunks()
