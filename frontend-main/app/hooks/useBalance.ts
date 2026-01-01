"use client";

import { useEffect, useState, useRef } from "react";
import { getBalances } from "../helper/fetch";
import { User } from "./useUser";

export interface Balance {
    user_id: string;
    asset_id: number;
    available: string;
    locked: string;
    symbol: string;
    decimals: number;
}

export function useBalance(user: User | null, market: string) {
    const [balances, setBalances] = useState<Balance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const [baseAsset, quoteAsset] = market.split("_");

    const fetchBalances = async () => {
        if (!user) {
            setBalances([]);
            setLoading(false);
            return;
        }

        try {
            const response = await getBalances(user.id);
            if (response.data?.balances) {
                setBalances(response.data.balances);
            }
            setError(null);
        } catch (e) {
            console.error("Error fetching balances:", e);
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchBalances();

        // Set up polling every 2 seconds
        intervalRef.current = setInterval(() => {
            fetchBalances();
        }, 2000);

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [user?.id, market]);

    // Helper function to get balance for a specific asset
    const getBalanceForAsset = (symbol: string): Balance | null => {
        return balances.find(b => b.symbol === symbol) || null;
    };

    // Get formatted balance string
    const getFormattedBalance = (symbol: string): string => {
        const balance = getBalanceForAsset(symbol);
        if (!balance) return "0.00";
        return parseFloat(balance.available).toFixed(2);
    };

    return {
        balances,
        loading,
        error,
        getBalanceForAsset,
        getFormattedBalance,
        refresh: fetchBalances,
        baseAsset,
        quoteAsset
    };
}
