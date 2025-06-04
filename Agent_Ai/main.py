from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from agent_assist import (
    answer_agent_query, 
    clear_conversation_memory, 
    get_conversation_summary, 
    get_ticket_ai_response, 
    get_customer_ticket_history,
    get_similar_tickets
)
from performance_monitor import performance_router, initialize_performance_mongodb
import re # For parsing ticket_id
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
import asyncio
from contextlib import asynccontextmanager

# Import customer chatbot functions
from customer_ai import (
    chatbot_respond_to_user as customer_chatbot_respond,
    clear_conversation_memory as customer_clear_conversation,
    get_conversation_summary as customer_get_conversation_summary
)

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://hitmansur:D5ZcRgN9zXa7qeNo@discord-bot.bv4504k.mongodb.net?retryWrites=true&w=majority&appName=discord-bot")
DATABASE_NAME = os.getenv("DATABASE_NAME", "flipr")

# Global MongoDB variables
mongodb_client = None
database = None

# In your main FastAPI app
from agent_assist import initialize_mongodb

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongodb_client, database
    mongodb_client = AsyncIOMotorClient(MONGODB_URL)
    database = mongodb_client[DATABASE_NAME]
    
    # Initialize agent_assist with MongoDB
    initialize_mongodb(mongodb_client, database)
    
    # ADDED: Initialize performance monitoring with MongoDB
    initialize_performance_mongodb(mongodb_client, database)
    
    yield
    
    if mongodb_client:
        mongodb_client.close()

app = FastAPI(lifespan=lifespan)
app.include_router(performance_router)  # This line should already exist

# Gemini LLM Setup
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.3,
    convert_system_message_to_human=True,
    google_api_key='AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw'
)

# TF-IDF components for similarity search
vectorizer = None
nn_model = None
tickets_df = None

# Request schemas
class TicketAnalysisRequest(BaseModel):
    ticket_id: str  # MongoDB ObjectId as string
    company_id: str  # MongoDB ObjectId as string
    
    class Config:
        schema_extra = {
            "example": {
                "ticket_id": "507f1f77bcf86cd799439011",
                "company_id": "507f1f77bcf86cd799439012"
            }
        }

class AgentQuery(BaseModel):
    query: str
    agent_id: str  # Changed from session_id to agent_id

class SessionAction(BaseModel):
    session_id: str

class ResolvedTicket(BaseModel):
    problem: str
    solution: str
    agent_involvement: bool
    
# New models for customer chat
class CustomerChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = "default"
    company_id: Optional[str] = None
    company_name: Optional[str] = None

class CustomerChatResponse(BaseModel):
    answer: str
    sources: List[str]
    session_id: str
    should_create_ticket: Optional[bool] = False
    ticket_id: Optional[str] = None

# New models for agent ticket AI
class AgentTicketQuery(BaseModel):
    query: str
    ticket_id: str
    agent_id: str
    ticket_data: dict
    ai_ticket_data: Optional[dict] = None

class CustomerHistoryRequest(BaseModel):
    customer_id: str
    limit: Optional[int] = 5

class SimilarTicketsRequest(BaseModel):
    ticket_id: str
    limit: Optional[int] = 3

# MongoDB Helper Functions
async def get_ticket_by_id(ticket_id: str):
    """Fetch ticket by ID from MongoDB"""
    from error_handler import safe_object_id
    
    try:
        oid = safe_object_id(ticket_id)
        if not oid:
            print(f"Invalid ticket ID format: {ticket_id}")
            return None
            
        print(f"Fetching ticket with ID: {ticket_id}, ObjectId: {oid}")
        ticket = await database.tickets.find_one({"_id": oid})
        
        if ticket:
            print(f"Found ticket: {ticket['_id']}")
        else:
            print(f"No ticket found with ID: {ticket_id}")
            
        return ticket
    except Exception as e:
        print(f"Error fetching ticket {ticket_id}: {e}")
        return None

async def get_chat_by_id(chat_id: str):
    """Fetch chat by ID from MongoDB"""
    try:
        chat = await database.Chat.find_one({"_id": ObjectId(chat_id)})
        return chat
    except Exception as e:
        print(f"Error fetching chat: {e}")
        return None

async def get_company_tickets(company_id: str, limit: int = 100):
    """Get resolved tickets for a company for similarity analysis"""
    try:
        tickets = await database.tickets.find({
            "companyId": ObjectId(company_id),
            "status": "closed",
            "solution": {"$ne": None}
        }).limit(limit).to_list(length=limit)
        return tickets
    except Exception as e:
        print(f"Error fetching company tickets: {e}")
        return []

