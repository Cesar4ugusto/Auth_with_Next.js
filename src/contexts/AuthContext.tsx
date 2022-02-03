import React, { createContext, ReactNode, useEffect, useState } from "react";
import Router from "next/router";
import { setCookie, parseCookies, destroyCookie } from "nookies";
import { api } from "../services/apiClient";

type User = {
    email: string;
    permissions: string[];
    roles: string[];
};

type SignInCredential = {
    email: string;
    password: string;
};

type AuthContextData = {
    signIn: (credentials: SignInCredential) => Promise<void>;
    signOut: () => void;
    user: User;
    isAuthenticated: boolean;
};

type AuthProviderProps = {
    children: ReactNode;
};

export const AuthContext = createContext({} as AuthContextData);

let authChannel: BroadcastChannel;

export function signOut() {
    destroyCookie(undefined, "nextauth.token");
    destroyCookie(undefined, "nextauth.refreshToken");

    authChannel.postMessage("signOut");

    Router.push("/");
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User>();

    const isAuthenticated = !!user;

    useEffect(() => {
        authChannel = new BroadcastChannel("auth");

        authChannel.onmessage = message => {
            switch (message.data) {
                case "signOut":
                    {
                        signOut();
                    }
                    break;

                default: {
                    break;
                }
            }
        };
    }, []);

    useEffect(() => {
        const { "nextauth.token": token } = parseCookies();

        if (token) {
            api.get("/me")
                .then(response => {
                    const { email, permissions, roles } = response.data;

                    setUser({ email, permissions, roles });
                })
                .catch(() => {
                    signOut();
                });
        }
    }, []);

    async function signIn({ email, password }: SignInCredential) {
        try {
            const response = await api.post("/sessions", {
                email,
                password,
            });

            const { token, refreshToken, permissions, roles } = response.data;

            setCookie(undefined, "nextauth.token", token, {
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: "/",
            });

            setCookie(undefined, "nextauth.refreshToken", refreshToken, {
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: "/",
            });

            setUser({ email, permissions, roles });

            api.defaults.headers["Authorization"] = `Bearer ${token}`;

            Router.push("/dashboard");
        } catch (err) {
            console.log(err);
        }
    }

    return (
        <AuthContext.Provider value={{ signIn, signOut, user, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
}
