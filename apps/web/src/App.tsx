import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import HomePage from './pages/home'
import UploadPage from './pages/upload'
import DocumentsPage from './pages/documents'
import { DemoV2Page } from './pages/demo-v2'
import Onboarding from './pages/onboarding'
import ModernDashboard from './pages/modern-dashboard'
import AdminDashboard from './pages/admin-dashboard'
import MetricsDashboard from './pages/metrics-dashboard'
import { Button } from './components/ui/button'
import { FileText, Upload, BarChart3, Settings, Home, Users, Shield, TrendingUp } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function Navigation() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <FileText className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold text-white">PaperFlow Studio</span>
          </Link>
          
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="flex items-center space-x-2">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/upload" className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/documents" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Documentos</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard" className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/demo-v2" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Demo v2.0</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/metrics-dashboard" className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4" />
                <span>Metrics</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin-dashboard" className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/onboarding" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Setup</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Config</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground mb-8">
        Esta página está em desenvolvimento e será disponibilizada em breve.
      </p>
      <Button asChild>
        <Link to="/">Voltar ao Início</Link>
      </Button>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background text-foreground">
          <Navigation />
          
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/dashboard" element={<ModernDashboard />} />
              <Route path="/demo-v2" element={<DemoV2Page />} />
              <Route path="/metrics-dashboard" element={<MetricsDashboard />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/settings" element={<ComingSoon title="Configurações" />} />
              <Route path="*" element={<ComingSoon title="Página não encontrada" />} />
            </Routes>
          </main>
          
          <Toaster position="top-right" />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App