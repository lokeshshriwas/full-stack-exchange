"use client";

import { useEffect, useState } from "react";
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
        // Initial fetch from DB on mount
        fetchBalances();

        if (!user) return;

        const { SignalingManager } = require('../utils/SignalingManager');
        const signalingManager = SignalingManager.getInstance();

        // Setup balance listener - ONLY BALANCE_UPDATE from Redis
        const setupBalanceListeners = () => {
            const userId = signalingManager.getAuthenticatedUserId();
            if (!userId) return;

            // ✅ BALANCE_UPDATE: Real-time updates from Engine (Redis)
            // Published after every balance change: order placement, fills, cancellations
            signalingManager.registerCallback(
                'BALANCE_UPDATE',
                (data: any) => {
                    const payload = data.payload;

                    setBalances((prev) => {
                        const updated = [...prev];
                        const index = updated.findIndex(b => b.symbol === payload.asset);

                        if (index !== -1) {
                            // Update existing asset balance
                            updated[index] = {
                                ...updated[index],
                                available: payload.available,
                                locked: payload.locked
                            };
                        } else {
                            // Add new asset (rare, but handle it)
                            updated.push({
                                user_id: user.id || "",
                                asset_id: 0,
                                symbol: payload.asset,
                                available: payload.available,
                                locked: payload.locked,
                                decimals: 8
                            });
                        }

                        return updated;
                    });
                },
                `balance-update-${user.id}`
            );

            // Subscribe to balance WebSocket channel
            if (signalingManager.isAuthenticated()) {
                signalingManager.sendMessage({
                    method: 'SUBSCRIBE',
                    params: [`balances:user:${userId}`]
                });
            }
        };

        // Set up listeners if already authenticated, or wait for auth
        if (signalingManager.isAuthenticated()) {
            setupBalanceListeners();
        } else {
            signalingManager.registerCallback(
                'auth_success',
                setupBalanceListeners,
                `balance-auth-${user.id}`
            );
        }

        // Cleanup on unmount
        return () => {
            const userId = signalingManager.getAuthenticatedUserId();
            if (userId) {
                signalingManager.sendMessage({
                    method: 'UNSUBSCRIBE',
                    params: [`balances:user:${userId}`]
                });
            }
            signalingManager.deRegisterCallback('BALANCE_UPDATE', `balance-update-${user.id}`);
            signalingManager.deRegisterCallback('auth_success', `balance-auth-${user.id}`);
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
        getBalanceForAsset,  // Expose this for validation
        getFormattedBalance,
        refresh: fetchBalances,
        baseAsset,
        quoteAsset
    };
}
