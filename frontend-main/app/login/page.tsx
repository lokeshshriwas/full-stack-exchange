"use client";

import React, { useState } from "react";
import { FiMail, FiLock } from "react-icons/fi";
import Header from "../components/maincomps/Header";
import Input from "../components/maincomps/Input";
import Checkbox from "../components/maincomps/Checkbox";
import Link from "next/link";
import Button from "../components/maincomps/Button";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );

  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/balance";

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await login(email, password, rememberMe);
      toast.success("Login successful!");
      router.push(redirectTo);
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || "Login failed";
        toast.error(message);
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-base-background p-8 rounded-2xl border border-base-border-light shadow-xl">
          <Header
            title="Welcome back"
            subtitle="Sign in to your account to continue"
          />

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<FiMail />}
              disabled={isSubmitting}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<FiLock />}
              disabled={isSubmitting}
            />

            <div className="flex items-center justify-between">
              <Checkbox
                label="Remember me"
                checked={rememberMe}
                onChange={setRememberMe}
              />
              <Link
                href="/forgot-password"
                className="text-sm text-base-text-med-emphasis hover:text-base-text-high-emphasis"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-base-text-med-emphasis">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-base-text-high-emphasis hover:underline font-medium"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
