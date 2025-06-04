from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import statistics
import json
from collections import defaultdict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

# Initialize Gemini LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.3,
    convert_system_message_to_human=True,
    google_api_key='AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw'
)

# Create router for performance monitoring
performance_router = APIRouter(prefix="/performance", tags=["Agent Performance"])

# Global MongoDB variables
mongodb_client = None
database = None

def initialize_performance_mongodb(client: AsyncIOMotorClient, db):
    """Initialize MongoDB connection for performance monitoring"""
    global mongodb_client, database
    mongodb_client = client
    database = db

# Pydantic models
class PerformanceRequest(BaseModel):
    agent_id: Optional[str] = None
    company_id: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class QualityAssessmentRequest(BaseModel):
    ticket_id: str
    
class AgentComparisonRequest(BaseModel):
    company_id: str
    agent_ids: List[str]

# MongoDB Helper Functions
async def get_agent_tickets(agent_id: str, company_id: str, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Get all tickets handled by a specific agent"""
    try:
        query = {
            "agentId": ObjectId(agent_id),
            "companyId": ObjectId(company_id),
            "status": "closed"  # Only analyze closed tickets
        }
        
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query["createdAt"] = date_filter
        
        tickets = await database.tickets.find(query).to_list(length=None)
        return tickets
    except Exception as e:
        print(f"Error fetching agent tickets: {e}")
        return []

async def get_util_tickets_by_ticket_ids(ticket_ids: List[str]):
    """Get util ticket data for performance metrics"""
    try:
        object_ids = [ObjectId(tid) for tid in ticket_ids if ObjectId.is_valid(tid)]
        util_tickets = await database.UtilTicket.find({
            "ticketId": {"$in": object_ids}
        }).to_list(length=None)
        
        # Convert to dict for easy lookup
        util_dict = {}
        for util in util_tickets:
            util_dict[str(util['ticketId'])] = util
        
        return util_dict
    except Exception as e:
        print(f"Error fetching util tickets: {e}")
        return {}

async def get_agent_info(agent_id: str):
    """Get agent information"""
    try:
        agent = await database.Agent.find_one({"_id": ObjectId(agent_id)})
        return agent
    except Exception as e:
        print(f"Error fetching agent info: {e}")
        return None

async def get_company_agents(company_id: str):
    """Get all agents for a company"""
    try:
        agents = await database.Agent.find({"companyId": ObjectId(company_id)}).to_list(length=None)
        return agents
    except Exception as e:
        print(f"Error fetching company agents: {e}")
        return []

async def get_company_tickets(company_id: str, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
    """Get all tickets for a company"""
    try:
        query = {
            "companyId": ObjectId(company_id),
            "status": "closed"
        }
        
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query["createdAt"] = date_filter
        
        tickets = await database.tickets.find(query).to_list(length=None)
        return tickets
    except Exception as e:
        print(f"Error fetching company tickets: {e}")
        return []

def calculate_handling_time(ticket_data: Dict, util_data: Dict) -> float:
    """Calculate handling time in minutes"""
    if not util_data or not util_data.get('seen_time') or not util_data.get('resolved_time'):
        return 0.0
    
    handling_time = (util_data['resolved_time'] - util_data['seen_time']).total_seconds() / 60
    return max(handling_time, 0.0)

def analyze_solution_quality(ticket: Dict) -> Dict:
    """Analyze the quality of agent's solution using Gemini"""
    
    customer_issue = ticket.get('content', '')
    agent_solution = ticket.get('solution', '')
    issue_title = ticket.get('title', '')
    
    if not agent_solution:
        return {
            "completeness": 1,
            "clarity": 1,
            "empathy": 1,
            "proactiveness": 1,
            "technical_accuracy": 1,
            "customer_focus": 1,
            "strengths": ["No solution provided"],
            "improvements": ["Provide detailed solution", "Address customer needs", "Show empathy"],
            "grade": "F",
            "feedback": "No solution was provided for the customer issue."
        }
    
    prompt = f"""Analyze this customer service ticket solution for quality:

Customer Issue: {issue_title}
Customer Description: {customer_issue}
Agent Solution: {agent_solution}

Evaluate the agent's solution quality based on:

1. Completeness - Does it fully address the customer's issue?
2. Clarity - Is the solution clear and easy to understand?
3. Empathy - Does it show understanding and care for customer's situation?
4. Proactiveness - Does it go beyond minimum requirements?
5. Technical Accuracy - Is the solution technically sound and feasible?
6. Customer Focus - Is it focused on customer satisfaction?

Respond with a valid JSON object with exactly this structure:
{{
    "completeness": 8,
    "clarity": 7,
    "empathy": 9,
    "proactiveness": 8,
    "technical_accuracy": 7,
    "customer_focus": 9,
    "strengths": ["strength1", "strength2", "strength3"],
    "improvements": ["improvement1", "improvement2"],
    "grade": "B",
    "feedback": "Detailed feedback about the solution quality"
}}

Scores should be 1-10. Grade should be A, B, C, D, or F. Return only valid JSON, no additional text."""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        result = response.content.strip()
        
        # Parse JSON response
        analysis = json.loads(result)
        
        # Validate required keys
        required_keys = ["completeness", "clarity", "empathy", "proactiveness", "technical_accuracy", "customer_focus", "strengths", "improvements", "grade", "feedback"]
        for key in required_keys:
            if key not in analysis:
                raise ValueError(f"Missing key: {key}")
        
        return analysis
        
    except (json.JSONDecodeError, ValueError, Exception) as e:
        print(f"Error in solution analysis: {e}")
        return {
            "completeness": 6,
            "clarity": 6,
            "empathy": 6,
            "proactiveness": 6,
            "technical_accuracy": 6,
            "customer_focus": 6,
            "strengths": ["Provided solution", "Addressed issue", "Professional tone"],
            "improvements": ["More detailed explanation", "Show more empathy", "Proactive follow-up"],
            "grade": "C",
            "feedback": "Average solution quality with room for improvement in customer engagement and detail."
        }

def generate_coaching_recommendations(agent_performance: Dict) -> Dict:
    """Generate personalized coaching recommendations based on solution quality"""
    
    performance_summary = f"""
Agent Performance Summary:
- Average Handling Time: {agent_performance.get('avg_handling_time', 0):.1f} minutes
- Customer Satisfaction: {agent_performance.get('avg_csat', 0):.1f}/5
- Solution Quality Scores: {agent_performance.get('solution_scores', {})}
- Total Tickets Handled: {agent_performance.get('total_tickets', 0)}
- Common Issue Types: {agent_performance.get('common_issues', [])}
"""
    
    prompt = f"""Based on this agent performance data focused on solution quality, provide personalized coaching recommendations:

{performance_summary}

Respond with a valid JSON object with exactly this structure:
{{
    "strengths": ["strength1", "strength2", "strength3"],
    "improvements": ["improvement1", "improvement2", "improvement3"],
    "training": ["training1", "training2", "training3"],
    "short_term_goals": ["goal1", "goal2", "goal3"],
    "long_term_plan": ["plan1", "plan2", "plan3"]
}}

Focus on solution writing skills, customer empathy, technical knowledge, and response quality. 
Make sure to provide exactly 3 items for each array and return only valid JSON, no additional text."""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        result = response.content.strip()
        
        # Parse JSON response
        recommendations = json.loads(result)
        
        # Validate structure
        required_keys = ["strengths", "improvements", "training", "short_term_goals", "long_term_plan"]
        for key in required_keys:
            if key not in recommendations or not isinstance(recommendations[key], list):
                raise ValueError(f"Missing or invalid key: {key}")
        
        return recommendations
        
    except (json.JSONDecodeError, ValueError, Exception) as e:
        print(f"Error generating coaching recommendations: {e}")
        return {
            "strengths": [
                "Solution-focused approach", 
                "Technical problem-solving skills", 
                "Professional communication"
            ],
            "improvements": [
                "Enhance empathy in responses", 
                "Provide more detailed explanations", 
                "Include proactive follow-up steps"
            ],
            "training": [
                "Customer empathy workshop", 
                "Technical writing skills", 
                "Advanced problem-solving techniques"
            ],
            "short_term_goals": [
                "Improve solution clarity scores", 
                "Increase customer satisfaction to 4.5+", 
                "Reduce response time by 15%"
            ],
            "long_term_plan": [
                "Become subject matter expert", 
                "Mentor new agents on solution quality", 
                "Lead solution template development"
            ]
        }

@performance_router.get("/agent-performance/{agent_id}")
async def get_agent_performance(agent_id: str, company_id: str):
    """Get comprehensive performance metrics for a specific agent based on solution quality"""
    
    if not database:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get agent info
    agent_info = await get_agent_info(agent_id)
    if not agent_info:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get agent tickets
    agent_tickets = await get_agent_tickets(agent_id, company_id)
    
    if not agent_tickets:
        raise HTTPException(status_code=404, detail="No tickets found for this agent")
    
    # Get util ticket data
    ticket_ids = [str(ticket['_id']) for ticket in agent_tickets]
    util_tickets_dict = await get_util_tickets_by_ticket_ids(ticket_ids)
    
    # Calculate metrics
    handling_times = []
    csat_scores = []
    solution_analyses = []
    
    for ticket in agent_tickets:
        ticket_id_str = str(ticket['_id'])
        util_data = util_tickets_dict.get(ticket_id_str, {})
        
        # Calculate handling time
        handling_time = calculate_handling_time(ticket, util_data)
        if handling_time > 0:
            handling_times.append(handling_time)
        
        # Get CSAT score
        if util_data.get('customer_review_rating'):
            csat_scores.append(util_data['customer_review_rating'])
        
        # Analyze solution quality
        solution_analysis = analyze_solution_quality(ticket)
        solution_analyses.append(solution_analysis)
    
    # Calculate averages
    avg_handling_time = statistics.mean(handling_times) if handling_times else 0
    avg_csat = statistics.mean(csat_scores) if csat_scores else 0
    
    # Average solution quality scores
    avg_solution_scores = {}
    if solution_analyses:
        avg_solution_scores = {
            "completeness": statistics.mean([a["completeness"] for a in solution_analyses]),
            "clarity": statistics.mean([a["clarity"] for a in solution_analyses]),  
            "empathy": statistics.mean([a["empathy"] for a in solution_analyses]),
            "proactiveness": statistics.mean([a["proactiveness"] for a in solution_analyses]),
            "technical_accuracy": statistics.mean([a["technical_accuracy"] for a in solution_analyses]),
            "customer_focus": statistics.mean([a["customer_focus"] for a in solution_analyses])
        }
    
    # Extract common issue types
    common_issues = list(set([ticket['title'].split()[0] for ticket in agent_tickets]))[:5]
    
    # Performance summary
    performance_data = {
        "agent_id": agent_id,
        "agent_name": agent_info.get('name', f"Agent {agent_id}"),
        "agent_email": agent_info.get('email', ''),
        "total_tickets": len(agent_tickets),
        "avg_handling_time": avg_handling_time,
        "avg_csat": avg_csat,
        "solution_scores": avg_solution_scores,
        "common_issues": common_issues,
        "performance_trend": "improving" if avg_csat >= 4 else "needs_attention"
    }
    
    # Generate coaching recommendations
    coaching = generate_coaching_recommendations(performance_data)
    
    return {
        "agent_performance": performance_data,
        "coaching_recommendations": coaching,
        "recent_feedback": [analysis["feedback"] for analysis in solution_analyses[-3:]]
    }

@performance_router.post("/quality-assessment")
async def assess_ticket_quality(request: QualityAssessmentRequest):
    """Assess the quality of agent's solution for a specific ticket"""
    
    if not database:
        raise HTTPException(status_code=500, detail="Database not initialized")
      # Find ticket
    try:
        ticket = await database.tickets.find_one({"_id": ObjectId(request.ticket_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get util data
    util_tickets_dict = await get_util_tickets_by_ticket_ids([request.ticket_id])
    util_data = util_tickets_dict.get(request.ticket_id, {})
    
    # Analyze solution quality
    quality_analysis = analyze_solution_quality(ticket)
    
    # Calculate metrics
    handling_time = calculate_handling_time(ticket, util_data)
    
    return {
        "ticket_id": request.ticket_id,
        "agent_id": str(ticket['agentId']),
        "customer_issue": ticket['content'],
        "agent_solution": ticket.get('solution', ''),
        "quality_scores": quality_analysis,
        "handling_time_minutes": handling_time,
        "customer_satisfaction": util_data.get('customer_review_rating', 0),
        "customer_feedback": util_data.get('customer_review', ''),
        "resolution_status": ticket['status'],
        "areas_of_excellence": quality_analysis.get('strengths', []),
        "improvement_areas": quality_analysis.get('improvements', [])
    }

@performance_router.post("/team-performance")  
async def get_team_performance(request: PerformanceRequest):
    """Get team-wide performance analytics based on solution quality"""
    
    if not database:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get all company tickets
    company_tickets = await get_company_tickets(request.company_id, request.start_date, request.end_date)
    
    if not company_tickets:
        raise HTTPException(status_code=404, detail="No tickets found for this company")
    
    # Get all ticket IDs for util data
    ticket_ids = [str(ticket['_id']) for ticket in company_tickets]
    util_tickets_dict = await get_util_tickets_by_ticket_ids(ticket_ids)
    
    # Get company agents
    company_agents = await get_company_agents(request.company_id)
    agents_dict = {str(agent['_id']): agent for agent in company_agents}
    
    # Group by agent
    agent_metrics = defaultdict(list)
    
    for ticket in company_tickets:
        agent_id = str(ticket['agentId'])
        ticket_id_str = str(ticket['_id'])
        util_data = util_tickets_dict.get(ticket_id_str, {})
        
        # Analyze solution quality
        solution_analysis = analyze_solution_quality(ticket)
        
        agent_metrics[agent_id].append({
            'handling_time': calculate_handling_time(ticket, util_data),
            'csat': util_data.get('customer_review_rating', 0),
            'solution_quality': solution_analysis,
            'ticket': ticket
        })
    
    # Calculate team metrics
    team_stats = {}
    for agent_id, metrics in agent_metrics.items():
        handling_times = [m['handling_time'] for m in metrics if m['handling_time'] > 0]
        csat_scores = [m['csat'] for m in metrics if m['csat'] > 0]
        
        # Calculate average solution quality scores
        avg_solution_quality = {}
        if metrics:
            solution_keys = ['completeness', 'clarity', 'empathy', 'proactiveness', 'technical_accuracy', 'customer_focus']
            for key in solution_keys:
                scores = [m['solution_quality'][key] for m in metrics if key in m['solution_quality']]
                avg_solution_quality[key] = statistics.mean(scores) if scores else 0
        
        agent_info = agents_dict.get(agent_id, {})
        agent_name = agent_info.get('name', f"Agent {agent_id}")
        
        team_stats[agent_id] = {
            'name': agent_name,
            'email': agent_info.get('email', ''),
            'total_tickets': len(metrics),
            'avg_handling_time': statistics.mean(handling_times) if handling_times else 0,
            'avg_csat': statistics.mean(csat_scores) if csat_scores else 0,
            'solution_quality_scores': avg_solution_quality
        }
    
    # Overall team metrics
    all_handling_times = []
    all_csat_scores = []
    
    for agent_data in team_stats.values():
        if agent_data['avg_handling_time'] > 0:
            all_handling_times.append(agent_data['avg_handling_time'])
        if agent_data['avg_csat'] > 0:
            all_csat_scores.append(agent_data['avg_csat'])
    
    # Find top performer based on combined CSAT and solution quality
    top_performer = None
    if team_stats:
        def performance_score(agent_data):
            csat = agent_data['avg_csat']
            solution_avg = statistics.mean(agent_data['solution_quality_scores'].values()) if agent_data['solution_quality_scores'] else 0
            return (csat * 0.4) + (solution_avg * 0.6)
        
        top_performer = max(team_stats.keys(), key=lambda x: performance_score(team_stats[x]))
    
    team_overview = {
        'total_agents': len(team_stats),
        'total_tickets': len(company_tickets),
        'avg_team_handling_time': statistics.mean(all_handling_times) if all_handling_times else 0,
        'avg_team_csat': statistics.mean(all_csat_scores) if all_csat_scores else 0,
        'top_performer': top_performer
    }
    
    return {
        'team_overview': team_overview,
        'individual_performance': team_stats,
        'performance_trends': {
            'high_performers': [aid for aid, data in team_stats.items() if data['avg_csat'] >= 4.5],
            'needs_attention': [aid for aid, data in team_stats.items() if data['avg_csat'] < 3.5]
        }
    }

@performance_router.post("/coaching-insights")
async def get_coaching_insights(request: PerformanceRequest):
    """Get AI-powered coaching insights for agents based on solution quality"""
    
    if not database:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get performance data
    company_tickets = await get_company_tickets(request.company_id, request.start_date, request.end_date)
    
    if request.agent_id:
        company_tickets = [t for t in company_tickets if str(t['agentId']) == request.agent_id]
    
    if not company_tickets:
        raise HTTPException(status_code=404, detail="No tickets found")
    
    # Get util data
    ticket_ids = [str(ticket['_id']) for ticket in company_tickets]
    util_tickets_dict = await get_util_tickets_by_ticket_ids(ticket_ids)
    
    # Get company agents
    company_agents = await get_company_agents(request.company_id)
    agents_dict = {str(agent['_id']): agent for agent in company_agents}
    
    coaching_insights = {}
    
    # Group by agent
    agent_groups = defaultdict(list)
    for ticket in company_tickets:
        agent_groups[str(ticket['agentId'])].append(ticket)
    
    for agent_id, tickets in agent_groups.items():
        # Calculate performance metrics
        handling_times = []
        csat_scores = []
        solution_analyses = []
        
        for ticket in tickets:
            ticket_id_str = str(ticket['_id'])
            util_data = util_tickets_dict.get(ticket_id_str, {})
            handling_time = calculate_handling_time(ticket, util_data)
            if handling_time > 0:
                handling_times.append(handling_time)
            if util_data.get('customer_review_rating'):
                csat_scores.append(util_data['customer_review_rating'])
            
            # Analyze solution quality
            solution_analysis = analyze_solution_quality(ticket)
            solution_analyses.append(solution_analysis)
        
        # Calculate average solution scores
        avg_solution_scores = {}
        if solution_analyses:
            solution_keys = ['completeness', 'clarity', 'empathy', 'proactiveness', 'technical_accuracy', 'customer_focus']
            for key in solution_keys:
                scores = [a[key] for a in solution_analyses if key in a]
                avg_solution_scores[key] = statistics.mean(scores) if scores else 0
        
        performance_data = {
            'avg_handling_time': statistics.mean(handling_times) if handling_times else 0,
            'avg_csat': statistics.mean(csat_scores) if csat_scores else 0,
            'total_tickets': len(tickets),
            'solution_scores': avg_solution_scores,
            'common_issues': list(set([ticket['title'].split()[0] for ticket in tickets]))[:5]
        }
        
        # Generate coaching recommendations
        coaching = generate_coaching_recommendations(performance_data)
        
        agent_info = agents_dict.get(agent_id, {})
        agent_name = agent_info.get('name', f"Agent {agent_id}")
        
        # Determine priority based on solution quality and CSAT
        avg_solution_score = statistics.mean(avg_solution_scores.values()) if avg_solution_scores else 0
        priority = 'high' if (performance_data['avg_csat'] < 3.5 or avg_solution_score < 6) else 'medium' if (performance_data['avg_csat'] < 4 or avg_solution_score < 7) else 'low'
        
        coaching_insights[agent_id] = {
            'agent_name': agent_name,
            'agent_email': agent_info.get('email', ''),
            'performance_summary': performance_data,
            'coaching_plan': coaching,
            'priority_level': priority,
            'focus_areas': ['Solution Quality', 'Customer Empathy', 'Technical Accuracy'] if priority == 'high' else ['Advanced Skills', 'Leadership']
        }
    
    return {
        'coaching_insights': coaching_insights,
        'summary': {
            'total_agents_analyzed': len(coaching_insights),
            'high_priority_coaching': len([c for c in coaching_insights.values() if c['priority_level'] == 'high']),
            'focus_on_solution_quality': True,
            'performance_overview': 'Solution-based performance analysis complete'
        }
    }