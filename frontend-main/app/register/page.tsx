"use client";
import React, { useState } from "react";
import { FiMail, FiLock, FiUser } from "react-icons/fi";
import Header from "../components/maincomps/Header";
import Input from "../components/maincomps/Input";
import Checkbox from "../components/maincomps/Checkbox";
import Button from "../components/maincomps/Button";
import PasswordStrength from "../components/maincomps/PasswordStrength";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";

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
  terms?: string;
}

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

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

    if (!agreeToTerms) {
      newErrors.terms = "You must agree to the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        const response = await axios.post(
          "http://localhost:8080/api/v2/auth/register",
          formData
        );
        if (response.status === 201) {
          toast.success("Registration successful");
        } else if (response.status === 409) {
          toast.error("Email already exists");
        } else {
          toast.error("Something went wrong");
        }
      } catch (error) {
        toast.error("Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-950 p-8 rounded-2xl border border-neutral-900">
          <Header
            title="Create an account"
            subtitle="Start your journey with us today"
          />

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
            />

            <div className="space-y-3 pt-2 mt-4">
              <Checkbox
                label={
                  <span>
                    I agree to the{" "}
                    <a href="#" className="text-white hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-white hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                }
                checked={agreeToTerms}
                onChange={setAgreeToTerms}
                error={errors.terms}
              />

              <Checkbox
                label="Send me product updates and newsletters"
                checked={subscribeNewsletter}
                onChange={setSubscribeNewsletter}
              />
            </div>

            <div className="pt-2 mt-4">
              <Button type="submit" variant="primary" fullWidth>
                Create account
              </Button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <a href="/login" className="text-white hover:underline font-medium">
              Login
            </a>
          </p>
        </div>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
