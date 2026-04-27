import { useAuth } from "@/_core/hooks/useAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import PageHeader from "@/components/admin/PageHeader";
import AdminNotAllowed from "@/pages/AdminNotAllowed";
import { getLoginUrl } from "@/const";
import { getAdminModulePath } from "@/lib/adminNavigation";
import { trpc } from "@/lib/trpc";
import {
  addAdminChatNote,
  closeAdminChatThread,
  createAdminKbArticle,
  deleteAdminKbArticle,
  getAdminChatAnalytics,
  getAdminChatSettings,
  getAdminChatThread,
  listAdminChatThreads,
  listAdminChatTickets,
  listAdminKbArticles,
  updateAdminChatSettings,
  updateAdminChatTicketStatus,
  updateAdminKbArticle,
} from "@/lib/chatbotApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  ChatSettingsUpdate,
  ChatTicketStatus,
  CreateChatKbArticleInput,
  UpdateChatKbArticleInput,
} from "@shared/chatbot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  Plus,
  Save,
  Search,
  Ticket,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const TOOL_OPTIONS = [
  "searchProducts",
  "getProduct",
  "getOrderStatus",
  "getShippingOptions",
  "getFaqAnswer",
  "createSupportTicket",
] as const;

type ChatbotTab = "chatbot" | "kb" | "inbox" | "tickets" | "analytics";

