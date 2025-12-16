#!/usr/bin/env python3
"""
GRDA Q&A System

This script creates a vector store from processed GRDA documents and provides
a query interface for answering questions using RAG (Retrieval Augmented Generation).

Requirements:
pip install langchain langchain-openai langchain-community faiss-cpu openai python-dotenv
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Try to import required libraries
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain_community.vectorstores import FAISS
    from langchain_openai import OpenAIEmbeddings
    from langchain.schema import Document
    HAVE_LANGCHAIN = True
except ImportError:
    HAVE_LANGCHAIN = False
    logger.warning("LangChain not available. Install with: pip install langchain langchain-openai langchain-community")

try:
    from openai import OpenAI
    HAVE_OPENAI = True
except ImportError:
    HAVE_OPENAI = False
    logger.warning("OpenAI not available")

HAVE_QA = HAVE_LANGCHAIN and HAVE_OPENAI


class GRDAQASystem:
    def __init__(self, processed_dir, vector_store_dir=None):
        """
        Initialize the Q&A system.
        
        Args:
            processed_dir: Directory containing processed/enriched JSON documents
            vector_store_dir: Directory to save/load vector store
        """
        self.processed_dir = Path(processed_dir)
        self.vector_store_dir = Path(vector_store_dir) if vector_store_dir else self.processed_dir.parent / "vector_store"
        self.vector_store_dir.mkdir(parents=True, exist_ok=True)
        
        self.vector_store = None
        self.embeddings = None
        self.documents = []
        
        # Setup OpenAI
        openai_key = os.environ.get("OPENAI_KEY", "").strip()
        if not openai_key:
            logger.warning("OPENAI_KEY not found. Q&A system will not work.")
        else:
            try:
                self.embeddings = OpenAIEmbeddings(openai_api_key=openai_key)
                self.llm_client = OpenAI(api_key=openai_key)
                logger.info("OpenAI initialized for Q&A system")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI: {e}")
    
    def load_documents(self):
        """Load all processed documents and convert to LangChain Document format."""
        documents = []
        
        for json_file in self.processed_dir.rglob("*_enriched.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    doc_data = json.load(f)
                
                # Extract text content
                text = doc_data.get("content", {}).get("raw_text", "")
                if not text:
                    continue
                
                # Create metadata
                metadata = {
                    "document_id": doc_data.get("document_id", "unknown"),
                    "document_type": doc_data.get("document_type", "other"),
                    "source_url": doc_data.get("source_url", ""),
                    "filename": doc_data.get("metadata", {}).get("filename", ""),
                    "title": doc_data.get("metadata", {}).get("title", ""),
                    "pages": doc_data.get("metadata", {}).get("pages", 0)
                }
                
                # Add extracted entities to metadata for better retrieval
                entities = doc_data.get("entities", {})
                if entities:
                    metadata["entities"] = json.dumps(entities)
                
                # Create LangChain Document
                doc = Document(page_content=text, metadata=metadata)
                documents.append(doc)
                
            except Exception as e:
                logger.error(f"Error loading {json_file}: {e}")
        
        self.documents = documents
        logger.info(f"Loaded {len(documents)} documents")
        return documents
    
    def create_vector_store(self, force_recreate=False):
        """Create or load the vector store."""
        vector_store_path = self.vector_store_dir / "faiss_index"
        
        # Try to load existing vector store
        if not force_recreate and vector_store_path.exists():
            try:
                logger.info("Loading existing vector store...")
                self.vector_store = FAISS.load_local(
                    str(vector_store_path),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                logger.info("✓ Loaded existing vector store")
                return self.vector_store
            except Exception as e:
                logger.warning(f"Failed to load existing vector store: {e}. Creating new one...")
        
        # Create new vector store
        if not self.documents:
            self.load_documents()
        
        if not self.documents:
            logger.error("No documents to index")
            return None
        
        logger.info("Creating vector store...")
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
        chunks = text_splitter.split_documents(self.documents)
        logger.info(f"Split into {len(chunks)} chunks")
        
        # Create vector store
        self.vector_store = FAISS.from_documents(chunks, self.embeddings)
        
        # Save vector store
        self.vector_store.save_local(str(vector_store_path))
        logger.info(f"✓ Saved vector store to {vector_store_path}")
        
        return self.vector_store
    
    def query(self, question: str, k: int = 5, vertical: Optional[str] = None) -> Dict[str, Any]:
        """
        Query the vector store and generate an answer.
        
        Args:
            question: The question to answer
            k: Number of document chunks to retrieve
            vertical: Optional filter by document type/vertical
        
        Returns:
            Dictionary with answer, sources, and metadata
        """
        if self.vector_store is None:
            logger.error("Vector store not initialized. Call create_vector_store() first.")
            return {"error": "Vector store not initialized"}
        
        logger.info(f"Querying: {question}")
        
        # Build search filter if vertical specified
        search_kwargs = {"k": k}
        if vertical:
            search_kwargs["filter"] = {"document_type": vertical}
        
        # Retrieve relevant documents
        try:
            docs = self.vector_store.similarity_search(question, **search_kwargs)
        except Exception as e:
            logger.error(f"Error during similarity search: {e}")
            return {"error": str(e)}
        
        if not docs:
            return {
                "answer": "No relevant documents found.",
                "sources": [],
                "confidence": 0.0
            }
        
        # Prepare context from retrieved documents
        context_parts = []
        sources = []
        
        for i, doc in enumerate(docs):
            context_parts.append(f"[Document {i+1}]\n{doc.page_content[:500]}...")
            sources.append({
                "document_id": doc.metadata.get("document_id", "unknown"),
                "title": doc.metadata.get("title", ""),
                "document_type": doc.metadata.get("document_type", "other"),
                "source_url": doc.metadata.get("source_url", ""),
                "filename": doc.metadata.get("filename", "")
            })
        
        context = "\n\n".join(context_parts)
        
        # Generate answer using LLM
        prompt = f"""You are an expert assistant helping answer questions about GRDA (Grand River Dam Authority) based on their official documents.

