import { Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Dashboard from "../pages/Dashboard";
import UploadResume from "../pages/UploadResume";
import InterviewQuestions from "../pages/InterviewQuestions";
import Interview from "../pages/Interview";

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (

    <Routes>

      {/* 🌐 Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* 🔒 Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <UploadResume />
          </ProtectedRoute>
        }
      />

      <Route
        path="/questions"
        element={
          <ProtectedRoute>
            <InterviewQuestions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/interview"
        element={
          <ProtectedRoute>
            <Interview />
          </ProtectedRoute>
        }
      />

      <Route
        path="/questions/:resumeId"
        element={
          <ProtectedRoute>
            <InterviewQuestions />
          </ProtectedRoute>
        }
      />
    
    </Routes>



  );
}
