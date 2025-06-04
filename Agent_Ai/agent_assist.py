from typing import List, Dict, Optional
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pinecone import Pinecone as Pinecone
from sentence_transformers import SentenceTransformer
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os

# -------------------------------
# MongoDB Configuration
# -------------------------------
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://hitmansur:D5ZcRgN9zXa7qeNo@discord-bot.bv4504k.mongodb.net/flipr?retryWrites=true&w=majority&appName=discord-bot")
DATABASE_NAME = os.getenv("DATABASE_NAME", "flipr")

# Global MongoDB variables
mongodb_client = None
database = None

def initialize_mongodb(client, db):
    """Initialize MongoDB connection from main app"""
    global mongodb_client, database
    mongodb_client = client
    database = db

# -------------------------------
# Pinecone & Reranker Setup
# -------------------------------
PINECONE_API_KEY = "pcsk_6huYPr_DJ1sQeb1hTAHfJ7B2gkSpksssvi76qJDJEGUfpVfUMB41kictgkvQqLUw62Jmsi"
INDEX_NAME = "llama-text-embed-v2-index"
NAMESPACE = "ns3"
EMBED_MODEL_NAME_ST = "intfloat/e5-large-v2"


pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
model_st = SentenceTransformer(EMBED_MODEL_NAME_ST)
index = pinecone_client.Index(INDEX_NAME)

# -------------------------------
# Gemini LLM Setup
# -------------------------------
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.3,
    convert_system_message_to_human=True,
    google_api_key='AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw'
)