async def get_knowledge_base(company_id: str):
    """Get knowledge base for a company"""
    try:
        kb = await database.KnowledgeBase.find_one({"companyId": ObjectId(company_id)})
        return kb
    except Exception as e:
        print(f"Error fetching knowledge base: {e}")
        return None

async def save_ai_ticket_analysis(analysis_data: Dict):
    """Save AI ticket analysis to MongoDB"""
    try:
        result = await database.aitickets.insert_one(analysis_data)
        return str(result.inserted_id)
    except Exception as e:
        print(f"Error saving AI ticket analysis: {e}")
        return None

async def check_existing_analysis(ticket_id: str):
    """Check if analysis already exists for this ticket"""
    from error_handler import safe_object_id
    
    try:
        oid = safe_object_id(ticket_id)
        if not oid:
            print(f"Invalid ObjectId format when checking analysis: {ticket_id}")
            return None
            
        print(f"Checking if analysis exists for ticket: {ticket_id}, ObjectId: {oid}")
        existing = await database.aitickets.find_one({"ticketId": oid})
        
        if existing:
            print(f"Found existing analysis for ticket {ticket_id}: {existing['_id']}")
        else:
            print(f"No existing analysis found for ticket {ticket_id}")
            
        return existing
    except Exception as e:
        print(f"Error checking existing analysis for ticket {ticket_id}: {e}")
        return None

# Initialize similarity search for company tickets
async def initialize_company_ticket_search(company_id: str):
    """Initialize ticket search for a specific company"""
    global vectorizer, nn_model, tickets_df
    
    company_tickets = await get_company_tickets(company_id)
    
    if len(company_tickets) < 3:  # Need at least 3 tickets for meaningful search
        return False
    
    # Prepare ticket data for similarity analysis
    ticket_data = []
    for ticket in company_tickets:
        # Combine title and content for better matching
        problem_text = ticket.get('title', '') + ' ' + ticket.get('content', '')
        ticket_data.append({
            'problem': problem_text,
            'solution': ticket.get('solution', ''),
            'ticket_id': str(ticket['_id'])
        })
    
    tickets_df = pd.DataFrame(ticket_data)
    vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
    X = vectorizer.fit_transform(tickets_df['problem'])
    
    nn_model = NearestNeighbors(n_neighbors=min(5, len(company_tickets)), metric='cosine')
    nn_model.fit(X)
    return True

# Analysis Functions
def categorize_ticket_with_gemini(title: str, content: str) -> str:
    """Categorize ticket using Gemini"""
    full_text = f"{title} {content}"
    prompt = f"""Analyze the following customer support ticket and categorize it into one of these categories:
- order: Issues with orders, missing items, wrong orders, receipts, billing
- delivery: Late delivery, delivery partner issues, damaged item
- technical: App issues, website problems, login issues, payment failures  
- general: Menu questions, feedback, coupons, franchise inquiries

Ticket: {full_text}

Return only the category name (order/delivery/technical/general):"""
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        category = response.content.strip().lower()
        if category in ["order", "delivery", "technical", "general"]:
            return category
        return "general"
    except:
        return categorize_ticket_fallback(full_text)

def categorize_ticket_fallback(text: str) -> str:
    """Fallback categorization"""
    categories = {
        "order": ["order", "missing item", "wrong order", "receipt", "bill"],
        "delivery": ["late", "damaged", "delivery", "swiggy", "zomato"],
        "technical": ["app", "website", "login", "payment failed"],
        "general": ["menu", "feedback", "coupon", "franchise"]
    }
    text = text.lower()
    for category, keywords in categories.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "general"

def get_priority_with_gemini(text: str) -> int:
    """Get priority score (1-5) using Gemini"""
    prompt = f"""Analyze the sentiment and urgency of this customer support text and determine priority level:

Text: {text}

Consider:
- Very urgent/angry language = 5 (Highest priority)
- Negative sentiment/frustrated = 4 (High priority)
- Neutral/Mixed sentiment = 3 (Medium priority)
- Positive but needs attention = 2 (Low priority)  
- Positive feedback/compliments = 1 (Lowest priority)

Return only a number from 1-5:"""
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        priority = int(response.content.strip())
        if 1 <= priority <= 5:
            return priority
        return 3
    except:
        return 3

def get_similar_tickets(problem_text: str) -> List[str]:
    """Get similar ticket IDs using TF-IDF"""
    if tickets_df is None or vectorizer is None or nn_model is None:
        return []
    
    try:
        problem_vec = vectorizer.transform([problem_text])
        distances, indices = nn_model.kneighbors(problem_vec)
        
        similar_ticket_ids = []
        for i, idx in enumerate(indices[0]):
            if distances[0][i] < 0.7:  # Only include reasonably similar tickets
                similar_ticket_ids.append(tickets_df['ticket_id'].iloc[idx])
        
        return similar_ticket_ids
    except:
        return []

