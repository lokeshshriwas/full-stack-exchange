"use client";
import React, { useState } from "react";
import { FiMail, FiLock } from "react-icons/fi";
import Header from "../components/maincomps/Header";
import Input from "../components/maincomps/Input";
import Checkbox from "../components/maincomps/Checkbox";
import Link from "next/link";
import Button from "../components/maincomps/Button";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (Object.keys(newErrors).length === 0) {
      const response = await axios.post(
        "http://localhost:8080/api/v2/auth/login",
        {
          email,
          password,
        }
      );
      if (response.status === 200) {
        toast("Login successful");
      } else if (response.status === 401) {
        toast("Invalid credentials");
      } else {
        toast("Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-950 p-8 rounded-2xl border border-neutral-900">
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
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<FiLock />}
            />

            <div className="flex items-center justify-between">
              <Checkbox
                label="Remember me"
                checked={rememberMe}
                onChange={setRememberMe}
              />
              <Link href="#">Forgot password?</Link>
            </div>

            <Button type="submit" variant="primary" fullWidth>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-neutral-500">
            Don't have an account?{" "}
            <a
              href="/register"
              className="text-white hover:underline font-medium"
            >
              Register
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-600">
          By continuing, you agree to our{" "}
          <a href="#" className="text-neutral-500 hover:text-neutral-400">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-neutral-500 hover:text-neutral-400">
            Privacy Policy
          </a>
        </p>
      </div>
      <Toaster />
    </div>
  );
}
