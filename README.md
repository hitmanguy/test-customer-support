
# 🤖 AI-Powered Customer Support & Ticketing Platform

An innovative, programmable customer support platform leveraging state-of-the-art AI to assist both customers and agents across the entire support lifecycle. This system is designed for companies to onboard effortlessly and tailor to their specific products and services.

🌐 **Live Demo:** [https://test-customer-support-web.vercel.app/](https://test-customer-support-web.vercel.app/)

---

## 🚀 Project Overview

### 🧩 Problem Statement

Design and build an **AI-powered customer support and ticketing platform** that automates and enhances support workflows for companies of any scale. AI is integrated throughout the process—from customer queries to deep analytics—delivering a seamless, intelligent support experience.

---

## 🌟 Core Features (at a glance)

- **Customer Chatbot:** Answers user queries using a company-specific knowledge base and escalates when needed.
- **Agent-Assist Copilot:** Helps agents with AI-suggested replies, solution recommendations, and ticket summaries.
- **Smart Ticketing:** Auto-categorizes, prioritizes, and assigns tickets with suggested solutions.
- **Incident Linking:** Detects patterns across tickets to identify broader issues.
- **QA & Coaching:** Analyzes agent chats for politeness, effectiveness, and performance improvement.
- **Operations Dashboards:** Visualizes real-time support metrics and AI-generated summaries.
- **Customer Experience Optimization:** Gauges sentiment, identifies root causes, and proactively suggests support actions.

---

## 🧰 Tech Stack

### 🖥️ Platform

- **Framework:** NestJS (Monorepo)
- **Database:** MongoDB
- **Auth & Email:** Google OAuth + Nodemailer
- **Storage:** Cloudinary
- **Deployment:** Vercel (Frontend)

### 🤖 Agent-Assist AI Bot

- **Backend:** FastAPI + Uvicorn
- **AI Models:**
  - `gemini-2.0-flash` – Google Generative AI
  - `intfloat/e5-large-v2` – Embeddings
  - `bge-reranker-v2-m3` – Search reranker
- **Vector DB:** Pinecone
- **ML Tools:** scikit-learn (TF-IDF, NearestNeighbors)
- **Session Memory:** In-memory
- **Deployment:** Render / Railway

---

## 🧠 AI-Enhanced Modules

### 📊 AI-Driven Operations Summary & Reporting
- **Dashboards:** Real-time views of support metrics (volume, resolution rate, backlog).
- **Automated Summaries:** AI-generated insights on trends, issues, and performance.
- **Predictive Insights (Bonus):** Forecast volumes or highlight potential risks.

### 💬 AI-Driven Customer Experience (CX) Optimization
- **Sentiment Analysis:** Understand customer mood and frustration levels.
- **Root Cause Analysis:** Detect patterns in recurring issues or negative feedback.
- **Proactive Support:** Identify and assist at-risk customers before issues escalate.
- **Knowledge Base Feedback:** Spot outdated or missing info based on real interactions.

---

## 📦 Backend Requirements

> `requirements.txt`

```txt
fastapi
uvicorn
pydantic
langchain
langchain-google-genai
google-generativeai
sentence-transformers
pinecone-client
scikit-learn
pandas
pymongo
python-dotenv
```

---

## 🛠️ Getting Started

### Frontend Setup (NestJS Monorepo)

```bash
pnpm install
pnpm dev
```

### Backend Setup (FastAPI)

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 📁 Project Structure Overview

```
├── frontend/                # NestJS monorepo
├── backend/                 # FastAPI agent assist
├── vector-db/               # Pinecone vector ops
├── database/                # MongoDB schemas
├── .env
├── requirements.txt
└── README.md
```

---

## 🧠 AI Highlights

| Feature                  | Model / Tool Used        |
|--------------------------|--------------------------|
| Ticket summarization     | `gemini-2.0-flash`       |
| Ticket classification    | `gemini-2.0-flash`       |
| Embedding retrieval      | `intfloat/e5-large-v2`   |
| Search reranking         | `bge-reranker-v2-m3`     |
| Recommendations          | TF-IDF + NearestNeighbors|
| Politeness/QA analysis   | `gemini-2.0-flash`       |

---

## 📌 Future Enhancements

- Redis for persistent memory
- Admin dashboard with filterable metrics
- Multi-language model support
- Feedback-based model fine-tuning

---

## 👥 Authors

- Sahil Chauhan - Frontend
- Saarthak Singh – Agent Assist AI
- Gnan Ravi Gowda - Customer support AI

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

https://drive.google.com/drive/folders/1TDBy-9YTVByiFAZsSkxujNAOP3-QTPKg?usp=sharing
🌐 [Live App][https://test-customer-support-web.vercel.app/](https://test-customer-support-web.vercel.app/)
