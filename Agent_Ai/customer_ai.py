

import os
from typing import List, Dict, Optional
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pinecone import Pinecone as Pinecone
from sentence_transformers import SentenceTransformer
import uuid
import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("CustomerAI")

# -------------------------------
# Configuration
# -------------------------------
AI_CONFIG = {
    "PINECONE": {
        "API_KEY": os.environ.get("PINECONE_API_KEY", "pcsk_6huYPr_DJ1sQeb1hTAHfJ7B2gkSpksssvi76qJDJEGUfpVfUMB41kictgkvQqLUw62Jmsi"),
        "INDEX_NAME": os.environ.get("PINECONE_INDEX_NAME", "llama-text-embed-v2-index"),
        "NAMESPACE": os.environ.get("PINECONE_NAMESPACE", "ns3"),
    },
    "GOOGLE": {
        "API_KEY": os.environ.get("GOOGLE_GEMINI_API_KEY", "AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw"),
        "MODEL": "gemini-2.0-flash",
        "TEMPERATURE": 0.3,
    },
    "CHAT": {
        "MAX_HISTORY": 10,
        "RECENT_HISTORY": 5,
        "TOP_K_RESULTS": 10,
        "MAX_CONTEXT_CHUNKS": 5,
    },
    "TICKET": {
        "HELP_INDICATORS": [
            'create ticket', 'need help', 'contact support', 'speak to agent',
            'human agent', 'talk to someone', 'escalate', 'complaint',
            'refund', 'billing issue', 'account problem', 'urgent', 'emergency'
        ],
    },
}

EMBED_MODEL_NAME_ST = "intfloat/e5-large-v2"

# -------------------------------
# Pinecone & Reranker Setup
# -------------------------------
pinecone = Pinecone(api_key=AI_CONFIG["PINECONE"]["API_KEY"])
model_st = SentenceTransformer(EMBED_MODEL_NAME_ST)
index = pinecone.Index(AI_CONFIG["PINECONE"]["INDEX_NAME"])

# -------------------------------
# Gemini LLM Setup
# -------------------------------
llm = ChatGoogleGenerativeAI(
    model=AI_CONFIG["GOOGLE"]["MODEL"],
    temperature=AI_CONFIG["GOOGLE"]["TEMPERATURE"],
    convert_system_message_to_human=True,
    google_api_key=AI_CONFIG["GOOGLE"]["API_KEY"]
)

# -------------------------------
# In-Memory Conversation Storage
# -------------------------------
conversation_memory: Dict[str, List[Dict]] = {}
support_tickets: Dict[str, Dict] = {}

# -------------------------------
# Embedding & KB Search Functions
# -------------------------------
def get_query_embedding(query_text, model):
    if not query_text:
        logger.warning("Empty query text provided")
        return None
    logger.info(f"Generating embedding for query: {query_text[:50]}...")
    return model.encode(f"query: {query_text}").tolist()

def search_pinecone(index, query_embedding, query, top_k=10, company_id=None):
    if query_embedding is None:
        logger.warning("Query embedding is None.")
        return []
    try:
        logger.info(f"Searching Pinecone with query: {query[:50]}...")
        
        # Define filter if company_id is provided
        filter_dict = {}
        if company_id:
            filter_dict = {
                "company_id": {"$eq": company_id}
            }
            logger.info(f"Applied company filter: {company_id}")
        
        to_results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            include_values=False,
            namespace=AI_CONFIG["PINECONE"]["NAMESPACE"],
            filter=filter_dict if filter_dict else None
        )
        
        logger.info(f"Found {len(to_results.get('matches', []))} initial matches")
        
        fin_results = [
            {
                'id': hit['id'],
                'category': hit['metadata'].get('category'),
                'company_id': hit['metadata'].get('company_id'),
                'source_document': hit['metadata'].get('source_document'),
                'text': hit['metadata'].get('text'),
                'title': hit['metadata'].get('title')
            } for hit in to_results.get('matches', [])
        ]
        
        # Skip reranking if no results
        if not fin_results:
            logger.warning("No results to rerank")
            return []
        
        logger.info("Reranking results...")
        results = pinecone.inference.rerank(
            model="bge-reranker-v2-m3",
            query=query,
            documents=fin_results,
            rank_fields=["text"],
            top_n=AI_CONFIG["CHAT"]["MAX_CONTEXT_CHUNKS"],
            return_documents=True,
            parameters={"truncate": "END"}
        )
        logger.info(f"Reranking complete. Top score: {results.rerank_result.data[0].score if results.rerank_result.data else 'N/A'}")
        return results.rerank_result.data
    except Exception as e:
        logger.error(f"Error querying Pinecone: {e}")
        return []

def get_context_from_kb(query: str, company_id: Optional[str] = None) -> List[str]:
    embedding = get_query_embedding(query, model_st)
    results = search_pinecone(index, embedding, query, top_k=AI_CONFIG["CHAT"]["TOP_K_RESULTS"], company_id=company_id)
    if not results:
        return []
    return [item.document["text"] for item in results]

# -------------------------------
# Conversation Memory Handling
# -------------------------------
def get_conversation_context(session_id: str) -> str:
    if session_id not in conversation_memory:
        return ""
    history = conversation_memory[session_id]
    recent_history = history[-AI_CONFIG["CHAT"]["RECENT_HISTORY"]:]
    context_parts = []
    for exchange in recent_history:
        context_parts.append(f"User: {exchange['query']}")
        context_parts.append(f"Chatbot: {exchange['response']}")
    return "\n".join(context_parts)

