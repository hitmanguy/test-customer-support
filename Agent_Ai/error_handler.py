from fastapi import HTTPException
from bson import ObjectId, errors as bson_errors

def safe_object_id(id_str):
    """Convert string to ObjectId safely, return None if invalid"""
    try:
        return ObjectId(id_str)
    except (bson_errors.InvalidId, TypeError):
        return None

def validate_object_id(id_str, entity_name="item"):
    """Validate that a string is a valid MongoDB ObjectId, raise HTTPException if not"""
    try:
        return ObjectId(id_str)
    except (bson_errors.InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {entity_name} ID format")

def handle_db_error(error, operation="database operation"):
    """Handle database errors with appropriate HTTP exceptions"""
    # Log the error for debugging
    print(f"Database error during {operation}: {str(error)}")
    
    # Return a user-friendly error message
    raise HTTPException(
        status_code=500,
        detail=f"Database error occurred during {operation}. Please try again later."
    )
