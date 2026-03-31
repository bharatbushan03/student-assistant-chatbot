from pathlib import Path

import chromadb

from app.config.settings import get_settings
from app.services.embeddings import get_embedding_model


def load_chunks(chunks_path: Path) -> list[str]:
    if not chunks_path.exists():
        raise FileNotFoundError(f"{chunks_path} not found. Please run the chunking process first.")

    with chunks_path.open("r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def main():
    settings = get_settings()
    chunks = load_chunks(settings.processed_chunks_path)
    print(f"Loaded {len(chunks)} chunks from {settings.processed_chunks_path}")

    model = get_embedding_model()
    embeddings = model.encode(chunks, show_progress_bar=True)

    client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
    collection = client.get_or_create_collection(settings.chroma_collection)

    metadatas = [{"source": f"chunk_{i}"} for i in range(len(chunks))]
    ids = [f"chunk_{i}" for i in range(len(chunks))]

    collection.upsert(documents=chunks, embeddings=embeddings.tolist(), metadatas=metadatas, ids=ids)
    print(f"{len(chunks)} chunks added to ChromaDB collection '{settings.chroma_collection}'.")


if __name__ == "__main__":
    main()