import LoginForm from "@/components/login-form"

export default function Home() {
  // In a real app, you would check for authentication here
  // If authenticated, redirect to dashboard
  // For demo purposes, we'll just show the login form

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
