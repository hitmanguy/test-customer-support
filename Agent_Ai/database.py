"""
Database module for centralized MongoDB access
"""
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Dict, List, Optional, Any

# Global MongoDB variables
mongodb_client = None
database = None

def initialize_mongodb(mongo_url: str, db_name: str):
    """Initialize MongoDB connection for all modules"""
    global mongodb_client, database
    mongodb_client = AsyncIOMotorClient(mongo_url)
    database = mongodb_client[db_name]
    return database

def get_db():
    """Get database instance"""
    return database

def get_client():
    """Get MongoDB client"""
    return mongodb_client

async def close_mongodb_connection():
    """Close MongoDB connection"""
    if mongodb_client:
        mongodb_client.close()

# Utility functions for database operations
async def find_one(collection: str, query: Dict) -> Optional[Dict]:
    """Wrapper for MongoDB find_one operation"""
    if not database:
        raise ValueError("Database not initialized")
    return await database[collection].find_one(query)

async def find_many(collection: str, query: Dict, limit: Optional[int] = None) -> List[Dict]:
    """Wrapper for MongoDB find operation"""
    if not database:
        raise ValueError("Database not initialized")
    cursor = database[collection].find(query)
    if limit:
        cursor = cursor.limit(limit)
    return await cursor.to_list(length=limit)

async def insert_one(collection: str, document: Dict) -> str:
    """Wrapper for MongoDB insert_one operation"""
    if not database:
        raise ValueError("Database not initialized")
    result = await database[collection].insert_one(document)
    return str(result.inserted_id)

async def update_one(collection: str, query: Dict, update: Dict, upsert: bool = False) -> int:
    """Wrapper for MongoDB update_one operation"""
    if not database:
        raise ValueError("Database not initialized")
    result = await database[collection].update_one(query, update, upsert=upsert)
    return result.modified_count

async def count_documents(collection: str, query: Dict) -> int:
    """Wrapper for MongoDB count_documents operation"""
    if not database:
        raise ValueError("Database not initialized")
    return await database[collection].count_documents(query)

async def aggregate(collection: str, pipeline: List[Dict], limit: Optional[int] = None) -> List[Dict]:
    """Wrapper for MongoDB aggregate operation"""
    if not database:
        raise ValueError("Database not initialized")
    cursor = database[collection].aggregate(pipeline)
    return await cursor.to_list(length=limit)

def safe_object_id(id_str: str) -> Optional[ObjectId]:
    """Safely convert string to ObjectId"""
    try:
        return ObjectId(id_str)
    except:
        return None