def generate_solution_with_gemini(ticket_content: str, similar_solutions: List[str], kb_content: str = "") -> str:
    """Generate solution using Gemini with context"""
    context_parts = []
    
    if similar_solutions:
        context_parts.append("Similar past solutions:")
        for i, sol in enumerate(similar_solutions[:3]):
            context_parts.append(f"{i+1}. {sol}")
    
    if kb_content:
        context_parts.append(f"Knowledge base information: {kb_content}")
    
    context = "\n".join(context_parts)
    
    prompt = f"""Based on the following customer support ticket and available context, provide a helpful solution:

Customer Issue: {ticket_content}

Available Context:
{context}

Provide a clear, actionable solution for the customer's problem:"""
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
    except Exception as e:
        print(f"Error generating solution: {e}")
        return "Please contact our support team for assistance with this issue."

def generate_summary_with_gemini(title: str, content: str, messages: List[Dict]) -> str:
    """Generate summary using Gemini"""
    # Combine all text
    all_text = f"Title: {title}\nContent: {content}\n"
    if messages:
        all_text += "Messages: " + " ".join([msg.get('content', '') for msg in messages])
    
    prompt = f"""Summarize this customer support ticket in 2-3 sentences. Focus on the main issue and any important details:

Ticket Information: {all_text}

Summary:"""
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()
    except:
        return (title + " " + content)[:200] + "..." if len(title + content) > 200 else (title + " " + content)

