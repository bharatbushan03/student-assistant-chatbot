"""
Comprehensive Knowledge Base Rebuild Script

This script rebuilds the entire knowledge base with:
1. Web scraping with better content extraction
2. Improved text cleaning
3. Larger chunks with better overlap
4. Metadata preservation
5. Fresh Pinecone storage

Usage: python rebuild_kb.py
"""

import os
import sys
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parent


def ensure_import_path() -> None:
    root = project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


def clear_old_data(settings):
    """Clear old data to start fresh."""
    print("\n" + "="*60)
    print("STEP 0: Clearing old data")
    print("="*60)

    # Clear processed chunks
    if settings.processed_chunks_path.exists():
        settings.processed_chunks_path.unlink()
        print(f"✓ Cleared old chunks: {settings.processed_chunks_path}")


def load_and_process():
    """Load web pages and process into chunks."""
    os.environ.setdefault("USER_AGENT", "student-assistant-chatbot/0.1")
    from ingestion.langchain_web_loader import main as load_web_content

    print("\n" + "="*60)
    print("STEP 1: Loading web content")
    print("="*60)

    load_web_content()


def embed_and_store():
    """Generate embeddings and store in Pinecone."""
    from ingestion.embed_store import main as embed_chunks

    print("\n" + "="*60)
    print("STEP 2: Generating embeddings")
    print("="*60)

    embed_chunks()


def verify_storage():
    """Verify that data was stored correctly in Pinecone."""
    from app.config.settings import get_settings
    from app.services.embeddings import get_embedding_model
    from pinecone import Pinecone

    print("\n" + "="*60)
    print("STEP 3: Verifying storage")
    print("="*60)

    settings = get_settings()

    if not settings.pinecone_api_key:
        print("✗ PINECONE_API_KEY not set; cannot verify storage.")
        return False

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)

    try:
        stats = index.describe_index_stats()
        total_vectors = stats.get("total_vector_count", 0)
        print(f"✓ Index contains {total_vectors} vectors")

        # Test a sample query
        print("\nTesting sample retrieval...")
        model = get_embedding_model()
        sample_vector = model.encode("B.Tech admission requirements").tolist()
        results = index.query(
            vector=sample_vector,
            top_k=3,
            include_metadata=True,
            include_values=False,
        )
        print(f"✓ Retrieved {len(results.get('matches', []))} chunks for sample query")

        return True
    except Exception as e:
        print(f"✗ Verification failed: {e}")
        return False


def main():
    """Main rebuild process."""
    print("="*60)
    print("MIET KNOWLEDGE BASE REBUILD")
    print("="*60)
    print("\nThis will rebuild the entire knowledge base from scratch.")
    print("It may take several minutes depending on your connection.\n")

    response = input("Continue? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("Cancelled.")
        return

    ensure_import_path()

    from app.config.settings import get_settings
    settings = get_settings()

    try:
        # Step 0: Clear old data
        clear_old_data(settings)

        # Step 1: Load web content
        load_and_process()

        # Step 2: Embed and store
        embed_and_store()

        # Step 3: Verify
        if verify_storage():
            print("\n" + "="*60)
            print("✓ REBUILD COMPLETE!")
            print("="*60)
            print("\nYour knowledge base is ready.")
            print("Start the chatbot with: python -m uvicorn app.main:app --reload")
        else:
            print("\n✗ Rebuild completed with verification errors.")
            sys.exit(1)

    except Exception as e:
        print(f"\n✗ Rebuild failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
