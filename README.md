# BehaviorAI: Your Virtual Interview Coach
[tests]

**BehaviorAI** is an AI-powered web platform designed to help job seekers practice, analyze, and perfect their performance in asynchronous, one-way video interviews (such as HireVue). 

By simulating the high-pressure environment of timed virtual interviews, BehaviorAI records candidate responses and provides immediate, actionable feedback on both the content of their answers and their delivery mechanics.

## Key Features

* **Authentic Interview Simulation:** Practice with timed countdowns, auto-recording, and no-redo constraints to mimic the exact feel of a real HireVue interview.
* **STAR Method Analysis:** The application transcribes your response and highlights where you successfully hit the Situation, Task, Action, and Result components of a strong behavioral answer.
* **Delivery & Presence Metrics:** Get instant feedback on your pacing, filler word usage ("um," "like"), tone, and eye contact consistency.

## Tech Stack
[![Deploy with Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black.svg)](https://vercel.com/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E.svg)](https://supabase.com/)
[![Infrastructure: Oracle Cloud](https://img.shields.io/badge/Compute-Oracle_VM-F80000.svg)](https://www.oracle.com/cloud/)

| Domain | Technologies Used |
|---|---|
| **Frontend** | React, Next.js |
| **Backend** | Node.js, Express, Python, FastAPI |
| **Database** | PostgreSQL |
| **AI / Machine Learning** | OpenAI Whisper (Transcription), Groq (Content Analysis), Gemini (Question Generation), OpenCV (Eye tracking) |

## Prerequisites
[![Node.js Version](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![Python 3.12+](https://img.shields.io/badge/python-3.12.6-blue.svg)](https://www.python.org/downloads/)
* A Supabase project (Database, Auth, and Storage enabled)
* A valid API Key for OpenAI and groq