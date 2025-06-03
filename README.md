# AI Customer Support System with Python Microservice

This project is a customer support system with AI capabilities. It consists of a Next.js frontend, a NestJS backend, and a Python microservice for AI-powered features.

## Architecture

- **Frontend**: Next.js application for user interface
- **Backend**: NestJS API for business logic and data management
- **AI Microservice**: Python FastAPI service for AI-powered features

## Setup & Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd test-customer-support
```

### 2. Install dependencies

#### NestJS & Next.js dependencies
```bash
pnpm install
```

#### Python dependencies
```bash
cd Agent_Ai
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
PYTHON_AI_SERVICE_URL=http://localhost:8000
MONGODB_URL=<your-mongodb-url>
DATABASE_NAME=flipr
PINECONE_API_KEY=<your-pinecone-api-key>
PINECONE_INDEX_NAME=llama-text-embed-v2-index
PINECONE_NAMESPACE=ns3
GOOGLE_GEMINI_API_KEY=<your-google-gemini-api-key>
```

## Running the Application

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

## API Documentation

### Python AI Microservice API Endpoints

- `GET /health`: Health check endpoint
- `POST /customer-chat/respond`: Process a customer message and return an AI response
- `POST /customer-chat/clear-memory`: Clear conversation memory for a session
- `POST /customer-chat/get-summary`: Get conversation summary for a session
- `POST /agent-assist-chat`: Get AI assistance for support agents
- `POST /analyze-ticket`: Analyze a support ticket using AI

### NestJS Backend API Endpoints

The NestJS backend uses tRPC for API communication.

## Features

- AI-powered customer chatbot
- Support ticket creation and management
- Knowledge base integration
- Agent assistance tools
- Performance monitoring

## Architecture Diagram

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
