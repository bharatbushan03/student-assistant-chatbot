"""
Test script to validate RAG retrieval quality.

Run this to check if the knowledge base is properly storing and retrieving information.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config.settings import get_settings
from app.services.retriever import retrieve, retrieve_with_scores


def test_retrieval():
    """Test retrieval with common student questions."""

    test_queries = [
        "What are the admission requirements for B.Tech CSE?",
        "What is the fee structure for MBA?",
        "Tell me about placement statistics",
        "What courses are offered at MIET Jammu?",
        "How to apply for admission?",
        "What is the eligibility criteria for B.Tech?",
        "Tell me about campus facilities",
        "What is the contact number for admissions?",
    ]

    print("=" * 80)
    print("MIET CHATBOT - RETRIEVAL TEST")
    print("=" * 80)

    settings = get_settings()
    print(f"\nPinecone Index: {settings.pinecone_index_name}")
    print(f"Default chunks retrieved: {settings.num_context_chunks}\n")

    for query in test_queries:
        print(f"\n{'='*80}")
        print(f"QUERY: {query}")
        print(f"{'='*80}")

        try:
            # Get chunks with scores
            results = retrieve_with_scores(query, n_results=5)

            print(f"\nRetrieved {len(results)} chunks:\n")

            for i, result in enumerate(results, 1):
                score = result.get('score', 0)
                content = result.get('content', '')

                # Show first 300 chars of content
                preview = content[:300].replace('\n', ' ')
                if len(content) > 300:
                    preview += "..."

                print(f"  Chunk {i} (score: {score:.3f}):")
                print(f"    {preview}")
                print()

        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n{'='*80}")
    print("Test complete!")
    print(f"{'='*80}")


def interactive_test():
    """Interactive test mode."""
    print("\n" + "=" * 80)
    print("INTERACTIVE RETRIEVAL TEST")
    print("Type your question (or 'quit' to exit)")
    print("=" * 80 + "\n")

    while True:
        query = input("\nQuestion: ").strip()

        if query.lower() in ['quit', 'exit', 'q']:
            break

        if not query:
            continue

        print(f"\n{'-'*80}")
        print("RETRIEVED CONTEXT:")
        print(f"{'-'*80}\n")

        try:
            results = retrieve_with_scores(query, n_results=5)

            for i, result in enumerate(results, 1):
                content = result.get('content', '')
                score = result.get('score', 0)

                print(f"[{i}] Score: {score:.3f}")
                print(content[:500])
                print(f"\n{'-'*40}\n")

        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test RAG retrieval quality")
    parser.add_argument("--interactive", "-i", action="store_true",
                       help="Run in interactive mode")

    args = parser.parse_args()

    if args.interactive:
        interactive_test()
    else:
        test_retrieval()