Context from GRDA documents:
{context}

Question: {question}

Provide a clear, accurate answer based on the context above. If the context doesn't contain enough information to answer the question, say so. Include specific details like dates, numbers, and document references when available.

Answer:"""

        try:
            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that answers questions about GRDA based on official documents. Always cite your sources."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            answer = response.choices[0].message.content
            
            return {
                "answer": answer,
                "sources": sources,
                "num_sources": len(sources),
                "question": question
            }
        
        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            return {
                "answer": f"Error generating answer: {e}",
                "sources": sources,
                "error": str(e)
            }
    
    def interactive_query(self):
        """Run an interactive query session."""
        if not self.vector_store:
            logger.info("Creating vector store...")
            self.create_vector_store()
        
        print("\n" + "="*60)
        print("GRDA Q&A System")
        print("="*60)
        print("Type 'quit' or 'exit' to end the session\n")
        
        while True:
            try:
                question = input("Question: ").strip()
                
                if question.lower() in ['quit', 'exit', 'q']:
                    print("Goodbye!")
                    break
                
                if not question:
                    continue
                
                result = self.query(question)
                
                print("\n" + "-"*60)
                print("Answer:")
                print(result.get("answer", "No answer generated"))
                print("\nSources:")
                for i, source in enumerate(result.get("sources", []), 1):
                    print(f"  {i}. {source.get('title', 'Unknown')} ({source.get('document_type', 'unknown')})")
                print("-"*60 + "\n")
            
            except KeyboardInterrupt:
                print("\nGoodbye!")
                break
            except Exception as e:
                print(f"Error: {e}\n")


def main():
    """Main execution function."""
    if not HAVE_QA:
        logger.error("Required libraries not available. Install langchain, langchain-openai, langchain-community, faiss-cpu")
        return
    
    import argparse
    parser = argparse.ArgumentParser(description="GRDA Q&A System")
    parser.add_argument("--processed-dir", default="data/grda/processed",
                       help="Directory containing processed JSON files")
    parser.add_argument("--vector-store-dir", default=None,
                       help="Directory for vector store (default: data/grda/vector_store)")
    parser.add_argument("--recreate", action="store_true",
                       help="Force recreation of vector store")
    parser.add_argument("--query", type=str, default=None,
                       help="Single query to execute (non-interactive)")
    parser.add_argument("--vertical", type=str, default=None,
                       help="Filter by document vertical/type")
    parser.add_argument("--k", type=int, default=5,
                       help="Number of documents to retrieve")
    parser.add_argument("--json", action="store_true",
                       help="Output results as JSON only (for API use)")
    
    args = parser.parse_args()
    
    if not Path(args.processed_dir).exists():
        logger.error(f"Processed directory not found: {args.processed_dir}")
        logger.error("Run grda_pdf_processor.py and grda_llm_extraction.py first.")
        return
    
    qa_system = GRDAQASystem(args.processed_dir, args.vector_store_dir)
    
    # Create/load vector store
    qa_system.create_vector_store(force_recreate=args.recreate)
    
    # Execute query
    if args.query:
        result = qa_system.query(args.query, k=args.k, vertical=args.vertical)
        
        # If --json flag, output JSON only (for API use)
        if args.json:
            import json
            print(json.dumps(result, indent=2))
        else:
            print("\n" + "="*60)
            print("Question:", result.get("question", args.query))
            print("="*60)
            print("\nAnswer:")
            print(result.get("answer", "No answer"))
            print("\nSources:")
            for i, source in enumerate(result.get("sources", []), 1):
                print(f"  {i}. {source.get('title', 'Unknown')} ({source.get('document_type', 'unknown')})")
            print("="*60)
    else:
        # Interactive mode
        qa_system.interactive_query()


if __name__ == "__main__":
    main()

