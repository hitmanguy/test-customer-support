"""
Centralized error handling for the application
"""
from fastapi import HTTPException
from bson import ObjectId, errors as bson_errors
import logging
from typing import Optional

                   
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ErrorHandler")

def safe_object_id(id_str) -> Optional[ObjectId]:
    """Convert string to ObjectId safely, return None if invalid"""
    if not id_str:
        return None
        
    try:
        return ObjectId(id_str)
    except (bson_errors.InvalidId, TypeError) as e:
        logger.warning(f"Invalid ObjectId format: {id_str} - {str(e)}")
        return None

def validate_object_id(id_str, entity_name="item") -> ObjectId:
    """Validate that a string is a valid MongoDB ObjectId, raise HTTPException if not"""
    if not id_str:
        raise HTTPException(status_code=400, detail=f"Missing {entity_name} ID")
        
    try:
        return ObjectId(id_str)
    except (bson_errors.InvalidId, TypeError) as e:
        logger.warning(f"Invalid {entity_name} ID format: {id_str} - {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid {entity_name} ID format")

def handle_db_error(error, operation="database operation") -> None:
    """Handle database errors with appropriate HTTP exceptions"""
                                 
    logger.error(f"Database error during {operation}: {str(error)}")
    
                                     
    if isinstance(error, bson_errors.InvalidId):
        raise HTTPException(status_code=400, detail=f"Invalid ID format in {operation}")
    elif "duplicate key" in str(error).lower():
        raise HTTPException(status_code=409, detail=f"Duplicate key error in {operation}")
    else:
                                
        raise HTTPException(status_code=500, detail=f"Database error during {operation}")
    
                                          
    raise HTTPException(
        status_code=500,
        detail=f"Database error occurred during {operation}. Please try again later."
    )
