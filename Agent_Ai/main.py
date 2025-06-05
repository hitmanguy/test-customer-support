from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from bson import ObjectId
from datetime import datetime
import os
import asyncio
import re
from contextlib import asynccontextmanager

from config import MONGODB_URL, DATABASE_NAME
from database import initialize_mongodb, get_db, get_client, close_mongodb_connection
from ai_utils import get_context_from_kb, generate_llm_response
from performance_monitor import performance_router

from agent_assist import (
    answer_agent_query, 
    clear_conversation_memory, 
    get_conversation_summary, 
    get_ticket_ai_response, 
    get_customer_ticket_history,
    get_similar_tickets,
    initialize_agent_assist
)

from customer_ai import (
    chatbot_respond_to_user as customer_chatbot_respond,
    clear_conversation_memory as customer_clear_conversation,
    get_conversation_summary as customer_get_conversation_summary,
    initialize_customer_ai
)

vectorizer = None
nn_model = None
tickets_df = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = initialize_mongodb(MONGODB_URL, DATABASE_NAME)
    
    initialize_agent_assist(db)
    initialize_customer_ai()
    
    from performance_monitor import initialize_performance_mongodb
    initialize_performance_mongodb(db)
    
    yield
    
    await close_mongodb_connection()

app = FastAPI(
    title="AI Customer Support API",
    description="API for AI-powered customer support features",
    version="1.0.0",
    lifespan=lifespan
)
app.include_router(performance_router)

class TicketAnalysisRequest(BaseModel):
    ticket_id: str 
    company_id: str
    
    class Config:
        schema_extra = {
            "example": {
                "ticket_id": "507f1f77bcf86cd799439011",
                "company_id": "507f1f77bcf86cd799439012"
            }
        }

class AgentQuery(BaseModel):
    query: str
    agent_id: str 

class SessionAction(BaseModel):
    session_id: str

class ResolvedTicket(BaseModel):
    problem: str
    solution: str
    agent_involvement: bool
    
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

async def get_ticket_by_id(ticket_id: str):
    """Fetch ticket by ID from MongoDB"""
    from error_handler import safe_object_id
    
    try:
        oid = safe_object_id(ticket_id)
        if not oid:        
            print(f"Invalid ticket ID format: {ticket_id}")
            return None
        print(f"Fetching ticket with ID: {ticket_id}, ObjectId: {oid}")
        database = get_db()
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
        database = get_db()
        chat = await database.chats.find_one({"_id": ObjectId(chat_id)})
        return chat
    except Exception as e:
        print(f"Error fetching chat: {e}")
        return None

async def get_company_tickets(company_id: str, limit: int = 100):
    """Get resolved tickets for a company for similarity analysis"""    
    try:
        database = get_db()
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
        database = get_db()
        kb = await database.knowledgebases.find_one({"companyId": ObjectId(company_id)})
        return kb
    except Exception as e:
        print(f"Error fetching knowledge base: {e}")
        return None

async def save_ai_ticket_analysis(analysis_data: Dict):
    """Save AI ticket analysis to MongoDB"""    
    try:
        database = get_db()
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
        database = get_db()
        existing = await database.aitickets.find_one({"ticketId": oid})
        
        if existing:
            print(f"Found existing analysis for ticket {ticket_id}: {existing['_id']}")
        else:
            print(f"No existing analysis found for ticket {ticket_id}")
            
        return existing
    except Exception as e:
        print(f"Error checking existing analysis for ticket {ticket_id}: {e}")
        return None

async def initialize_company_ticket_search(company_id: str):
    """Initialize ticket search for a specific company"""
    global vectorizer, nn_model, tickets_df
    
    company_tickets = await get_company_tickets(company_id)
    
    if len(company_tickets) < 3:  
        return False
    
    ticket_data = []
    for ticket in company_tickets:
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

def categorize_ticket_with_gemini(title: str, content: str) -> str:
    """Categorize ticket using Gemini"""
    full_text = f"{title} {content}"
    prompt = f"""Analyze the following customer support ticket and categorize it into one of these categories:
- order: Issues with orders, missing items, wrong orders, receipts, billing
- delivery: Late delivery, delivery partner issues, damaged item
- technical: App issues, website problems, login issues, payment failures  
- general: Menu questions, feedback, coupons, franchise inquiries

Ticket: {full_text}    Return only the category name (order/delivery/technical/general):"""
    
    try:
        response = generate_llm_response(prompt)
        category = response.strip().lower()
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
        response = generate_llm_response(prompt)
        priority = int(response.strip())
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
            if distances[0][i] < 0.7: 
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
{context}    Provide a clear, actionable solution for the customer's problem:"""
    
    try:
        response = generate_llm_response(prompt)
        return response.strip()
    except Exception as e:
        print(f"Error generating solution: {e}")
        return "Please contact our support team for assistance with this issue."

def generate_summary_with_gemini(title: str, content: str, messages: List[Dict]) -> str:
    """Generate summary using Gemini"""
                      
    all_text = f"Title: {title}\nContent: {content}\n"
    if messages:
        all_text += "Messages: " + " ".join([msg.get('content', '') for msg in messages])
    
    prompt = f"""Summarize this customer support ticket in 2-3 sentences. Focus on the main issue and any important details:

Ticket Information: {all_text}

Summary:"""
    try:
        response = generate_llm_response(prompt)
        return response.strip()
    except:
        return (title + " " + content)[:200] + "..." if len(title + content) > 200 else (title + " " + content)

                        
