import type { User } from "@/type";
import { fetchData } from "@/lib/fetch-utlis";
import { createContext, useContext, useEffect, useState } from "react";
import { queryClient } from "./react-query-provider";
import { useLocation, useNavigate } from "react-router";
import { publicRoutes } from "@/lib";
import { disconnectChatSocket, getChatSocket } from "@/hooks/use-chat";

interface AuthContextType {
      user: User | null;
      isAuthenticated: boolean;  
      isLoading: boolean;
      login: (data: any) => Promise<void>;
      logout: () => Promise<void>;
      updateUser: (nextUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);  

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
      const [user, setUser] = useState<User | null>(null);
      const [isAuthenticated, setIsAuthenticated] = useState(false);
      const [isLoading, setIsLoading] = useState(false);

      const navigate = useNavigate();
      const currentPath = useLocation().pathname;
      const isPublicRoute = publicRoutes.includes(currentPath);

      useEffect(() => {
            const checkAuth = async () => {
                  setIsLoading(true);
                  const userInfo = localStorage.getItem("user");
                  const token = localStorage.getItem("token");
                  if(userInfo) {
                        const parsed = JSON.parse(userInfo) as User;
                        if (token) {
                              try {
                                    const fresh = await fetchData<{
                                          err: number;
                                          response?: Partial<User>;
                                    }>("/auth/profile");
                                    if (fresh?.err === 0 && fresh?.response) {
                                          const merged = { ...parsed, ...fresh.response } as User;
                                          localStorage.setItem("user", JSON.stringify(merged));
                                          setUser(merged);
                                    } else {
                                          setUser(parsed);
                                    }
                              } catch {
                                    setUser(parsed);
                              }
                        } else {
                              setUser(parsed);
                        }
                        setIsAuthenticated(true);
                        getChatSocket();
                        queryClient.invalidateQueries({
                              queryKey: ["chat-conversations"],
                        });
                  }else{
                        setUser(null);
                        setIsAuthenticated(false);
                        if(!isPublicRoute){
                              navigate("/sign-in");
                        }
                  }
                  setIsLoading(false);
            }
            checkAuth();
      }, []);


      useEffect(() => {
            const handleLogout = () => {
                  logout();
                  navigate("/sign-in");
            }
            window.addEventListener("force-logout", handleLogout);
            return () => window.removeEventListener("force-logout", handleLogout);
      }, []);

      /** Tab khác đăng xuất → token bị xóa: ngắt socket chat để presence cập nhật đúng (tránh vẫn “Online”). */
      useEffect(() => {
            const onStorage = (e: StorageEvent) => {
                  if (e.key !== "token" || e.newValue != null) return;
                  disconnectChatSocket();
                  setUser(null);
                  setIsAuthenticated(false);
                  queryClient.clear();
                  const path = window.location.pathname;
                  if (!publicRoutes.includes(path)) {
                        navigate("/sign-in");
                  }
            };
            window.addEventListener("storage", onStorage);
            return () => window.removeEventListener("storage", onStorage);
      }, [navigate]);


      const login = async (data: any) => {
            try {
                  // Store token and user data
                  localStorage.setItem("token", data.token);
                  const userData = data.response || data.user;
                  localStorage.setItem("user", JSON.stringify(userData));

                  // Update state synchronously first
                  setUser(userData);
                  setIsAuthenticated(true);

                  // Wait a bit for state to update
                  await new Promise(resolve => setTimeout(resolve, 50));

                  // Invalidate all queries to refetch fresh data
                  queryClient.invalidateQueries();
                  
                  // Refetch critical queries
                  const userId = userData?.id;
                  if (userId) {
                        queryClient.invalidateQueries({
                              queryKey: ["workspaces", userId],
                        });
                        queryClient.invalidateQueries({
                              queryKey: ["workspace"],
                        });
                  }

                  // Connect chat socket immediately after login
                  disconnectChatSocket();
                  getChatSocket();
                  queryClient.invalidateQueries({
                        queryKey: ["chat-conversations"],
                  });
            } catch (error) {
                  console.error("Login error:", error);
                  throw error;
            }
      }
      const logout = async () => {
            try {
                  // Clear state first
                  setUser(null);
                  setIsAuthenticated(false);
                  
                  // Clear localStorage
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  disconnectChatSocket();

                  // Clear query cache
                  queryClient.clear();
            } catch (error) {
                  console.error("Logout error:", error);
            }
      }

      const updateUser = (nextUser: User) => {
            localStorage.setItem("user", JSON.stringify(nextUser));
            setUser(nextUser);
      };
      const values = {
            user,
            isAuthenticated,
            isLoading,
            login,
            logout,
            updateUser,
      };

      return (
            <AuthContext.Provider value={values}>
                  {children}
            </AuthContext.Provider>
      )
}

export const useAuth = () => {
      const context = useContext(AuthContext);

      if (!context) {
            throw new Error("useAuth must be used within an AuthProvider");
      }
      return context;
}