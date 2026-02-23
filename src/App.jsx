import { Routes, Route, Navigate } from 'react-router-dom'
import Main from '@/app/Main/Main'
import NotFound from '@/app/NotFound'
import AdminLayout from '@/app/admin/layout'
import AdminLoginPage from '@/app/admin/login/page'
import AdminSettingsPage from '@/app/admin/settings/page'
import AdminDynamicPage from '@/app/admin/dynamic/[slug]/page'
import AdminDynamicRecordEditPage from '@/app/admin/dynamic/[slug]/[id]/page'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Main />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="dynamic/:slug/:id" element={<AdminDynamicRecordEditPage />} />
        <Route path="dynamic/:slug" element={<AdminDynamicPage />} />
        <Route path=":slug/:id" element={<AdminDynamicRecordEditPage />} />
        <Route path=":slug" element={<AdminDynamicPage />} />
        <Route index element={<Navigate to="/admin/settings" replace />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
