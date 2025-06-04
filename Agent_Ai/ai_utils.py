"""
Shared AI utilities for embedding, LLM responses, and vector search
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional

from config import AI_CONFIG, EMBED_MODEL_NAME

# Initialize AI components
model_st = SentenceTransformer(EMBED_MODEL_NAME)
pinecone = Pinecone(api_key=AI_CONFIG["PINECONE"]["API_KEY"])
index = pinecone.Index(AI_CONFIG["PINECONE"]["INDEX_NAME"])

# Initialize LLM
llm = ChatGoogleGenerativeAI(
    model=AI_CONFIG["GOOGLE"]["MODEL"],
    temperature=AI_CONFIG["GOOGLE"]["TEMPERATURE"],
    convert_system_message_to_human=True,
    google_api_key=AI_CONFIG["GOOGLE"]["API_KEY"]
)

def get_query_embedding(query_text: str) -> List[float]:
    """Get embedding for a query text"""
    return model_st.encode(query_text).tolist()

def search_pinecone(query_embedding: List[float], query: str, top_k: int = 10, company_id: Optional[str] = None) -> List[Dict]:
    """Search Pinecone for similar documents"""
    namespace = AI_CONFIG["PINECONE"]["NAMESPACE"]
    filter_dict = {"company_id": {"$eq": company_id}} if company_id else None
    
    results = index.query(
        namespace=namespace,
        vector=query_embedding,
        filter=filter_dict,
        top_k=top_k,
        include_metadata=True
    )
    
    return results.matches if results else []

def get_context_from_kb(query: str, company_id: Optional[str] = None) -> List[str]:
    """Get relevant context from knowledge base"""
    embedding = get_query_embedding(query)
    results = search_pinecone(embedding, query, top_k=AI_CONFIG["CHAT"]["TOP_K_RESULTS"], company_id=company_id)
    if not results:
        return []
    return [item.metadata.get("text", "") for item in results]

def generate_llm_response(prompt: str, system_prompt: Optional[str] = None) -> str:
    """Generate response from LLM"""
    messages = []
    if system_prompt:
        messages.append(HumanMessage(content=f"You are acting as an AI assistant. {system_prompt}"))
    messages.append(HumanMessage(content=prompt))
    
    try:
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        print(f"Error generating LLM response: {e}")
        return "I apologize, but I'm having trouble processing your request at the moment."