# Main Analysis Function
async def analyze_ticket_comprehensive(ticket_id: str, company_id: str) -> Dict:
    """Comprehensive ticket analysis"""
    
    # Check if analysis already exists
    existing_analysis = await check_existing_analysis(ticket_id)
    if existing_analysis:
        return {
            "message": "Analysis already exists for this ticket",
            "existing_analysis": existing_analysis,
            "status": "exists"
        }
    
    # Fetch ticket data
    ticket = await get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Fetch chat data if available
    chat_data = None
    if ticket.get('chatId'):
        chat_data = await get_chat_by_id(str(ticket['chatId']))
    
    # Initialize similarity search for this company
    await initialize_company_ticket_search(company_id)
    
    # Prepare text for analysis
    title = ticket.get('title', '')
    content = ticket.get('content', '')
    messages = ticket.get('messages', [])
    full_text = f"{title} {content}"
    
    # Add chat contents if available
    if chat_data and chat_data.get('contents'):
        chat_messages = [msg.get('content', '') for msg in chat_data['contents']]
        full_text += " " + " ".join(chat_messages)
    
    # Perform analysis
    category = categorize_ticket_with_gemini(title, content)
    priority_rate = get_priority_with_gemini(full_text)
    similar_ticket_ids = get_similar_tickets(full_text)
    
    # Get solutions from similar tickets
    similar_solutions = []
    if similar_ticket_ids:
        for ticket_id_str in similar_ticket_ids[:3]:
            similar_ticket = await get_ticket_by_id(ticket_id_str)
            if similar_ticket and similar_ticket.get('solution'):
                similar_solutions.append(similar_ticket['solution'])
    
    # Get knowledge base content
    kb_content = ""
    kb = await get_knowledge_base(company_id)
    if kb and kb.get('knowledgeBases'):
        # Simple KB content extraction (you might want to enhance this)
        kb_titles = [kb_item.get('title', '') for kb_item in kb['knowledgeBases']]
        kb_content = " ".join(kb_titles)
    
    # Generate solution and summary
    predicted_solution = generate_solution_with_gemini(full_text, similar_solutions, kb_content)
    summarized_content = generate_summary_with_gemini(title, content, messages)
    
    # Prepare analysis data for MongoDB
    analysis_data = {
        "ticketId": ObjectId(ticket_id),
        "companyId": ObjectId(company_id),
        "category": category,
        "priority_rate": priority_rate,
        "predicted_solution": predicted_solution,
        "predicted_solution_attachment": None,  # You can implement file attachment logic
        "summarized_content": summarized_content,
        "similar_ticketids": [ObjectId(tid) for tid in similar_ticket_ids if ObjectId.is_valid(tid)],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    # Save to MongoDB
    analysis_id = await save_ai_ticket_analysis(analysis_data)
    
    return {
        "analysis_id": analysis_id,
        "ticket_id": ticket_id,
        "company_id": company_id,
        "category": category,
        "priority_rate": priority_rate,
        "predicted_solution": predicted_solution,
        "summarized_content": summarized_content,
        "similar_tickets_count": len(similar_ticket_ids),
        "similar_ticket_ids": similar_ticket_ids,
        "status": "completed"
    }

# API Endpoints
@app.post("/analyze-ticket")
async def analyze_ticket_endpoint(request: TicketAnalysisRequest):
    """Main endpoint to analyze a ticket"""
    from error_handler import safe_object_id, handle_db_error
    
    # Log the request
    print(f"Analyze ticket request received: ticket_id={request.ticket_id}, company_id={request.company_id}")
      # Validate IDs
    ticket_oid = safe_object_id(request.ticket_id)
    if not ticket_oid:
        raise HTTPException(status_code=400, detail=f"Invalid ticket ID format: {request.ticket_id}")
    
    company_oid = safe_object_id(request.company_id)
    if not company_oid:
        raise HTTPException(status_code=400, detail=f"Invalid company ID format: {request.company_id}")
    
    try:
            
        # Process the analysis
        result = await analyze_ticket_comprehensive(request.ticket_id, request.company_id)
        print(f"Analysis completed for ticket {request.ticket_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Analysis failed for ticket {request.ticket_id}: {str(e)}")
        handle_db_error(e, f"analyzing ticket {request.ticket_id}")

@app.get("/ticket-analysis/{ticket_id}")
async def get_ticket_analysis(ticket_id: str):
    """Get existing analysis for a ticket"""
    from error_handler import safe_object_id, handle_db_error
    
    try:
        # Validate ticket_id format
        oid = safe_object_id(ticket_id)
        if not oid:
            print(f"Invalid ObjectId format for ticket_id: {ticket_id}")
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")
            
        print(f"Looking up analysis for ticket: {ticket_id}, ObjectId: {oid}")
        analysis = await database.aitickets.find_one({"ticketId": oid})
        
        if not analysis:
            print(f"No analysis found for ticket: {ticket_id}")
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Convert ObjectIds to strings for JSON response
        analysis['_id'] = str(analysis['_id'])
        analysis['ticketId'] = str(analysis['ticketId'])
        analysis['companyId'] = str(analysis['companyId'])
        analysis['similar_ticketids'] = [str(tid) for tid in analysis.get('similar_ticketids', [])]
        
        print(f"Found analysis for ticket {ticket_id}: {analysis}")
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching analysis for ticket {ticket_id}: {str(e)}")
        handle_db_error(e, f"fetching analysis for ticket {ticket_id}")

@app.get("/company-analytics/{company_id}")
async def get_company_analytics(company_id: str):
    """Get analytics for a company"""
    try:
        # Get total tickets analyzed
        total_analyzed = await database.aitickets.count_documents({"companyId": ObjectId(company_id)})
        
        # Get category distribution
        pipeline = [
            {"$match": {"companyId": ObjectId(company_id)}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        category_stats = await database.aitickets.aggregate(pipeline).to_list(length=100)
        
        # Get priority distribution
        pipeline = [
            {"$match": {"companyId": ObjectId(company_id)}},
            {"$group": {"_id": "$priority_rate", "count": {"$sum": 1}}}
        ]
        priority_stats = await database.aitickets.aggregate(pipeline).to_list(length=100)
        
        return {
            "company_id": company_id,
            "total_tickets_analyzed": total_analyzed,
            "category_distribution": {stat["_id"]: stat["count"] for stat in category_stats},
            "priority_distribution": {stat["_id"]: stat["count"] for stat in priority_stats}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")

# Update endpoints to use agent_id instead of session_id
@app.post("/agent-assist-chat")
async def agent_assist_chat(request: AgentQuery):
    return await answer_agent_query(request.query, request.agent_id)

@app.post("/agent-assist/clear-session")
def clear_agent_session(request: SessionAction):
    """Clear conversation memory for a specific session"""
    success = clear_conversation_memory(request.session_id)
    return {
        "message": f"Session {request.session_id} cleared successfully" if success else "Session not found",
        "success": success
    }

@app.post("/agent-assist/get-conversation")
def get_agent_conversation(request: SessionAction):
    """Get conversation history for a specific session"""
    return get_conversation_summary(request.session_id)

# Customer Chatbot Endpoints
@app.post("/customer-chatbot/respond")
async def customer_chatbot_respond_endpoint(request: AgentQuery):
    """Customer chatbot response endpoint"""
    try:
        response = await customer_chatbot_respond(request.query, request.agent_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in customer chatbot: {str(e)}")

@app.post("/customer-chat/clear-session")
def clear_customer_chat_session(request: SessionAction):
    """Clear customer chat conversation memory for a specific session"""
    success = customer_clear_conversation(request.session_id)
    return {
        "message": f"Customer session {request.session_id} cleared successfully" if success else "Session not found",
        "success": success
    }

@app.post("/customer-chat/get-conversation")
def get_customer_chat_conversation(request: SessionAction):
    """Get customer chat conversation history for a specific session"""
    return customer_get_conversation_summary(request.session_id)

@app.get("/")
def root():
    return {"message": "AI Customer Support System with MongoDB and Performance Monitoring is running"}  # UPDATED: Added performance monitoring mention

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        await mongodb_client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "performance_monitoring": "enabled"}  # UPDATED: Added performance monitoring status
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

@app.post("/customer-chat/respond", response_model=CustomerChatResponse)
async def customer_chat_respond(request: CustomerChatRequest):
    """Process a customer chat message and return an AI response"""
    try:
        print(f"Processing customer chat request: {request.query[:50]}...")
        
        raw_response = customer_chatbot_respond(
            query=request.query,
            session_id=request.session_id,
            company_id=request.company_id,
            company_name=request.company_name
        )
        
        # Extract response data
        answer = raw_response.get("answer", "")
        sources = raw_response.get("sources", [])
        session_id = raw_response.get("session_id", request.session_id)
        
        # Check if response already has ticket info
        should_create_ticket = raw_response.get("should_create_ticket", False)
        ticket_id = raw_response.get("ticket_id")
        
        # For backward compatibility - extract ticket ID from answer text if not in response data
        if not ticket_id:
            ticket_id_match = re.search(r"TCKT-[A-Z0-9]+", answer)
            if ticket_id_match:
                ticket_id = ticket_id_match.group(0)
                should_create_ticket = True
        
        return CustomerChatResponse(
            answer=answer,
            sources=sources,
            session_id=session_id,
            should_create_ticket=should_create_ticket,
            ticket_id=ticket_id
        )
    except Exception as e:
        print(f"Error processing customer chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing customer chat: {str(e)}")

@app.post("/customer-chat/clear-memory")
async def clear_customer_chat_memory(request: SessionAction):
    """Clear the conversation memory for a customer chat session"""
    success = customer_clear_conversation(request.session_id)
    return {"success": success, "message": "Session cleared" if success else "Session not found"}

@app.post("/customer-chat/get-summary")
async def get_customer_chat_summary(request: SessionAction):
    """Get a summary of the conversation history for a customer chat session"""
    summary = customer_get_conversation_summary(request.session_id)
    return summary

@app.get("/db-stats")
async def get_database_stats():
    """Get database statistics"""
    try:
        stats = {            "tickets": await database.tickets.count_documents({}),
            "ai_tickets": await database.aitickets.count_documents({}),
            "chats": await database.Chat.count_documents({}),
            "agents": await database.Agent.count_documents({}),
            "customers": await database.Customer.count_documents({}),
            "companies": await database.Company.count_documents({}),
            "knowledge_bases": await database.KnowledgeBase.count_documents({}),
            "util_tickets": await database.UtilTicket.count_documents({}),
            "a_chats": await database.a_chats.count_documents({})
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching database stats: {str(e)}")

# Agent AI endpoints
@app.post("/agent-ai/respond")
async def agent_ai_respond(request: AgentQuery):
    """Generate AI response to general agent queries"""
    try:
        result = await answer_agent_query(request.query, request.agent_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.post("/agent-ai/ticket-respond")
async def agent_ticket_ai_respond(request: AgentTicketQuery):
    """Generate AI response for ticket-specific queries"""
    try:
        result = await get_ticket_ai_response(
            request.query, 
            request.ticket_id,
            request.agent_id,
            request.ticket_data,
            request.ai_ticket_data
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating ticket response: {str(e)}")

@app.post("/agent-ai/customer-history")
async def get_customer_history(request: CustomerHistoryRequest):
    """Get customer ticket history"""
    try:
        history = await get_customer_ticket_history(request.customer_id, request.limit)
        return {"customer_id": request.customer_id, "tickets": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching customer history: {str(e)}")

@app.post("/agent-ai/similar-tickets")
async def find_similar_tickets(request: SimilarTicketsRequest):
    """Get tickets similar to the specified one"""
    try:
        tickets = await get_similar_tickets(request.ticket_id, request.limit)
        return {"ticket_id": request.ticket_id, "similar_tickets": tickets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding similar tickets: {str(e)}")