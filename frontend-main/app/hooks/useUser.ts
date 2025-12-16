"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { usePathname } from "next/navigation";
import { BASE_URL } from "../helper/fetch";

export interface User {
    id: string;
    email: string;
    fullName: string;
}

export function useUser() {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `${BASE_URL}/api/v2/auth/me`,
                    { withCredentials: true }
                );

                if (response.data.success) {
                    setUser(response.data.data);
                } else {
                    setUser(null);
                }
            } catch (e) {
                setUser(null);
                setError(e);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [pathname]);

    return { user, loading, error };
}
