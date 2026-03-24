import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Input } from "../UI/Input";
import { Button } from "../UI/Button";
import { useAuthStore } from "../../store/authStore";

interface FormData { email: string; password: string }

export function LoginForm() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Email"
        type="email"
        {...register("email", { required: "Email is required" })}
        error={errors.email?.message}
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        type="password"
        {...register("password", { required: "Password is required" })}
        error={errors.password?.message}
        placeholder="••••••••"
      />
      <Button type="submit" loading={isLoading} className="w-full">Sign In</Button>
      <p className="text-center text-sm text-gray-500">
        No account?{" "}
        <Link to="/register" className="text-brand-600 hover:underline font-medium">Create one</Link>
      </p>
    </form>
  );
}
