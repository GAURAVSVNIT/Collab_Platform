# Collab Platform Frontend

A modern React application for collaboration platform with authentication features.

## Features

- **User Authentication**: Login and signup with email/username
- **File Upload**: Avatar and cover image upload during registration
- **Form Validation**: Comprehensive form validation using React Hook Form
- **Protected Routes**: Secure dashboard accessible only to authenticated users
- **Responsive Design**: Mobile-friendly interface
- **Modern UI**: Beautiful gradient design with smooth animations

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm
- Backend server running on port 8000

### Installation

1. Install dependencies:
```bash
npm install
# or
pnpm install
```

2. Start the development server:
```bash
npm run dev
# or
pnpm dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/
│   └── ProtectedRoute.jsx    # Route protection component
├── contexts/
│   ├── AuthContext.js        # Auth context definition
│   └── AuthContext.jsx       # Auth provider component
├── hooks/
│   └── useAuth.js            # Custom auth hook
├── pages/
│   ├── AuthPages.css         # Shared auth page styles
│   ├── DashboardPage.jsx     # User dashboard
│   ├── DashboardPage.css     # Dashboard styles
│   ├── LoginPage.jsx         # Login page
│   └── SignupPage.jsx        # Registration page
├── services/
│   └── authAPI.js            # API service for authentication
├── App.jsx                   # Main app component with routing
└── main.jsx                  # Application entry point
```

## API Integration

The frontend integrates with the backend API endpoints:

- `POST /api/v1/users/register` - User registration
- `POST /api/v1/users/login` - User login
- `POST /api/v1/users/logout` - User logout
- `GET /api/v1/users/current-user` - Get current user
- `POST /api/v1/users/refresh-token` - Refresh access token

## Authentication Flow

1. **Registration**: Users can sign up with full name, email, username, password, and optional avatar/cover image
2. **Login**: Users can log in using either email or username
3. **Protected Routes**: Dashboard is only accessible to authenticated users
4. **Auto-logout**: Users are automatically redirected to login if session expires

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technologies Used

- React 19
- React Router DOM
- React Hook Form
- Axios
- CSS3 with modern features
- Vite (build tool)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)