

"""
Customer AI Chat module with optimized structure
"""
from typing import List, Dict, Optional
import uuid
import datetime
import logging
from ai_utils import get_context_from_kb, generate_llm_response

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("CustomerAI")

# In-Memory Conversation Storage
conversation_memory: Dict[str, List[Dict]] = {}
support_tickets: Dict[str, Dict] = {}

def initialize_customer_ai():
    """Initialize customer AI module"""
    logger.info("Initializing Customer AI module")

# -------------------------------
# Chat Memory Functions
# -------------------------------
def get_conversation_context(session_id: str) -> str:
    """Get recent conversation history for context"""
    if session_id not in conversation_memory:
        return ""
        
    from config import AI_CONFIG
    history = conversation_memory[session_id]
    recent_history = history[-AI_CONFIG["CHAT"]["RECENT_HISTORY"]:]
    
    context_parts = []
    for exchange in recent_history:
        context_parts.append(f"User: {exchange['query']}")
        context_parts.append(f"Chatbot: {exchange['response']}")
    
    return "\n".join(context_parts)

def store_conversation(session_id: str, query: str, response: str) -> None:
    """Store conversation exchange in memory"""
    if session_id not in conversation_memory:
        conversation_memory[session_id] = []
        
    from config import AI_CONFIG
    conversation_memory[session_id].append({
        'query': query,
        'response': response,
        'timestamp': datetime.datetime.utcnow()
    })
    
    # Keep conversation memory size in check
    max_history = AI_CONFIG["CHAT"]["MAX_HISTORY"]
    if len(conversation_memory[session_id]) > max_history:
        conversation_memory[session_id] = conversation_memory[session_id][-max_history:]

def clear_conversation_memory(session_id: str) -> bool:
    """Clear conversation memory for a session"""
    if session_id in conversation_memory:
        del conversation_memory[session_id]
        logger.info(f"Cleared conversation memory for session {session_id}")
        return True
    return False

def get_conversation_summary(session_id: str) -> dict:
    """Get summary of conversation for a session"""
    if session_id not in conversation_memory:
        return {"message": "No conversation found for this session"}
        
    history = conversation_memory[session_id]
    return {
        "session_id": session_id,
        "total_exchanges": len(history),
        "conversation": history
    }

# -------------------------------
# Ticket Creation Logic
# -------------------------------
def should_create_ticket(query: str, context_chunks: List[str]) -> bool:
    """Determine if a support ticket should be created based on user query"""
    from config import AI_CONFIG
    
    # Simple keyword-based detection
    help_indicators = AI_CONFIG["TICKET"]["HELP_INDICATORS"]
    query_lower = query.lower()
    
    # Check for ticket creation keywords
    for indicator in help_indicators:
        if indicator in query_lower:
            return True
            
    # Look for distress signals in the query
    distress_signals = ["urgent", "emergency", "problem", "broken", "not working", "help me"]
    for signal in distress_signals:
        if signal in query_lower:
            return True
            
    # If we got here, no clear indicators for ticket creation
    return False

def create_support_ticket(session_id: str, issue: str) -> str:
    """Create a support ticket in memory"""
    ticket_id = f"TCKT-{uuid.uuid4().hex[:8].upper()}"
    
    support_tickets[ticket_id] = {
        'session_id': session_id,
        'issue': issue,
        'created_at': datetime.datetime.utcnow(),
        'status': 'open'
    }
    
    logger.info(f"Created support ticket {ticket_id} for session {session_id}")
    return ticket_id

# -------------------------------
# Chatbot Response Generation
# -------------------------------
def generate_customer_response(context_chunks: List[str], question: str, conversation_context: str = "", company_name: str = None) -> str:
    """Generate response specifically for customer queries"""
    # Create prompt with context
    context_text = "\n\n".join(context_chunks) if context_chunks else "No specific information found on this topic."
    
    company_context = f"You are a customer support AI for {company_name}." if company_name else "You are a customer support AI."
    
    system_prompt = f"""
    {company_context}
    Be helpful, friendly, and concise in your responses.
    If you don't know something, be honest about it.
    Only offer to create a support ticket if the user has an actual problem that needs human assistance.
    """
    
    prompt = f"""
    Conversation History:
    {conversation_context}
    
    Knowledge Base Information:
    {context_text}
    
    Customer's Question: {question}
    
    Your helpful response:
    """
    
    return generate_llm_response(prompt, system_prompt)

# -------------------------------
# Main Chatbot Logic
# -------------------------------
def chatbot_respond_to_user(
    query: str, 
    session_id: str = "default",
    company_id: Optional[str] = None,
    company_name: Optional[str] = None
) -> dict:
    """Main function to generate customer chatbot responses"""
    # Generate a session ID if not provided
    if not session_id or session_id == "default":
        session_id = f"chat-{uuid.uuid4().hex[:8]}"
        
    logger.info(f"Processing query for session {session_id[:10]}...")
    
    # Get conversation context
    conversation_context = get_conversation_context(session_id)
    
    # Get relevant knowledge base context
    context_chunks = get_context_from_kb(query, company_id)
    
    # Check if we should create a ticket
    ticket_creation = should_create_ticket(query, context_chunks)
    ticket_id = None
    
    # Generate response
    if not context_chunks:
        response = generate_customer_response([], query, conversation_context, company_name)
    else:
        response = generate_customer_response(context_chunks, query, conversation_context, company_name)
    
    # Create ticket if needed
    if ticket_creation:
        ticket_id = create_support_ticket(session_id, query)
        response += f"\n\nI've created a support ticket for you. Your ticket ID is {ticket_id}. A human agent will follow up with you shortly."
    
    # Store this conversation exchange
    store_conversation(session_id, query, response)
    
    # Return the response and related info
    result = {
        "answer": response,
        "sources": context_chunks,
        "session_id": session_id,
    }
    
    # Add ticket information if created
    if ticket_id:
        result["should_create_ticket"] = True
        result["ticket_id"] = ticket_id
    
    return result

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
- Do not mention that you lack specific information about the company    - If the question seems like it needs human assistance, suggest they can contact support

Response:"""

    logger.info(f"Generating general response for question: {question[:50]}...")
    response = generate_llm_response(prompt)
    return response.strip()

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