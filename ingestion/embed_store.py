"""Generate embeddings and store documents in Pinecone."""

import re
from pathlib import Path

from pinecone import Pinecone, ServerlessSpec

from app.config.settings import get_settings
from app.services.embeddings import get_embedding_model


def _is_valid_chunk(text: str) -> bool:
    """Filter out clearly corrupted or boilerplate chunks before embedding."""
    if not text or len(text.strip()) <= 50:
        return False

    replacement_ratio = text.count("�") / max(len(text), 1)
    if replacement_ratio > 0.03:
        return False

    lower = text.lower()
    noisy_tokens = ["facebook", "twitter", "linkedin", "instagram", "all rights reserved"]
    if sum(token in lower for token in noisy_tokens) >= 3:
        return False

    return True


def load_chunks_with_metadata(chunks_path: Path, source_prefix: str = "") -> tuple[list[str], list[dict]]:
    """
    Load chunks and extract metadata.

    Args:
        chunks_path: Path to the chunks file
        source_prefix: Prefix to add to source names

    Returns:
        Tuple of (chunks, metadatas)
    """
    if not chunks_path.exists():
        return [], []

    chunks = []
    metadatas = []
    current_chunk = []
    chunk_index = 0

    with chunks_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip('\n')

            # Check for chunk separator
            if line.startswith('===CHUNK_') and line.endswith('==='):
                # Save previous chunk if exists
                if current_chunk:
                    chunk_text = '\n'.join(current_chunk).strip()
                    if chunk_text and len(chunk_text) > 50:  # Filter tiny chunks
                        chunks.append(chunk_text)

                        # Extract source from chunk if present
                        source = f"{source_prefix}_chunk_{chunk_index}"
                        url_match = re.search(r'Source: (https?://[^\s]+)', chunk_text)
                        if url_match:
                            source = url_match.group(1)

                        metadatas.append({
                            "source": source,
                            "chunk_index": chunk_index,
                            "source_type": source_prefix if source_prefix else "web"
                        })
                        chunk_index += 1
                    current_chunk = []
            else:
                current_chunk.append(line)

        # Don't forget the last chunk
        if current_chunk:
            chunk_text = '\n'.join(current_chunk).strip()
            if chunk_text and len(chunk_text) > 50:
                chunks.append(chunk_text)
                source = f"{source_prefix}_chunk_{chunk_index}"
                url_match = re.search(r'Source: (https?://[^\s]+)', chunk_text)
                if url_match:
                    source = url_match.group(1)
                metadatas.append({
                    "source": source,
                    "chunk_index": chunk_index,
                    "source_type": source_prefix if source_prefix else "web"
                })

    return chunks, metadatas


def load_chunks_simple(chunks_path: Path, source_prefix: str = "local") -> tuple[list[str], list[dict]]:
    """Load chunks from simple line-separated format."""
    if not chunks_path.exists():
        return [], []

    chunks = []
    metadatas = []

    with chunks_path.open("r", encoding="utf-8") as f:
        lines = f.readlines()

    current_chunk = []
    for line in lines:
        line = line.strip()
        if line:
            current_chunk.append(line)
        elif current_chunk:
            chunk_text = ' '.join(current_chunk)
            if len(chunk_text) > 50:
                chunks.append(chunk_text)
                metadatas.append({
                    "source": f"{source_prefix}",
                    "chunk_index": len(chunks) - 1,
                    "source_type": source_prefix
                })
            current_chunk = []

    # Don't forget last chunk
    if current_chunk:
        chunk_text = ' '.join(current_chunk)
        if len(chunk_text) > 50:
            chunks.append(chunk_text)
            metadatas.append({
                "source": f"{source_prefix}",
                "chunk_index": len(chunks) - 1,
                "source_type": source_prefix
            })

    return chunks, metadatas


def clear_index_safely(index) -> None:
    """Delete all vectors across existing namespaces without failing on empty indexes."""
    stats = index.describe_index_stats()
    if hasattr(stats, "get"):
        namespace_map = stats.get("namespaces") or {}
    else:
        namespace_map = getattr(stats, "namespaces", {}) or {}

    namespaces = list(namespace_map.keys()) if hasattr(namespace_map, "keys") else []

    # Fresh indexes can have no namespaces yet; skip delete in that case.
    if not namespaces:
        print("Index is already empty; skipping delete.")
        return

    for namespace in namespaces:
        try:
            index.delete(delete_all=True, namespace=namespace)
        except Exception as exc:
            # Pinecone can return 404 when a namespace disappears between stats/delete calls.
            if "Namespace not found" in str(exc):
                print(f"Namespace '{namespace}' not found during cleanup; skipping.")
                continue
            raise


