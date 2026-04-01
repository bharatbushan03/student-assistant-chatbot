from typing import List

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ModuleNotFoundError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter


def chunk_texts(texts: List[str], chunk_size: int = 1500, chunk_overlap: int = 300) -> List[str]:
    """
    Split cleaned texts into overlapping chunks.

    Args:
        texts: List of cleaned text documents
        chunk_size: Size of each chunk (default 1500 for better context)
        chunk_overlap: Overlap between chunks (default 300 for continuity)

    Returns:
        List of text chunks with preserved context
    """
    # Use larger chunks with more overlap for better context preservation
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        keep_separator=True
    )
    documents = splitter.create_documents(texts)
    return [doc.page_content for doc in documents]
