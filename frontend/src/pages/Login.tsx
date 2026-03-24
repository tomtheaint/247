import { LoginForm } from "../components/Auth/LoginForm";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-brand-600 items-center justify-center font-bold text-white text-xl mb-3">24</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your 24/7 account</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
