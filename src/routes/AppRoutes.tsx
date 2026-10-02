import { Routes, Route } from "react-router-dom";

import Landing from "../pages/Landing";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import Dashboard from "../pages/Dashboard";
import UploadResume from "../pages/UploadResume";
import InterviewQuestions from "../pages/InterviewQuestions";
import InterviewSetup from "../pages/InterviewSetup";
import InterviewSession from "../pages/InterviewSession";
import InterviewReport from "../pages/InterviewReport";

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (

    <Routes>

      {/* 🌐 Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
            <InterviewSetup />
          </ProtectedRoute>
        }
      />

      <Route
        path="/interview/session/:sessionId"
        element={
          <ProtectedRoute>
            <InterviewSession />
          </ProtectedRoute>
        }
      />

      <Route
        path="/interview/session/:sessionId/report"
        element={
          <ProtectedRoute>
            <InterviewReport />
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