def main():
    settings = get_settings()
    all_chunks = []
    all_metadatas = []

    # Load Web scrape chunks
    if settings.processed_chunks_path.exists():
        web_chunks, web_metas = load_chunks_with_metadata(
            settings.processed_chunks_path,
            source_prefix="web"
        )
        all_chunks.extend(web_chunks)
        all_metadatas.extend(web_metas)
        print(f"✓ Loaded {len(web_chunks)} chunks from web scraping")

    # Load PDF/Word physical document chunks
    local_path = settings.processed_chunks_path.parent / "local_chunks.txt"
    if local_path.exists():
        local_chunks, local_metas = load_chunks_simple(local_path, source_prefix="local")
        all_chunks.extend(local_chunks)
        all_metadatas.extend(local_metas)
        print(f"✓ Loaded {len(local_chunks)} chunks from local documents")

    # Remove corrupted/noisy and near-duplicate chunks before embedding.
    filtered_chunks = []
    filtered_metadatas = []
    seen_fingerprints = set()
    for chunk, metadata in zip(all_chunks, all_metadatas):
        if not _is_valid_chunk(chunk):
            continue
        fingerprint = " ".join(chunk.lower().split())[:320]
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        filtered_chunks.append(chunk)
        filtered_metadatas.append(metadata)

    removed_count = len(all_chunks) - len(filtered_chunks)
    if removed_count:
        print(f"Filtered out {removed_count} noisy/duplicate chunks before embedding")

    all_chunks = filtered_chunks
    all_metadatas = filtered_metadatas

    if not all_chunks:
        print("ERROR: No chunks found to embed!")
        print("Run 'python run.py' to scrape and process website data first.")
        return

    print(f"\nTotal chunks to embed: {len(all_chunks)}")

    # Log chunk statistics
    chunk_lengths = [len(chunk) for chunk in all_chunks]
    avg_length = sum(chunk_lengths) / len(chunk_lengths)
    print(f"Average chunk size: {avg_length:.0f} characters")

    # Load embedding model
    print("\nLoading embedding model...")
    model = get_embedding_model()

    # Generate embeddings
    print(f"Generating embeddings for {len(all_chunks)} chunks...")
    embeddings = model.encode(
        all_chunks,
        show_progress_bar=True,
        batch_size=32,
        convert_to_numpy=True
    )
    print(f"Generated embeddings with shape: {embeddings.shape}")

    # Connect to Pinecone
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is required to store embeddings.")

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index_name = settings.pinecone_index_name
    embedding_dim = embeddings.shape[1]

    existing_indexes = set(pc.list_indexes().names())
    recreate_index = False

    if index_name in existing_indexes:
        index_info = pc.describe_index(index_name)
        if index_info.dimension != embedding_dim:
            print(
                f"Recreating Pinecone index '{index_name}' to match embedding dim {embedding_dim}"
            )
            pc.delete_index(index_name)
            recreate_index = True
        else:
            print(f"Using existing Pinecone index '{index_name}'")

    if index_name not in existing_indexes or recreate_index:
        print(f"Creating Pinecone index '{index_name}' (dim={embedding_dim}, metric=cosine)...")
        pc.create_index(
            name=index_name,
            dimension=embedding_dim,
            metric="cosine",
            spec=ServerlessSpec(
                cloud=settings.pinecone_cloud,
                region=settings.pinecone_region,
            ),
        )

    index = pc.Index(index_name)

    # Start from a clean slate
    clear_index_safely(index)

    # Prepare data
    ids = [f"chunk_{i}" for i in range(len(all_chunks))]
    embeddings_list = embeddings.tolist()

    # Insert in batches
    batch_size = 500
    total_inserted = 0

    print(f"\nStoring in Pinecone (batch size: {batch_size})...")
    for i in range(0, len(all_chunks), batch_size):
        end_idx = min(i + batch_size, len(all_chunks))

        vectors = [
            {
                "id": ids[j],
                "values": embeddings_list[j],
                "metadata": {**all_metadatas[j], "text": all_chunks[j]},
            }
            for j in range(i, end_idx)
        ]

        index.upsert(vectors=vectors)
        total_inserted += (end_idx - i)
        print(f"  Batch {i//batch_size + 1}: {total_inserted}/{len(all_chunks)} chunks stored")

    print(f"\n{'='*60}")
    print(f"✓ Successfully stored {total_inserted} chunks in Pinecone")
    print(f"  Index: {settings.pinecone_index_name}")
    print(f"  Cloud/Region: {settings.pinecone_cloud}/{settings.pinecone_region}")
    print(f"{'='*60}")
    print("\nYou can now start the chatbot with: python -m uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
