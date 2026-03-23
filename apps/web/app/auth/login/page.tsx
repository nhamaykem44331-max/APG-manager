import { LoginForm } from './login-form';
import { Plane } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card Form */}
        <div className="card p-8 bg-card border border-border shadow-sm flex flex-col items-center">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center mb-4">
              <Plane className="w-5 h-5 text-background" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">APG Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">Đăng nhập vào hệ thống</p>
          </div>

          <div className="w-full">
            <LoginForm />
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Tân Phú APG · Thái Nguyên, Việt Nam
          </p>
        </div>
      </div>
    </div>
  );
}

