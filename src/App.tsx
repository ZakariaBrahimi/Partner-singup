import { Navigate, Route, Routes } from 'react-router-dom'
import { FixResubmit } from '@/portal/FixResubmit'
import { Helper } from '@/portal/Helper'
import { Login } from '@/portal/Login'
import { NoLegalStatus } from '@/portal/NoLegalStatus'
import { SignupProvider } from '@/portal/SignupContext'
import { StatusPage } from '@/portal/StatusPage'
import { StepPage } from '@/portal/DynamicStep'
import { Submitted } from '@/portal/Submitted'
import { TypeStep } from '@/portal/TypeStep'

export function AppRoutes() {
  return (
    <SignupProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<TypeStep />} />
        <Route path="/signup/helper" element={<Helper />} />
        <Route path="/signup/no-legal-status" element={<NoLegalStatus />} />
        <Route path="/signup/submitted" element={<Submitted />} />
        <Route path="/signup/:stepId" element={<StepPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/status/fix" element={<FixResubmit />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </SignupProvider>
  )
}

export default function App() {
  return <AppRoutes />
}
