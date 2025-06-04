"""
Centralized configuration for the AI Microservice
"""
import os

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://hitmansur:D5ZcRgN9zXa7qeNo@discord-bot.bv4504k.mongodb.net/flipr?retryWrites=true&w=majority&appName=discord-bot")
DATABASE_NAME = os.getenv("DATABASE_NAME", "flipr")

# AI Configuration
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

# Embedding model configuration
EMBED_MODEL_NAME = "intfloat/e5-large-v2"
