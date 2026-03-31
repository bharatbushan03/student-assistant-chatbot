from typing import List

from langchain.text_splitter import RecursiveCharacterTextSplitter


def chunk_texts(texts: List[str], chunk_size: int = 1000, chunk_overlap: int = 50) -> List[str]:
	"""Split cleaned texts into overlapping chunks."""
	splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
	documents = splitter.create_documents(texts)
	return [doc.page_content for doc in documents]