def store_conversation(session_id: str, query: str, response: str):
    if session_id not in conversation_memory:
        conversation_memory[session_id] = []
    conversation_memory[session_id].append({
        'query': query,
        'response': response,
        'timestamp': datetime.datetime.utcnow().isoformat()
    })
    if len(conversation_memory[session_id]) > AI_CONFIG["CHAT"]["MAX_HISTORY"]:
        conversation_memory[session_id] = conversation_memory[session_id][-AI_CONFIG["CHAT"]["MAX_HISTORY"]:]

# -------------------------------
# Chatbot Response Generation
# -------------------------------
def generate_customer_response(context_chunks: List[str], question: str, conversation_context: str = "", company_name: str = None) -> str:
    context = "\n".join(context_chunks)
    conv_context_section = f"\nPrevious Conversation:\n{conversation_context}\n" if conversation_context else ""
    
    company_context = f"You are helping customers of {company_name}." if company_name else "You are helping customers of a business."
    
    prompt = f"""You are a friendly and helpful AI chatbot assisting customers.
{company_context}
{conv_context_section}
Knowledge Base:
{context}

Customer's Question: {question}

Instructions:
- Respond in a polite, clear, and helpful tone
- Use plain language and be conversational
- If you can answer based on the knowledge base, provide a comprehensive response
- If you cannot find relevant information, politely say you need to connect them with a human agent
- Do not mention internal tools or technical details
- Keep responses focused and not too lengthy

Response:"""

    logger.info(f"Generating response for question: {question[:50]}...")
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content.strip()

def generate_general_response(question: str, conversation_context: str = "", company_name: str = None) -> str:
    conv_context_section = f"\nPrevious Conversation:\n{conversation_context}\n" if conversation_context else ""
    company_context = f"You are helping customers of {company_name}." if company_name else "You are helping customers of a business."
    
    prompt = f"""You are a friendly and helpful AI customer service assistant.
{company_context}
{conv_context_section}

Customer's Question: {question}

Instructions:
- Respond in a polite, helpful, and conversational tone
- Try to provide general guidance or suggestions based on the question
- If you cannot provide specific information, offer to help in other ways
- Be empathetic and understanding
- Keep responses concise but helpful
- Do not mention that you lack specific information about the company
- If the question seems like it needs human assistance, suggest they can contact support

Response:"""

    logger.info(f"Generating general response for question: {question[:50]}...")
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content.strip()

# -------------------------------
# Support Ticket Creation
# -------------------------------
def create_support_ticket(session_id: str, issue: str) -> str:
    ticket_id = f"TCKT-{uuid.uuid4().hex[:8].upper()}"
    support_tickets[ticket_id] = {
        "session_id": session_id,
        "issue": issue,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "ticket_id": ticket_id
    }
    logger.info(f"Created support ticket: {ticket_id}")
    return ticket_id

def get_support_ticket(ticket_id: str) -> Dict:
    return support_tickets.get(ticket_id)

# -------------------------------
# Ticket Creation Logic
# -------------------------------
def should_create_ticket(query: str, context_chunks: List[str]) -> bool:
    lowercase_query = query.lower()
    
    # Explicit help request check
    explicitHelpRequest = any(phrase in lowercase_query for phrase in AI_CONFIG["TICKET"]["HELP_INDICATORS"])
    
    # Complex issue without context check
    no_relevant_context = len(context_chunks) == 0
    is_complex_issue = len(query) > 150 and "problem" in lowercase_query
    
    logger.info(f"Ticket creation check: explicit={explicitHelpRequest}, no_context={no_relevant_context}, complex={is_complex_issue}")
    
    return explicitHelpRequest or (no_relevant_context and is_complex_issue)

# -------------------------------
# Main Chatbot Logic
# -------------------------------
def chatbot_respond_to_user(
    query: str, 
    session_id: str = "default",
    company_id: Optional[str] = None,
    company_name: Optional[str] = None
) -> dict:
    logger.info(f"Processing query from session {session_id}: {query[:50]}...")
    
    # Store customer message
    store_conversation(session_id, query, "")  # Empty response initially, will be updated later
    
    # Get conversation context
    conversation_context = get_conversation_context(session_id)
    
    # Search knowledge base
    context_chunks = get_context_from_kb(query, company_id)
    logger.info(f"Found {len(context_chunks)} relevant context chunks")
    
    # Determine if we need to create a ticket
    should_create_ticket_result = should_create_ticket(query, context_chunks)
    
    response = ""
    ticket_id = None
    
    if should_create_ticket_result:
        # Create support ticket
        ticket_id = create_support_ticket(session_id, query)
        response = f"I understand you need assistance with this matter. I've created a support ticket ({ticket_id}) and our team will follow up with you shortly. Is there anything else I can help you with in the meantime?"
    else:
        # Generate AI response based on available context
        if context_chunks:
            response = generate_customer_response(
                context_chunks,
                query,
                conversation_context,
                company_name
            )
        else:
            # Generate a general response when no context is available
            response = generate_general_response(
                query,
                conversation_context,
                company_name
            )
    
    # Update conversation with bot response
    conversation_memory[session_id][-1]["response"] = response
    
    result = {
        "answer": response,
        "sources": context_chunks,
        "session_id": session_id,
    }
    
    if ticket_id:
        result["ticket_id"] = ticket_id
        result["should_create_ticket"] = True
    
    return result

# -------------------------------
# Utilities
# -------------------------------
def clear_conversation_memory(session_id: str) -> bool:
    if session_id in conversation_memory:
        del conversation_memory[session_id]
        logger.info(f"Cleared conversation memory for session {session_id}")
        return True
    return False

def get_conversation_summary(session_id: str) -> dict:
    if session_id not in conversation_memory:
        return {"message": "No conversation found for this session"}
    history = conversation_memory[session_id]
    return {
        "session_id": session_id,
        "total_exchanges": len(history),
        "conversation": history
    }

# Remove test code that would run on import
# This now allows this module to be imported without running the test code