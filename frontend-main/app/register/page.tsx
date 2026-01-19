// app/register/page.tsx
"use client";

import React, { useState, Suspense } from "react";
import { FiMail, FiLock, FiUser } from "react-icons/fi";
import Header from "../components/maincomps/Header";
import Input from "../components/maincomps/Input";
import Button from "../components/maincomps/Button";
import PasswordStrength from "../components/maincomps/PasswordStrength";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import Link from "next/link";

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function RegisterForm() {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/balance";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Terms checkbox removed - no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await register(formData.fullName, formData.email, formData.password);
      toast.success("Registration successful!");

      // Small delay to ensure toast displays before navigation (critical in production)
      setTimeout(() => {
        router.push(redirectTo);
      }, 800);
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || "Registration failed";
        toast.error(message);

        // Handle specific error cases
        if (error.response?.status === 409) {
          setErrors((prev) => ({
            ...prev,
            email: "Email already exists",
          }));
        }
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full Name"
        type="text"
        name="fullName"
        placeholder="Enter your full name"
        value={formData.fullName}
        onChange={handleChange}
        error={errors.fullName}
        icon={<FiUser />}
        disabled={isSubmitting}
      />

      <Input
        label="Email"
        type="email"
        name="email"
        placeholder="Enter your email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
        icon={<FiMail />}
        disabled={isSubmitting}
      />

      <div>
        <Input
          label="Password"
          type="password"
          name="password"
          placeholder="Create a password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          icon={<FiLock />}
          disabled={isSubmitting}
        />
        <PasswordStrength password={formData.password} />
      </div>

      <Input
        label="Confirm Password"
        type="password"
        name="confirmPassword"
        placeholder="Confirm your password"
        value={formData.confirmPassword}
        onChange={handleChange}
        error={errors.confirmPassword}
        icon={<FiLock />}
        disabled={isSubmitting}
      />

      <div className="pt-2 mt-4">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}

function RegisterFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-neutral-800 rounded-lg" />
      <div className="h-12 bg-neutral-800 rounded-lg" />
      <div className="h-12 bg-neutral-800 rounded-lg" />
      <div className="h-12 bg-neutral-800 rounded-lg" />
      <div className="h-6 bg-neutral-800 rounded w-3/4 mt-4" />
      <div className="h-6 bg-neutral-800 rounded w-2/3" />
      <div className="h-12 bg-neutral-800 rounded-lg mt-4" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-base-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-base-background p-5 sm:p-8 rounded-2xl border border-base-border-light shadow-xl">
          <Header
            title="Create an account"
            subtitle="Start your journey with us today"
          />

          <Suspense fallback={<RegisterFormSkeleton />}>
            <RegisterForm />
          </Suspense>

          <p className="mt-8 text-center text-sm text-base-text-med-emphasis">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-base-text-high-emphasis hover:underline font-medium"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
