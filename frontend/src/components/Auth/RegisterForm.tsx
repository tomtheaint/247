import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Input } from "../UI/Input";
import { Button } from "../UI/Button";
import { useAuthStore } from "../../store/authStore";

interface FormData { email: string; username: string; password: string; displayName: string }

export function RegisterForm() {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await registerUser({ ...data, timezone });
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Registration failed";
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Display Name"
        {...register("displayName")}
        placeholder="Your name"
      />
      <Input
        label="Username"
        {...register("username", { required: "Username is required", minLength: { value: 3, message: "Min 3 chars" } })}
        error={errors.username?.message}
        placeholder="cooluser123"
      />
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
        {...register("password", { required: "Password is required", minLength: { value: 8, message: "Min 8 chars" } })}
        error={errors.password?.message}
        placeholder="••••••••"
      />
      <Button type="submit" loading={isLoading} className="w-full">Create Account</Button>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
      </p>
    </form>
  );
}
