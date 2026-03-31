# app/main.py
from fastapi import FastAPI
from app.routes import chat

app = FastAPI(title="College Student Assistant Chatbot")

# Include chat routes
app.include_router(chat.router, prefix="/chat")

@app.get("/")
def home():
    return {"message": "Welcome to the College Assistant Chatbot"}