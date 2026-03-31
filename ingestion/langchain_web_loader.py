from pathlib import Path

from langchain_community.document_loaders import WebBaseLoader

from app.config.settings import get_settings
from app.utils.text_cleaning import normalize_whitespace
from ingestion.clean import clean_text
from ingestion.chunk import chunk_texts


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
    "https://mietjmu.in/downloads/brochure_2025.pdf",
    "https://mietjmu.in/intranet/",
    "https://mietjmu.in/news/",
    "https://mietjmu.in/cbc-eclerx-miet-jammu/",
    "https://mietjmu.in/miet-jammu-placement-coding-ninjas-bba-bfsi/",
]


def save_chunks(chunks: list[str], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(normalize_whitespace(chunk) + "\n")
    print(f"Saved {len(chunks)} chunks to {output_path}")


def main():
    settings = get_settings()
    documents = []

    for url in urls:
        loader = WebBaseLoader(url)
        docs = loader.load()
        documents.extend(docs)

    print(f"Successfully loaded {len(documents)} documents from the web pages.")

    cleaned_docs = [clean_text(doc.page_content) for doc in documents]
    chunks = chunk_texts(cleaned_docs, chunk_size=1000, chunk_overlap=50)
    save_chunks(chunks, settings.processed_chunks_path)


if __name__ == "__main__":
    main()
