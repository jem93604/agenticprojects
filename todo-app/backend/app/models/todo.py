from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.database import Base

# Association table for many-to-many relationship between todos and tags
todo_tags = Table(
    'todo_tags',
    Base.metadata,
    Column('todo_id', Integer, ForeignKey('todos.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    color = Column(String(7), default="#3B82F6")  # Default blue color
    todos = relationship("Todo", secondary=todo_tags, back_populates="tags")

class Todo(Base):
    __tablename__ = "todos"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    completed = Column(Boolean, default=False)
    due_date = Column(DateTime, nullable=True)
    parent_id = Column(Integer, ForeignKey('todos.id'), nullable=True)
    tags = relationship("Tag", secondary=todo_tags, back_populates="todos")
    subtasks = relationship("Todo", backref="parent", remote_side=[id])