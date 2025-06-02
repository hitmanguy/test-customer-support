

from typing import List, Dict, Optional
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
import uuid
import datetime

# -------------------------------
# Pinecone & Reranker Setup
# -------------------------------
PINECONE_API_KEY = "pcsk_6huYPr_DJ1sQeb1hTAHfJ7B2gkSpksssvi76qJDJEGUfpVfUMB41kictgkvQqLUw62Jmsi"
INDEX_NAME = "llama-text-embed-v2-index"
NAMESPACE = "ns3"
EMBED_MODEL_NAME_ST = "intfloat/e5-large-v2"

pinecone = Pinecone(api_key=PINECONE_API_KEY)
model_st = SentenceTransformer(EMBED_MODEL_NAME_ST)
index = pinecone.Index(INDEX_NAME)

# -------------------------------
# Gemini LLM Setup
# -------------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.3,
    convert_system_message_to_human=True,
    google_api_key="AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw"  # Replace with your actual API key
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
        return None
    return model.encode(f"query: {query_text}").tolist()

def search_pinecone(index, query_embedding, query, top_k=10):
    if query_embedding is None:
        print("Query embedding is None.")
        return []
    try:
        to_results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True,
            include_values=False,
            namespace=NAMESPACE
        )
        fin_results = [
            {
                'id': hit['id'],
                'category': hit['metadata'].get('category'),
                'company_id': hit['metadata'].get('company_id'),
                'source_document': hit['metadata'].get('source_document'),
                'text': hit['metadata'].get('text'),
                'title': hit['metadata'].get('title')
            } for hit in to_results['matches']
        ]
        results = pinecone.inference.rerank(
            model="bge-reranker-v2-m3",
            query=query,
            documents=fin_results,
            rank_fields=["text"],
            top_n=5,
            return_documents=True,
            parameters={"truncate": "END"}
        )
        return results.rerank_result.data
    except Exception as e:
        print(f"Error querying Pinecone: {e}")
        return []

def get_context_from_kb(query: str) -> List[str]:
    embedding = get_query_embedding(query, model_st)
    results = search_pinecone(index, embedding, query)
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
    recent_history = history[-5:]
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
        'response': response
    })
    if len(conversation_memory[session_id]) > 10:
        conversation_memory[session_id] = conversation_memory[session_id][-10:]

# -------------------------------
# Chatbot Response Generation
# -------------------------------
def generate_customer_response(context_chunks: List[str], question: str, conversation_context: str = "") -> str:
    context = "\n".join(context_chunks)
    conv_context_section = f"\nPrevious Conversation:\n{conversation_context}\n" if conversation_context else ""
    prompt = f"""You are a friendly and helpful chatbot assisting customers of a burger chain.
{conv_context_section}
Knowledge Base:
{context}

Customer's Question: {question}

Respond in a polite, clear, and helpful tone. Use plain language. Do not mention internal tools or agents. If follow-up is needed, offer a warm closing and next step.

Chatbot Response:"""
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content.strip()

# -------------------------------
# Support Ticket Creation
# -------------------------------
def create_support_ticket(session_id: str, issue: str) -> str:
    ticket_id = f"TCKT-{uuid.uuid4().hex[:8]}"
    support_tickets[ticket_id] = {
        "session_id": session_id,
        "issue": issue,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    return ticket_id

# -------------------------------
# Main Chatbot Logic
# -------------------------------
def chatbot_respond_to_user(query: str, session_id: Optional[str] = "default") -> dict:
    conversation_context = get_conversation_context(session_id)
    context_chunks = get_context_from_kb(query)
    if not context_chunks:
        ticket_id = create_support_ticket(session_id, query)
        response = (
            "I'm sorry, I couldn't find an answer to your question right now. "
            "I've created a support ticket and our team will follow up shortly. "
            f"Your ticket ID is: {ticket_id}"
        )
    else:
        response = generate_customer_response(context_chunks, query, conversation_context)
    store_conversation(session_id, query, response)
    return {
        "answer": response,
        "sources": context_chunks,
        "session_id": session_id
    }

# -------------------------------
# Utilities
# -------------------------------
def clear_conversation_memory(session_id: str) -> bool:
    if session_id in conversation_memory:
        del conversation_memory[session_id]
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

response = chatbot_respond_to_user("What are your business hours?", session_id="test-user-1")
print("Chatbot Answer:", response["answer"])
print("Sources used:", response["sources"])

fallback_response = chatbot_respond_to_user("Can I pay with space credits?", session_id="test-user-2")
print("Chatbot Fallback Answer:", fallback_response["answer"])
print("Support Tickets:", support_tickets)

response = chatbot_respond_to_user("How do I time travel to 2050?", session_id="test-user-2")
print("Bot Response:", response["answer"])
import re

match = re.search(r"TCKT-\w+", response["answer"])
if match:
    ticket_id = match.group(0)
    print("Created Ticket ID:", ticket_id)
    print("Ticket Details:", get_support_ticket(ticket_id))
else:
    print("No ticket created")