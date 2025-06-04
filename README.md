# AI-Powered Customer Support System

An advanced customer support platform that utilizes artificial intelligence to enhance customer service operations. This system integrates a Next.js frontend, NestJS backend, and Python FastAPI microservice to provide a seamless, intelligent support solution.

## 🌟 Key Features

- **AI-Powered Customer Chatbot**: Automated, intelligent responses to customer inquiries
- **Smart Ticket Management**: Automated ticket creation, prioritization, and routing
- **Knowledge Base Integration**: Contextual responses based on company knowledge
- **Agent Assistance Tools**: AI-powered suggestions to help support agents
- **Performance Monitoring**: Track system performance and AI accuracy
- **Ticket Analytics**: Priority assessment and similar ticket identification
- **Conversation History**: Track and analyze customer interactions

## 🔧 Tech Stack

### Frontend
- **Next.js**: React framework for building the user interface
- **Material UI**: Component library for modern design
- **TypeScript**: Type-safe JavaScript
- **tRPC Client**: Type-safe API communication
- **Framer Motion**: Animation library
- **Tanstack Query**: Data fetching and caching

### Backend
- **NestJS**: Progressive Node.js framework for building efficient server-side applications
- **TypeScript**: Type-safe JavaScript
- **tRPC**: End-to-end typesafe API layer
- **Mongoose**: MongoDB object modeling for Node.js
- **JWT**: Authentication and authorization

### AI Microservice
- **FastAPI**: Modern Python web framework for building APIs
- **LangChain**: Framework for LLM applications
- **Google Gemini**: AI model for natural language processing
- **Pinecone**: Vector database for semantic search
- **scikit-learn**: Machine learning library
- **Sentence Transformers**: Text embedding models

### Database
- **MongoDB**: NoSQL database for storing application data
- **Pinecone**: Vector database for storing embeddings and similarity search

## 📋 Prerequisites

- Node.js 18+ and pnpm
- Python 3.9+
- MongoDB instance
- Pinecone account
- Google Gemini API key

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd test-customer-support
```

### 2. Install Dependencies

#### Backend and Frontend (Node.js)
```bash
pnpm install
```

#### AI Microservice (Python)
```bash
cd Agent_Ai
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3000
PYTHON_AI_SERVICE_URL=http://localhost:8000

# Database Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=flipr

# AI Services
PINECONE_API_KEY=<your-pinecone-api-key>
PINECONE_INDEX_NAME=llama-text-embed-v2-index
PINECONE_NAMESPACE=ns3
GOOGLE_GEMINI_API_KEY=<your-google-gemini-api-key>
```

#### Environment Variables Explained

| Variable | Description |
|----------|-------------|
| `PORT` | Port on which the NestJS server will run |
| `PYTHON_AI_SERVICE_URL` | URL to the Python FastAPI microservice |
| `MONGODB_URL` | Connection string to your MongoDB instance |
| `DATABASE_NAME` | Name of the database to use |
| `PINECONE_API_KEY` | API key for Pinecone vector database |
| `PINECONE_INDEX_NAME` | Name of your Pinecone index |
| `PINECONE_NAMESPACE` | Namespace to use in Pinecone |
| `GOOGLE_GEMINI_API_KEY` | API key for Google Gemini AI model |

## 🚀 Running the Application

### 1. Start the Python AI Microservice

```bash
cd Agent_Ai
uvicorn main:app --reload --port 8000
```

### 2. Start the NestJS Backend

```bash
cd apps/server
pnpm run start:dev
```

### 3. Start the Next.js Frontend

```bash
cd apps/web
pnpm run dev
```

## 🔄 System Workflow

1. **Customer Interaction**: 
   - Customer initiates a chat through the web interface
   - AI chatbot processes and responds to customer queries

2. **Ticket Management**:
   - AI determines when a ticket should be created
   - System automatically assigns tickets to agents
   - AI analyzes ticket priority and suggests solutions

3. **Agent Support**:
   - Agents receive AI-powered suggestions for ticket resolution
   - System provides contextual information from knowledge base
   - AI assists in finding similar tickets for reference

4. **Performance Analysis**:
   - System tracks response times and AI effectiveness
   - Provides analytics on ticket resolution efficiency
   - Monitors AI model performance

## 🌐 API Documentation

### Python AI Microservice Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/customer-chat/respond` | POST | Process a customer message and return an AI response |
| `/customer-chat/clear-memory` | POST | Clear conversation memory for a session |
| `/customer-chat/get-summary` | POST | Get conversation summary for a session |
| `/agent-assist-chat` | POST | Get AI assistance for support agents |
| `/analyze-ticket` | POST | Analyze a support ticket using AI |

### NestJS Backend

The NestJS backend uses tRPC for API communication, providing type-safe procedures for:
- User authentication
- Chat management
- Ticket handling
- AI integration
- Knowledge base access
- Analytics

## 🏗️ Architecture Diagram

```
┌───────────┐           ┌───────────┐           ┌───────────┐
│  Next.js  │◄─────────►│  NestJS   │◄─────────►│  Python   │
│ Frontend  │   tRPC    │ Backend   │   HTTP    │Microservice│
└───────────┘           └───────────┘           └───────────┘
                              │                       │
                              │                       │
                              ▼                       ▼
                        ┌───────────┐           ┌───────────┐
                        │  MongoDB  │           │ Pinecone  │
                        │ Database  │           │ Vector DB │
                        └───────────┘           └───────────┘
```

## 🧠 How the AI Works

1. **Customer Messages Processing**:
   - Customer messages are sent to the AI microservice
   - The system retrieves relevant knowledge base articles using vector similarity search
   - AI generates contextually appropriate responses using Google Gemini

2. **Ticket Analysis**:
   - System extracts key information from tickets
   - AI determines ticket priority based on content analysis
   - Identifies similar past tickets for reference
   - Generates suggested solutions based on historical data

3. **Agent Assistance**:
   - Provides real-time suggestions to agents based on ticket content
   - Summarizes customer conversations for quick review
   - Offers knowledge base articles relevant to the current ticket

## 📊 Dashboard Features

- **Agent Dashboard**: View and manage assigned tickets with AI insights
- **Analytics**: Monitor support performance and key metrics
- **Knowledge Base Management**: Update and maintain support content
- **User Management**: Manage customer and agent accounts

## ⚙️ Production Deployment

For production deployment, consider:

1. **Environment Settings**:
   - Use production-grade MongoDB instance
   - Secure all API keys and connection strings
   - Configure proper CORS and security settings

2. **Scaling**:
   - Use containerization (Docker) for consistent deployment
   - Consider serverless options for the AI microservice
   - Implement proper load balancing for high traffic

3. **Monitoring**:
   - Set up application monitoring tools
   - Implement error tracking and logging
   - Monitor AI performance and retrain models as needed
