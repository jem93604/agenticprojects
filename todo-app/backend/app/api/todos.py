from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.models.database import get_db
from app.models.todo import Todo, Tag
from app.schemas.todo import TodoCreate, TodoUpdate, TodoResponse, TagCreate, TagResponse

router = APIRouter()

@router.get("/", response_model=List[TodoResponse])
async def get_todos(db: Session = Depends(get_db)):
    todos = db.query(Todo).all()
    return todos

@router.post("/", response_model=TodoResponse)
async def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    db_todo = Todo(
        title=todo.title, 
        description=todo.description, 
        completed=todo.completed,
        due_date=todo.due_date,
        parent_id=todo.parent_id
    )
    
    # Add tags if provided
    if todo.tags:
        for tag_data in todo.tags:
            tag = db.query(Tag).filter(Tag.name == tag_data.name).first()
            if not tag:
                tag = Tag(name=tag_data.name, color=tag_data.color)
                db.add(tag)
                db.commit()
                db.refresh(tag)
            db_todo.tags.append(tag)
    
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo

@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: int, todo: TodoUpdate, db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if db_todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    # Update basic fields
    for key, value in todo.dict(exclude_unset=True, exclude={'tags'}).items():
        if value is not None:
            setattr(db_todo, key, value)
    
    # Update tags if provided
    if todo.tags is not None:
        db_todo.tags.clear()
        for tag_data in todo.tags:
            tag = db.query(Tag).filter(Tag.name == tag_data.name).first()
            if not tag:
                tag = Tag(name=tag_data.name, color=tag_data.color)
                db.add(tag)
                db.commit()
                db.refresh(tag)
            db_todo.tags.append(tag)
    
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.delete("/{todo_id}")
async def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    db_todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if db_todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    # Delete subtasks first
    subtasks = db.query(Todo).filter(Todo.parent_id == todo_id).all()
    for subtask in subtasks:
        db.delete(subtask)
    
    db.delete(db_todo)
    db.commit()

# Tag endpoints
@router.get("/tags/", response_model=List[TagResponse])
async def get_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).all()
    return tags

@router.post("/tags/", response_model=TagResponse)
async def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    # Check if tag already exists
    existing_tag = db.query(Tag).filter(Tag.name == tag.name).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    db_tag = Tag(name=tag.name, color=tag.color)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag
    return {"message": "Todo deleted successfully"}