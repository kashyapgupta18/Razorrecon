# RazorRecon

RazorRecon is a modern, high-performance financial reconciliation engine built with Next.js and Supabase. It processes thousands of transaction batches through a layered deterministic matching algorithm, visualizing the results in a real-time dashboard.

## Live Demo
You can view and interact with the live application here:
**[https://razorrecon.onrender.com/](https://razorrecon.onrender.com/)**

## Features
- **Deterministic 7-Layer Reconciliation**: Uses exact match, fuzzy matching, and composite split algorithms.
- **Real-Time Websocket Dashboard**: Watch transactions reconcile live.
- **Audit Trails**: Fully auditable tracking for all automated matches and exceptions.
- **Secure Authentication**: Built-in JWT and OTP support using Supabase.

## Tech Stack
- **Frontend**: Next.js 14, React, standard CSS
- **Backend**: Next.js API Routes, Node.js WebSocket Server
- **Database**: PostgreSQL (Supabase) + node-postgres (`pg`)

## Getting Started

### Prerequisites
Make sure you have Node.js 18+ installed on your machine.

### Installation

1. Clone the repository
```bash
git clone https://github.com/kashyapgupta18/Razorrecon.git
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
Create a `.env` file in the root directory based on `.env.example` (or set the Supabase variables if you have them).

4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License
MIT