async def analyze_ticket_comprehensive(ticket_id: str, company_id: str) -> Dict:
    """Comprehensive ticket analysis"""
    existing_analysis = await check_existing_analysis(ticket_id)
    if existing_analysis:
        existing_analysis['_id'] = str(existing_analysis['_id'])
        existing_analysis['ticketId'] = str(existing_analysis['ticketId'])
        existing_analysis['companyId'] = str(existing_analysis['companyId'])
        existing_analysis['similar_ticketids'] = [str(tid) for tid in existing_analysis.get('similar_ticketids', [])]
        
        return {
            "message": "Analysis already exists for this ticket",
            "existing_analysis": existing_analysis,
            "status": "exists"
        }
    
    ticket = await get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    chat_data = None
    if ticket.get('chatId'):
        chat_data = await get_chat_by_id(str(ticket['chatId']))
    
    await initialize_company_ticket_search(company_id)
    
    title = ticket.get('title', '')
    content = ticket.get('content', '')
    messages = ticket.get('messages', [])
    full_text = f"{title} {content}"
    
    if chat_data and chat_data.get('contents'):
        chat_messages = [msg.get('content', '') for msg in chat_data['contents']]
        full_text += " " + " ".join(chat_messages)
    
    category = categorize_ticket_with_gemini(title, content)
    priority_rate = get_priority_with_gemini(full_text)
    similar_ticket_ids = get_similar_tickets(full_text)
    
    similar_solutions = []
    if similar_ticket_ids:
        for ticket_id_str in similar_ticket_ids[:3]:
            similar_ticket = await get_ticket_by_id(ticket_id_str)
            if similar_ticket and similar_ticket.get('solution'):
                similar_solutions.append(similar_ticket['solution'])
    
    kb_content = ""
    kb = await get_knowledge_base(company_id)
    if kb and kb.get('knowledgeBases'):
        kb_titles = [kb_item.get('title', '') for kb_item in kb['knowledgeBases']]
        kb_content = " ".join(kb_titles)
    
    predicted_solution = generate_solution_with_gemini(full_text, similar_solutions, kb_content)
    summarized_content = generate_summary_with_gemini(title, content, messages)
    
    analysis_data = {
        "ticketId": ObjectId(ticket_id),
        "companyId": ObjectId(company_id),
        "category": category,
        "priority_rate": priority_rate,
        "predicted_solution": predicted_solution,
        "predicted_solution_attachment": None,  
        "summarized_content": summarized_content,
        "similar_ticketids": [ObjectId(tid) for tid in similar_ticket_ids if ObjectId.is_valid(tid)],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

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

@app.post("/analyze-ticket")
async def analyze_ticket_endpoint(request: TicketAnalysisRequest):
    """Main endpoint to analyze a ticket"""
    from error_handler import safe_object_id, handle_db_error

    print(f"Analyze ticket request received: ticket_id={request.ticket_id}, company_id={request.company_id}")
    ticket_oid = safe_object_id(request.ticket_id)
    if not ticket_oid:
        raise HTTPException(status_code=400, detail=f"Invalid ticket ID format: {request.ticket_id}")
    
    company_oid = safe_object_id(request.company_id)
    if not company_oid:
        raise HTTPException(status_code=400, detail=f"Invalid company ID format: {request.company_id}")
    
    try:
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
        oid = safe_object_id(ticket_id)
        if not oid:
            print(f"Invalid ObjectId format for ticket_id: {ticket_id}")
            raise HTTPException(status_code=400, detail="Invalid ticket ID format")
        print(f"Looking up analysis for ticket: {ticket_id}, ObjectId: {oid}")
        database = get_db()
        analysis = await database.aitickets.find_one({"ticketId": oid})
        
        if not analysis:
            print(f"No analysis found for ticket: {ticket_id}")
            raise HTTPException(status_code=404, detail="Analysis not found")
        
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
        database = get_db()
        total_analyzed = await database.aitickets.count_documents({"companyId": ObjectId(company_id)})

        pipeline = [
            {"$match": {"companyId": ObjectId(company_id)}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        category_stats = await database.aitickets.aggregate(pipeline).to_list(length=100)

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
    return {"message": "AI Customer Support System with MongoDB and Performance Monitoring is running"}                                                 

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        mongodb_client = get_client()
        if mongodb_client is None:
            return {"status": "unhealthy", "database": "disconnected", "error": "MongoDB client not initialized"}
        
        await mongodb_client.admin.command('ping')
        return {"status": "healthy", "database": "connected", "performance_monitoring": "enabled"}                                                
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
        
        answer = raw_response.get("answer", "")
        sources = raw_response.get("sources", [])
        session_id = raw_response.get("session_id", request.session_id)
        
                                                   
        should_create_ticket = raw_response.get("should_create_ticket", False)
        ticket_id = raw_response.get("ticket_id")
        
                                                                                                 
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
        database = get_db()
        stats = {
            "tickets": await database.tickets.count_documents({}),
            "ai_tickets": await database.aitickets.count_documents({}),
            "chats": await database.chats.count_documents({}),            "agents": await database.agents.count_documents({}),
            "customers": await database.customers.count_documents({}),
            "companies": await database.companies.count_documents({}),
            "knowledge_bases": await database.knowledgebases.count_documents({}),
            "util_tickets": await database.utiltickets.count_documents({}),
            "a_chats": await database.a_chats.count_documents({})
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching database stats: {str(e)}")

                    
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