# -------------------------------
# MongoDB Chat Functions
# -------------------------------
async def get_or_create_agent_chat(agent_id: str) -> str:
    """Get existing A_Chat or create new one for agent"""
    try:
        # Try to find existing chat for this agent
        existing_chat = await database.a_chats.find_one({"agentId": ObjectId(agent_id)})
        
        if existing_chat:
            return str(existing_chat["_id"])
        
        # Create new chat session
        new_chat = {
            "agentId": ObjectId(agent_id),
            "contents": [],
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        result = await database.a_chats.insert_one(new_chat)
        return str(result.inserted_id)
        
    except Exception as e:
        print(f"Error getting/creating agent chat: {e}")
        return None

async def get_agent_chat_history(agent_id: str, limit: int = 10) -> List[Dict]:
    """Get recent chat history for an agent"""
    try:
        chat = await database.a_chats.find_one({"agentId": ObjectId(agent_id)})
        
        if not chat or not chat.get("contents"):
            return []
        
        # Get recent messages (last 'limit' exchanges)
        recent_contents = chat["contents"][-limit:]
        return recent_contents
        
    except Exception as e:
        print(f"Error fetching agent chat history: {e}")
        return []

async def store_agent_conversation(agent_id: str, query: str, response: str):
    """Store conversation exchange in MongoDB"""
    try:
        # Add agent query
        agent_message = {
            "role": "agent",
            "content": query,
            "attachment": None,
            "createdAt": datetime.utcnow()
        }
        
        # Add bot response
        bot_message = {
            "role": "bot", 
            "content": response,
            "attachment": None,
            "createdAt": datetime.utcnow()
        }
          # Update the chat with new messages
        await database.a_chats.update_one(
            {"agentId": ObjectId(agent_id)},
            {
                "$push": {
                    "contents": {
                        "$each": [agent_message, bot_message]
                    }
                },
                "$set": {"updatedAt": datetime.utcnow()}
            },
            upsert=True
        )
        
        # Keep only last 20 messages to prevent bloat
        await database.a_chats.update_one(
            {"agentId": ObjectId(agent_id)},
            {
                "$push": {
                    "contents": {
                        "$each": [],
                        "$slice": -20  # Keep only last 20 messages
                    }
                }
            }
        )
        
        return True
        
    except Exception as e:
        print(f"Error storing agent conversation: {e}")
        return False

async def clear_agent_conversation_memory(agent_id: str) -> bool:
    """Clear conversation memory for an agent"""
    try:
        result = await database.a_chats.update_one(
            {"agentId": ObjectId(agent_id)},
            {
                "$set": {
                    "contents": [],
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0
        
    except Exception as e:
        print(f"Error clearing agent conversation: {e}")
        return False

async def get_agent_conversation_summary(agent_id: str) -> dict:
    """Get summary of conversation for an agent"""
    try:
        chat = await database.a_chats.find_one({"agentId": ObjectId(agent_id)})
        
        if not chat:
            return {"message": "No conversation found for this agent", "agent_id": agent_id}
        
        contents = chat.get("contents", [])
        
        # Separate agent queries and bot responses for better summary
        agent_queries = [msg for msg in contents if msg["role"] == "agent"]
        bot_responses = [msg for msg in contents if msg["role"] == "bot"]
        
        return {
            "agent_id": agent_id,
            "chat_id": str(chat["_id"]),
            "total_messages": len(contents),
            "agent_queries": len(agent_queries),
            "bot_responses": len(bot_responses),
            "last_activity": chat.get("updatedAt"),
            "conversation": contents[-10:] if contents else []  # Last 10 messages
        }
        
    except Exception as e:
        print(f"Error getting agent conversation summary: {e}")
        return {"error": str(e), "agent_id": agent_id}

# -------------------------------
# Pinecone & Knowledge Base Functions
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
        results = pinecone_client.inference.rerank(
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
    """Get context from knowledge base using Pinecone"""
    embedding = get_query_embedding(query, model_st)
    results = search_pinecone(index, embedding, query)
    if not results:
        return []
    return [item.document["text"] for item in results]

async def get_conversation_context(agent_id: str) -> str:
    """Get conversation history for context from MongoDB"""
    history = await get_agent_chat_history(agent_id, limit=5)
    
    if not history:
        return ""
    
    # Format recent conversation for context (last 5 exchanges)
    context_parts = []
    
    for message in history:
        if message["role"] == "agent":
            context_parts.append(f"Agent Question: {message['content']}")
        else:  # bot
            context_parts.append(f"AI Response: {message['content']}")
    
    return "\n".join(context_parts)

def generate_agent_assistance(context_chunks: List[str], question: str, conversation_context: str = "") -> str:
    """Generate response specifically for assisting human agents"""
    context = "\n".join(context_chunks)
    
    # Build conversation context section
    conv_context_section = ""
    if conversation_context:
        conv_context_section = f"""
Previous Conversation in This Session:
{conversation_context}

"""
    
    prompt = f"""You are an AI assistant specifically designed to help HUMAN SUPPORT AGENTS for the given company.

IMPORTANT: You are assisting the human agent who is handling customer support tickets.

Your role is to:
- Provide quick answers to help the agent resolve customer issues
- Suggest solutions the agent can offer to customers based on agents question 
- Help draft responses the agent can send to customers
- Provide relevant policy information and procedures
- Assist with troubleshooting steps the agent can follow

{conv_context_section}Knowledge Base Information:
{context}

Agent's Question: {question}

Provide a helpful response to assist the human agent. Be concise and actionable. If suggesting customer responses, clearly indicate "You can tell the customer:" or "Suggested response to customer:"

Assistant Response:"""

    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content.strip()

# -------------------------------
# Main Functions (Updated for MongoDB)
# -------------------------------
async def answer_agent_query(query: str, agent_id: str) -> dict:
    """Main function to answer agent queries with MongoDB conversation memory"""
    
    # Ensure agent chat exists
    chat_id = await get_or_create_agent_chat(agent_id)
    if not chat_id:
        return {
            "error": "Failed to create/access agent chat session",
            "agent_id": agent_id
        }
    
    # Get conversation context from MongoDB
    conversation_context = await get_conversation_context(agent_id)
    
    # Get relevant knowledge base context
    context_chunks = get_context_from_kb(query)
    
    if not context_chunks:
        response = "I couldn't find specific information in the knowledge base for this query. However, I can help you with general guidance. What specific aspect of this issue would you like assistance with?"
    else:
        response = generate_agent_assistance(context_chunks, query, conversation_context)
    
    # Store this exchange in MongoDB
    stored = await store_agent_conversation(agent_id, query, response)
    
    return {
        "answer": response,
        "sources": context_chunks,
        "agent_id": agent_id,
        "chat_id": chat_id,
        "stored": stored
    }

async def clear_conversation_memory(agent_id: str) -> bool:
    """Clear conversation memory for an agent"""
    return await clear_agent_conversation_memory(agent_id)

async def get_conversation_summary(agent_id: str) -> dict:
    """Get summary of conversation for an agent"""
    return await get_agent_conversation_summary(agent_id)

# -------------------------------
# Additional Utility Functions
# -------------------------------
async def get_agent_chat_analytics(agent_id: str) -> dict:
    """Get analytics for an agent's chat usage"""
    try:
        chat = await database.a_chats.find_one({"agentId": ObjectId(agent_id)})
        
        if not chat:
            return {"message": "No chat data found for this agent", "agent_id": agent_id}
        
        contents = chat.get("contents", [])
        
        # Analyze message patterns
        agent_messages = [msg for msg in contents if msg["role"] == "agent"]
        bot_messages = [msg for msg in contents if msg["role"] == "bot"]
        
        # Get date range
        if contents:
            first_message = min(contents, key=lambda x: x["createdAt"])
            last_message = max(contents, key=lambda x: x["createdAt"])
            date_range = {
                "first_message": first_message["createdAt"],
                "last_message": last_message["createdAt"]
            }
        else:
            date_range = None
        
        return {
            "agent_id": agent_id,
            "chat_id": str(chat["_id"]),
            "total_messages": len(contents),
            "agent_queries": len(agent_messages),
            "bot_responses": len(bot_messages),
            "date_range": date_range,
            "average_query_length": sum(len(msg["content"]) for msg in agent_messages) / len(agent_messages) if agent_messages else 0,
            "average_response_length": sum(len(msg["content"]) for msg in bot_messages) / len(bot_messages) if bot_messages else 0
        }
        
    except Exception as e:
        print(f"Error getting agent chat analytics: {e}")
        return {"error": str(e), "agent_id": agent_id}

async def search_agent_conversations(agent_id: str, search_query: str, limit: int = 10) -> dict:
    """Search through agent's conversation history"""
    try:
        # Use MongoDB text search or regex search
        pipeline = [
            {"$match": {"agentId": ObjectId(agent_id)}},
            {"$unwind": "$contents"},
            {
                "$match": {
                    "contents.content": {
                        "$regex": search_query,
                        "$options": "i"  # case insensitive
                    }
                }
            },
            {"$limit": limit},
            {"$sort": {"contents.createdAt": -1}}
        ]
        results = await database.a_chats.aggregate(pipeline).to_list(length=limit)
        
        matched_messages = []
        for result in results:
            matched_messages.append({
                "content": result["contents"]["content"],
                "role": result["contents"]["role"],
                "created_at": result["contents"]["createdAt"],
                "chat_id": str(result["_id"])
            })
        
        return {
            "agent_id": agent_id,
            "search_query": search_query,
            "matches_found": len(matched_messages),
            "results": matched_messages
        }
        
    except Exception as e:
        print(f"Error searching agent conversations: {e}")
        return {"error": str(e), "agent_id": agent_id}

async def export_agent_conversation(agent_id: str) -> dict:
    """Export complete conversation history for an agent"""
    try:
        chat = await database.a_chats.find_one({"agentId": ObjectId(agent_id)})
        
        if not chat:
            return {"message": "No conversation found for this agent", "agent_id": agent_id}
        
        # Format for export
        export_data = {
            "agent_id": agent_id,
            "chat_id": str(chat["_id"]),
            "export_date": datetime.utcnow(),
            "total_messages": len(chat.get("contents", [])),
            "conversation_history": chat.get("contents", [])
        }
        
        return export_data
        
    except Exception as e:
        print(f"Error exporting agent conversation: {e}")
        return {"error": str(e), "agent_id": agent_id}

# -------------------------------
# Ticket-Specific AI Functions
# -------------------------------
async def get_ticket_ai_response(query: str, ticket_id: str, agent_id: str, ticket_data: dict, ai_ticket_data: dict = None) -> dict:
    """Generate AI responses for ticket-specific queries"""
    try:
        # Get ticket information
        ticket_content = ticket_data.get('content', '')
        ticket_title = ticket_data.get('title', '')
        
        # Get AI analysis data if available
        summary = ai_ticket_data.get('summarized_content', '') if ai_ticket_data else ''
        predicted_solution = ai_ticket_data.get('predicted_solution', '') if ai_ticket_data else ''
        priority_rate = ai_ticket_data.get('priority_rate', 0) if ai_ticket_data else 0
        
        # Create context from ticket data
        ticket_context = f"""
        Ticket ID: {ticket_id}
        Title: {ticket_title}
        Content: {ticket_content}
        AI Summary: {summary}
        Predicted Solution: {predicted_solution}
        Priority Rate: {priority_rate}
        """
        
        # Relevant knowledge base context
        kb_context = get_context_from_kb(f"{ticket_title} {ticket_content} {query}")
        
        # Generate response with combined context
        prompt = f"""
        You are a helpful AI assistant for customer support agents. 
        You have access to the following ticket information:
        
        {ticket_context}
        
        Additional knowledge base information:
        {kb_context}
        
        The agent's question about this ticket is: {query}
        
        Provide a helpful, concise response that addresses the agent's question specifically about this ticket.
        Base your answer on the ticket information and knowledge base context provided.
        """
        
        # Get response from LLM
        response = llm.invoke([HumanMessage(content=prompt)]).content
        
        return {
            "answer": response,
            "ticket_id": ticket_id,
            "agent_id": agent_id,
            "sources": kb_context
        }
        
    except Exception as e:
        print(f"Error generating ticket AI response: {e}")
        return {
            "answer": "I encountered an error processing your request. Please try again.",
            "ticket_id": ticket_id,
            "agent_id": agent_id,
            "error": str(e)
        }

async def get_customer_ticket_history(customer_id: str, limit: int = 5) -> list:
    """Get customer's ticket history"""
    try:
        # Query MongoDB for customer's tickets
        tickets = await database.tickets.find(
            {"customerId": ObjectId(customer_id)}
        ).sort("createdAt", -1).limit(limit).to_list(length=limit)
        
        # Format ticket history for display
        formatted_tickets = []
        for ticket in tickets:
            ticket_status = ticket.get("status", "unknown")
            created_at = ticket.get("createdAt", datetime.utcnow())
            
            # Get AI ticket information if available
            ai_ticket = await database.aitickets.find_one({"ticketId": ticket["_id"]})
            
            formatted_tickets.append({
                "ticket_id": str(ticket["_id"]),
                "title": ticket.get("title", "Untitled Ticket"),
                "status": ticket_status,
                "created_at": created_at,
                "content_summary": ticket.get("content", "")[:100] + "..." if len(ticket.get("content", "")) > 100 else ticket.get("content", ""),
                "priority_rate": ai_ticket.get("priority_rate", None) if ai_ticket else None,
                "solution": ticket.get("solution", None),
            })
        
        return formatted_tickets
        
    except Exception as e:
        print(f"Error getting customer ticket history: {e}")
        return []

async def get_similar_tickets(ticket_id: str, limit: int = 3) -> list:
    """Get tickets similar to the current one"""
    try:
        # Get current ticket
        ticket = await database.tickets.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            return []
        
        ticket_content = ticket.get("content", "")
        ticket_title = ticket.get("title", "")
        
        # Get embedding for current ticket
        query_text = f"{ticket_title} {ticket_content}"
        query_embedding = get_query_embedding(query_text, model_st)
        
        if not query_embedding:
            return []
        
        # Search for similar tickets
        similar_tickets_ids = []
        
        # First check if AI ticket has similar_ticketids
        ai_ticket = await database.aitickets.find_one({"ticketId": ObjectId(ticket_id)})
        if ai_ticket and ai_ticket.get("similar_ticketids"):
            similar_tickets_ids = [ObjectId(tid) for tid in ai_ticket["similar_ticketids"]]
        else:
            # If not, use vector search
            search_results = search_pinecone(index, query_embedding, query_text, top_k=limit+1)  # +1 because current ticket might be included
            
            if search_results:
                for match in search_results:
                    # Extract ticket ID from metadata
                    metadata = match.get("metadata", {})
                    result_ticket_id = metadata.get("ticket_id")
                    
                    if result_ticket_id and str(result_ticket_id) != str(ticket_id):  # Skip current ticket
                        similar_tickets_ids.append(ObjectId(result_ticket_id))
          # Get ticket details for the similar tickets
        similar_tickets = []
        if similar_tickets_ids:
            tickets = await database.tickets.find(
                {"_id": {"$in": similar_tickets_ids}}
            ).limit(limit).to_list(length=limit)
            
            for similar_ticket in tickets:
                ai_ticket_data = await database.aitickets.find_one({"ticketId": similar_ticket["_id"]})
                
                similar_tickets.append({
                    "ticket_id": str(similar_ticket["_id"]),
                    "title": similar_ticket.get("title", "Untitled Ticket"),
                    "status": similar_ticket.get("status", "unknown"),
                    "content": similar_ticket.get("content", "")[:150] + "..." if len(similar_ticket.get("content", "")) > 150 else similar_ticket.get("content", ""),
                    "solution": similar_ticket.get("solution"),
                    "priority_rate": ai_ticket_data.get("priority_rate") if ai_ticket_data else None,
                    "created_at": similar_ticket.get("createdAt"),
                })
        
        return similar_tickets
        
    except Exception as e:
        print(f"Error getting similar tickets: {e}")
        return []