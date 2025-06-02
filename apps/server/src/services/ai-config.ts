export const AI_CONFIG = {
  PINECONE: {
    API_KEY: process.env.PINECONE_API_KEY || "pcsk_6huYPr_DJ1sQeb1hTAHfJ7B2gkSpksssvi76qJDJEGUfpVfUMB41kictgkvQqLUw62Jmsi",
    INDEX_NAME: process.env.PINECONE_INDEX_NAME || "llama-text-embed-v2-index",
    NAMESPACE: process.env.PINECONE_NAMESPACE || "ns3",
  },
  GOOGLE: {
    API_KEY: process.env.GOOGLE_GEMINI_API_KEY || "AIzaSyB4ETamANiKg2srzulKrfW37eF2SlxtyLw",
    MODEL: "gemini-2.0-flash",
    TEMPERATURE: 0.3,
  },
  CHAT: {
    MAX_HISTORY: 10,
    RECENT_HISTORY: 5,
    TOP_K_RESULTS: 10,
    MAX_CONTEXT_CHUNKS: 5,
  },
  TICKET: {
    HELP_INDICATORS: [
      'problem', 'issue', 'error', 'broken', 'not working', 'help',
      'complaint', 'refund', 'cancel', 'billing', 'account',
      'urgent', 'emergency', 'frustrated', 'angry', 'bug',
      'support', 'assistance', 'trouble', 'difficulty'
    ]
  }
};

export const EMBEDDING_CONFIG = {
  DIMENSION: 1536, // Standard embedding dimension
  NORMALIZATION: true,
  SIMPLE_HASH_MULTIPLIER: 31,
};
