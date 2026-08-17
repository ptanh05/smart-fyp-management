# Frontend - Project Management System

A modern React + TypeScript frontend for the Django REST Framework backend.

## Features

- **Authentication**: Login for Students, Supervisors, and Committee Members
- **Student Dashboard**: 
  - Find and form groups
  - Create projects
  - Request supervisors
  - Upload documents
  - Chat with supervisors
- **Supervisor Dashboard**:
  - View student requests
  - Manage assigned groups
  - Evaluate projects
- **Committee Member Dashboard**:
  - Manage evaluations
  - Upload templates

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Axios
- JWT Authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure your Django backend is running on `http://localhost:8000`

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   ├── contexts/        # React contexts (Auth)
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── style.css        # Global styles
├── public/              # Static assets
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## API Configuration

The frontend is configured to proxy API requests to `/app` which will be forwarded to `http://localhost:8000/app` by Vite's proxy.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Development Notes

- The app uses JWT tokens stored in localStorage
- Token refresh is handled automatically by the API service
- Protected routes require authentication
- Each user type has a dedicated dashboard with role-specific features
