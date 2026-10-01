# Real-Time Support Ticket Classification System -- Automated customer support routing

## Problem
  Manual triaging of support tickets caused 20-minute average response delays. Built an automated routing system to classify tickets and assign correct team in real time.

## System Overview
  - Ingested tickets from Zendesk API (streaming webhook)
  - 1.2M historical tickets used for training
  - Handled class imbalance using focal loss and weighted sampling
  - Real-time inference via REST API (<120ms)

## Engineering and Deployment
  - FastAPI inference service
  - Dockerized and deployed on AWS ECS
  - Redis caching of repeated queries
  - Asynchronous queue using RabbitMQ
  - GitHub Actions CI/CD pipeline
  - Canary deployment with model versioning
  
## Monitoring
  - Prometheus + Grafana metrics
  - Drift detection using KL divergence
  - Automatic retraining triggered weekly

## Results
  - 20 min -> 3 min first response time
  - 65% reduction in manual routing
  - 89% macro F1 score
  - 110ms average latency at 50 RPS

### Tech Stack
Python, PyTorch, HuggingFace, FastAPI, Docker, AWS ECS, Redis, RabbitMQ, PostgreSQL, Prometheus
