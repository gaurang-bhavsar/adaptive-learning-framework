# Adaptive Learning Graph (ALG) — v3.0

An AI-powered adaptive learning platform that generates personalized, multi-level learning roadmaps (Phases → Topics → Steps) for any subject using Gemini, curates verified resources, and adapts dynamically using custom generated tests and confidence calibration tracking.

---

## Key Features

1. **Recursive Roadmap Generation**: Generates deep learning paths tailored to your experience.
2. **Resilient Dual-Mode AI Provider**: Support for both native Google Gemini API keys and OpenRouter API keys (automatically routes `sk-or-` tokens to HTTP endpoints).
3. **Structured Flow Layout**: Built with React Flow using clean Bezier curve connectors and progressive level separation.
4. **Adaptive Test Engine**: Generates customized tests for each step and classifies answers into *Mastered*, *Uncertain*, *Misconception*, or *Learning*.
5. **Confidence Calibration**: Compares upfront self-reported confidence predictions against actual test outcomes to report Calibration states (*Well-calibrated*, *Overconfident*, *Underconfident*).
6. **Graceful Quota Fallback**: If API key quota or credit limits are hit, the application automatically falls back to an offline mock generator so you can still explore and use the full layout and features.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

---

### 1. Running the Backend (FastAPI)

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   venv\Scripts\activate   # On Windows
   source venv/bin/activate # On Unix/macOS
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables. Create a `.env` file inside the `backend` folder:
   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=8000
   ```
   *Note: If using OpenRouter, your token should start with `sk-or-`.*

5. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will be running at `http://localhost:8000`.

---

### 2. Running the Frontend (Next.js)

1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to **`http://localhost:3000`** to start using the application.

---

### 3. Running with Docker (Alternative)

If you prefer to run the entire project in containerized mode (e.g., for production deployment or clean local execution), you can use Docker Compose.

1. Ensure Docker is installed and running on your system.
2. In the root directory of the project, run:
   ```bash
   docker-compose up --build
   ```
   This will automatically:
   - Build the backend container exposing port `8000` (loading settings from your `./backend/.env` file).
   - Build the frontend container exposing port `3000`.
3. Open your browser and navigate to **`http://localhost:3000`**.