function parseTags(input: string) {
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

function toCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AdminChatbot() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ChatbotTab>("chatbot");

  const {
    data: permissions,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = trpc.rbac.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const canAccess = Boolean(permissions?.canAccessSettings);

  const [settingsForm, setSettingsForm] = useState<ChatSettingsUpdate>({
    businessName: "SenBonsPlans",
    whatsappNumber: "+221788911010",
    welcomeMessage:
      "Bienvenue chez SenBonsPlans. Je peux vous aider sur les produits, commandes et livraison.",
    primaryColor: "#8f5f68",
    botTone: "luxury_skincare",
    enabledTools: [...TOOL_OPTIONS],
    isEnabled: true,
  });

  const [kbSearch, setKbSearch] = useState("");
  const [kbLocale, setKbLocale] = useState("all");
  const [kbTagFilter, setKbTagFilter] = useState("");
  const [editingKbId, setEditingKbId] = useState<number | null>(null);
  const [kbForm, setKbForm] = useState<CreateChatKbArticleInput>({
    title: "",
    content: "",
    tags: [],
    locale: "fr-SN",
    isPublished: true,
  });

  const [threadSearch, setThreadSearch] = useState("");
  const [threadStatus, setThreadStatus] = useState<"all" | "open" | "closed">("open");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const [ticketStatus, setTicketStatus] = useState<"all" | ChatTicketStatus>("open");

  const settingsQuery = useQuery({
    queryKey: ["admin-chatbot", "settings"],
    queryFn: getAdminChatSettings,
    enabled: canAccess,
  });

  const kbQuery = useQuery({
    queryKey: ["admin-chatbot", "kb", kbSearch, kbLocale, kbTagFilter],
    queryFn: () =>
      listAdminKbArticles({
        q: kbSearch || undefined,
        locale: kbLocale === "all" ? undefined : kbLocale,
        tag: kbTagFilter || undefined,
      }),
    enabled: canAccess,
  });

  const threadsQuery = useQuery({
    queryKey: ["admin-chatbot", "threads", threadSearch, threadStatus],
    queryFn: () =>
      listAdminChatThreads({
        q: threadSearch || undefined,
        status: threadStatus === "all" ? undefined : threadStatus,
      }),
    enabled: canAccess,
    refetchInterval: 15_000,
  });

  const transcriptQuery = useQuery({
    queryKey: ["admin-chatbot", "thread", selectedThreadId],
    queryFn: () => getAdminChatThread(selectedThreadId as number),
    enabled: canAccess && !!selectedThreadId,
  });

  const ticketsQuery = useQuery({
    queryKey: ["admin-chatbot", "tickets", ticketStatus],
    queryFn: () =>
      listAdminChatTickets({
        status: ticketStatus === "all" ? undefined : ticketStatus,
      }),
    enabled: canAccess,
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-chatbot", "analytics"],
    queryFn: getAdminChatAnalytics,
    enabled: canAccess,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingsForm({
      businessName: settingsQuery.data.businessName,
      whatsappNumber: settingsQuery.data.whatsappNumber,
      welcomeMessage: settingsQuery.data.welcomeMessage,
      primaryColor: settingsQuery.data.primaryColor,
      botTone: settingsQuery.data.botTone,
      enabledTools: settingsQuery.data.enabledTools,
      isEnabled: settingsQuery.data.isEnabled,
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!threadsQuery.data?.length) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId) {
      setSelectedThreadId(threadsQuery.data[0].id);
      return;
    }
    if (!threadsQuery.data.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threadsQuery.data[0].id);
    }
  }, [selectedThreadId, threadsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: () => updateAdminChatSettings(settingsForm),
    onSuccess: async () => {
      toast.success("Chatbot settings updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createKbMutation = useMutation({
    mutationFn: createAdminKbArticle,
    onSuccess: async () => {
      toast.success("KB article created");
      setKbForm({
        title: "",
        content: "",
        tags: [],
        locale: "fr-SN",
        isPublished: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "kb"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateKbMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateChatKbArticleInput }) =>
      updateAdminKbArticle(id, payload),
    onSuccess: async () => {
      toast.success("KB article updated");
      setEditingKbId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "kb"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteKbMutation = useMutation({
    mutationFn: deleteAdminKbArticle,
    onSuccess: async () => {
      toast.success("KB article deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "kb"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ threadId, note }: { threadId: number; note: string }) =>
      addAdminChatNote(threadId, note),
    onSuccess: async () => {
      toast.success("Internal note added");
      setNoteInput("");
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "thread"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeThreadMutation = useMutation({
    mutationFn: closeAdminChatThread,
    onSuccess: async () => {
      toast.success("Thread closed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "threads"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "thread"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ticketStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ChatTicketStatus }) =>
      updateAdminChatTicketStatus(id, status),
    onSuccess: async () => {
      toast.success("Ticket status updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-chatbot", "tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const article of kbQuery.data || []) {
      for (const tag of article.tags || []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [kbQuery.data]);

  const transcript = transcriptQuery.data;
  const analytics = analyticsQuery.data;

  const exportTicketsCsv = () => {
    const tickets = ticketsQuery.data || [];
    const rows = tickets.map((ticket) =>
      [ticket.id, ticket.threadId, ticket.status, ticket.phone, ticket.message, ticket.createdAt].map(
        (entry) => toCsvCell(entry)
      )
    );
    const csv = [
      ["ticket_id", "thread_id", "status", "phone", "message", "created_at"].join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "chatbot_tickets.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-crimson" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (permissionsError || !permissions || !canAccess) {
    return <AdminNotAllowed />;
  }

  return (
    <AdminLayout
      activeModule="settings"
      onModuleChange={(module) => {
        setLocation(getAdminModulePath(module));
      }}
      userName={user.name}
      onLogout={() => {
        void logout();
      }}
      allowedModules={permissions.allowedModules as any}
    >
      <div className="space-y-6">
        <PageHeader
          title="Chatbot Control Center"
          description="Configure assistant behavior, knowledge base, inbox, tickets, and analytics."
          breadcrumbs={[{ label: "Admin" }, { label: "Chatbot" }]}
        />

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ChatbotTab)}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="chatbot" className="space-y-4">
            {settingsQuery.isLoading ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Assistant settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Business name</Label>
                      <Input
                        value={settingsForm.businessName || ""}
                        onChange={(event) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            businessName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp number</Label>
                      <Input
                        value={settingsForm.whatsappNumber || ""}
                        onChange={(event) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            whatsappNumber: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary color</Label>
                      <Input
                        value={settingsForm.primaryColor || "#8f5f68"}
                        onChange={(event) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            primaryColor: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tone</Label>
                      <Select
                        value={settingsForm.botTone || "luxury_skincare"}
                        onValueChange={(
                          value: "luxury_skincare" | "friendly" | "professional"
                        ) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            botTone: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="luxury_skincare">Luxury skincare</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Welcome message</Label>
                    <Textarea
                      rows={4}
                      value={settingsForm.welcomeMessage || ""}
                      onChange={(event) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          welcomeMessage: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Enabled tools</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {TOOL_OPTIONS.map((tool) => {
                        const enabled = settingsForm.enabledTools?.includes(tool) ?? false;
                        return (
                          <label
                            key={tool}
                            className="flex items-center gap-2 rounded-lg border border-border/70 bg-white/80 px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={enabled}
                              onCheckedChange={(checked) =>
                                setSettingsForm((prev) => {
                                  const current = new Set(prev.enabledTools || []);
                                  if (checked) current.add(tool);
                                  else current.delete(tool);
                                  return {
                                    ...prev,
                                    enabledTools: Array.from(current),
                                  };
                                })
                              }
                            />
                            <span>{tool}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-white/80 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Bot enabled</p>
                      <p className="text-xs text-muted-foreground">
                        Disable to force handoff via WhatsApp.
                      </p>
                    </div>
                    <Checkbox
                      checked={settingsForm.isEnabled ?? true}
                      onCheckedChange={(checked) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          isEnabled: Boolean(checked),
                        }))
                      }
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      void saveSettingsMutation.mutateAsync();
                    }}
                    disabled={saveSettingsMutation.isPending}
                  >
                    {saveSettingsMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save chatbot settings
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="kb" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Label>Search</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={kbSearch}
                        onChange={(event) => setKbSearch(event.target.value)}
                        className="pl-8"
                        placeholder="Search title, content, tags..."
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Locale</Label>
                    <Select value={kbLocale} onValueChange={setKbLocale}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All locales</SelectItem>
                        <SelectItem value="fr-SN">fr-SN</SelectItem>
                        <SelectItem value="en">en</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tag filter</Label>
                    <Select
                      value={kbTagFilter || "all"}
                      onValueChange={(value) => setKbTagFilter(value === "all" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tags</SelectItem>
                        {availableTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/80 p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {editingKbId ? "Edit article" : "New article"}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      placeholder="Title"
                      value={kbForm.title}
                      onChange={(event) =>
                        setKbForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                    />
                    <Input
                      placeholder="Locale (fr-SN)"
                      value={kbForm.locale}
                      onChange={(event) =>
                        setKbForm((prev) => ({ ...prev, locale: event.target.value }))
                      }
                    />
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={5}
                    placeholder="Article content"
                    value={kbForm.content}
                    onChange={(event) =>
                      setKbForm((prev) => ({ ...prev, content: event.target.value }))
                    }
                  />
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Input
                      placeholder="Tags (comma separated)"
                      value={kbForm.tags.join(", ")}
                      onChange={(event) =>
                        setKbForm((prev) => ({
                          ...prev,
                          tags: parseTags(event.target.value),
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 rounded-lg border border-border/70 px-3">
                      <Checkbox
                        checked={kbForm.isPublished}
                        onCheckedChange={(checked) =>
                          setKbForm((prev) => ({
                            ...prev,
                            isPublished: Boolean(checked),
                          }))
                        }
                      />
                      <span className="text-sm">Published</span>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!kbForm.title.trim() || !kbForm.content.trim()) {
                          toast.error("Title and content are required");
                          return;
                        }
                        if (editingKbId) {
                          void updateKbMutation.mutateAsync({
                            id: editingKbId,
                            payload: kbForm,
                          });
                        } else {
                          void createKbMutation.mutateAsync(kbForm);
                        }
                      }}
                      disabled={createKbMutation.isPending || updateKbMutation.isPending}
                    >
                      {editingKbId ? (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Update article
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add article
                        </>
                      )}
                    </Button>
                    {editingKbId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingKbId(null);
                          setKbForm({
                            title: "",
                            content: "",
                            tags: [],
                            locale: "fr-SN",
                            isPublished: true,
                          });
                        }}
                      >
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {(kbQuery.data || []).map((article) => (
                    <div
                      key={article.id}
                      className="rounded-xl border border-border/70 bg-white/80 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{article.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {article.locale} · {article.isPublished ? "Published" : "Draft"} ·{" "}
                            {formatDate(article.updatedAt)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {article.content}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingKbId(article.id);
                              setKbForm({
                                title: article.title,
                                content: article.content,
                                tags: article.tags || [],
                                locale: article.locale,
                                isPublished: article.isPublished,
                              });
                              setActiveTab("kb");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              void deleteKbMutation.mutateAsync(article.id);
                            }}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inbox" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
              <Card className="h-[680px] overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Threads</CardTitle>
                  <div className="flex gap-2">
                    <Input
                      value={threadSearch}
                      onChange={(event) => setThreadSearch(event.target.value)}
                      placeholder="Search visitor id..."
                    />
                    <Select
                      value={threadStatus}
                      onValueChange={(value: "all" | "open" | "closed") =>
                        setThreadStatus(value)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 overflow-y-auto pb-4">
                  {(threadsQuery.data || []).map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedThreadId === thread.id
                          ? "border-[#c7959d] bg-[#f6e7ea]"
                          : "border-border/70 bg-white/80 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{thread.visitorId}</p>
                        <Badge
                          variant="outline"
                          className={
                            thread.status === "open"
                              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                          }
                        >
                          {thread.status}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {thread.lastMessage || "No messages"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {thread.messageCount} messages · {formatDate(thread.updatedAt)}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="h-[680px] overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Transcript</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto pb-4">
                  {!selectedThreadId || transcriptQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : transcript ? (
                    <>
                      {(transcript.messages || []).map((message) => (
                        <div
                          key={message.id}
                          className="rounded-xl border border-border/70 bg-white/80 p-3"
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs">
                            <Badge variant="outline">{message.role}</Badge>
                            <span className="text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        </div>
                      ))}

                      <div className="rounded-xl border border-border/70 bg-white/85 p-3">
                        <Label>Internal note</Label>
                        <Textarea
                          rows={3}
                          value={noteInput}
                          onChange={(event) => setNoteInput(event.target.value)}
                          placeholder="Add context for teammates..."
                          className="mt-2"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => {
                              if (!selectedThreadId || !noteInput.trim()) return;
                              void addNoteMutation.mutateAsync({
                                threadId: selectedThreadId,
                                note: noteInput,
                              });
                            }}
                            disabled={addNoteMutation.isPending}
                          >
                            Add note
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!selectedThreadId) return;
                              void closeThreadMutation.mutateAsync(selectedThreadId);
                            }}
                            disabled={closeThreadMutation.isPending}
                          >
                            Close thread
                          </Button>
                        </div>
                      </div>

                      {transcript.notes?.length ? (
                        <div className="rounded-xl border border-border/70 bg-white/85 p-3">
                          <p className="mb-2 text-sm font-semibold">Internal notes</p>
                          <div className="space-y-2">
                            {transcript.notes.map((note) => (
                              <div
                                key={note.id}
                                className="rounded-lg border border-border/60 bg-muted/30 p-2"
                              >
                                <p className="text-sm">{note.note}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatDate(note.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No thread selected.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Support tickets</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select
                      value={ticketStatus}
                      onValueChange={(value: "all" | ChatTicketStatus) =>
                        setTicketStatus(value)
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={exportTicketsCsv}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(ticketsQuery.data || []).map((ticketItem) => (
                  <div
                    key={ticketItem.id}
                    className="rounded-xl border border-border/70 bg-white/85 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Ticket className="mr-1 h-3.5 w-3.5" />
                          #{ticketItem.id}
                        </Badge>
                        <Badge variant="outline">Thread #{ticketItem.threadId}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            ticketItem.status === "open"
                              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                          }
                        >
                          {ticketItem.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void ticketStatusMutation.mutateAsync({
                              id: ticketItem.id,
                              status: ticketItem.status === "open" ? "closed" : "open",
                            })
                          }
                        >
                          Mark {ticketItem.status === "open" ? "closed" : "open"}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm">{ticketItem.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Phone: {ticketItem.phone || "-"} · {formatDate(ticketItem.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {analyticsQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))}
              </div>
            ) : analytics ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total chats</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {analytics.totalChats}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Avg messages</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {analytics.avgMessagesPerThread}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Handoff rate</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {analytics.handoffRate}%
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top intents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(analytics.topIntents || []).map((intent) => (
                        <div
                          key={intent.intent}
                          className="flex items-center justify-between rounded-lg border border-border/70 bg-white/80 px-3 py-2"
                        >
                          <span className="text-sm">{intent.intent}</span>
                          <Badge variant="outline">{intent.count}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top searched products</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(analytics.topSearchedProducts || []).map((entry) => (
                        <div
                          key={entry.query}
                          className="flex items-center justify-between rounded-lg border border-border/70 bg-white/80 px-3 py-2"
                        >
                          <span className="text-sm">{entry.query}</span>
                          <Badge variant="outline">{entry.count}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-5 text-sm text-muted-foreground">
                  Analytics unavailable.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
