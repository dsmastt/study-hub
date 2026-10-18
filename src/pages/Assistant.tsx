import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Eraser,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import type { ChatMessage, ChatToolEvent } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useAIStatus, useChatMessages, useDashboard, useInvalidateAll } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import {
  Badge,
  Button,
  EmptyState,
  InlineNotice,
  Panel,
  PanelHead,
  Spinner,
} from "../components/ui.tsx";
import { fmtMinutes, fmtRelative } from "../lib/format.ts";

interface ActionResolution {
  approved: boolean;
  summary: string;
  error?: string;
}

const suggestions = [
  "What should I study next, based on my recorded evidence?",
  "Review my plan for today and cut it down to something realistic.",
  "Explain the difference between rolling with and without slipping, using my syllabus.",
  "Generate 5 hard questions from my weakest evidence-backed topic.",
  "Look at my recent mistakes and identify likely misconceptions.",
  "Summarise my progress this week without inventing anything.",
];

function ToolEventRow({
  event,
  resolution,
  onApprove,
  onReject,
  busy,
}: {
  event: ChatToolEvent;
  resolution: ActionResolution | undefined;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const Icon =
    event.status === "executed"
      ? CheckCircle2
      : event.status === "pending_confirmation"
        ? AlertTriangle
        : event.status === "failed"
          ? XCircle
          : CircleDot;
  const pending = event.status === "pending_confirmation" && event.actionId && !resolution;
  return (
    <div>
      <div className={`tool-event ${event.status}`}>
        <Icon size={11} />
        <span>
          <strong style={{ fontWeight: 500 }}>{event.name}</strong> · {event.summary}
        </span>
      </div>
      {pending && (
        <div className="pending-action">
          <div className="pending-action-title">
            <Lock size={12} /> Confirmation required
          </div>
          <div className="tiny faint mt-4">
            This action changes Study Hub data. It will not run until you approve it.
          </div>
          <div className="pending-action-actions">
            <Button size="sm" variant="primary" loading={busy} onClick={onApprove}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
              Reject
            </Button>
          </div>
        </div>
      )}
      {event.actionId && resolution && (
        <div className={`notice ${resolution.approved ? "notice-success" : "notice-warn"} mt-4`}>
          {resolution.approved ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <div className="notice-body">
            <strong>{resolution.approved ? "Action approved" : "Action rejected"}</strong>
            {resolution.summary}
            {resolution.error && <div className="text-danger mt-4">{resolution.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  resolutions,
  onAction,
  actionBusy,
}: {
  message: ChatMessage;
  resolutions: Record<string, ActionResolution>;
  onAction: (event: ChatToolEvent, approve: boolean) => void;
  actionBusy: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`chat-message ${isUser ? "user" : "assistant"}`}>
      <div className="chat-message-avatar">
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>
      <div>
        <div className="chat-bubble markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
        {!isUser && message.toolEvents.length > 0 && (
          <div className="chat-tool-events">
            {message.toolEvents.map((event, index) => (
              <ToolEventRow
                key={`${event.name}-${index}`}
                event={event}
                resolution={event.actionId ? resolutions[event.actionId] : undefined}
                onApprove={() => onAction(event, true)}
                onReject={() => onAction(event, false)}
                busy={actionBusy}
              />
            ))}
          </div>
        )}
        <div className="tiny faint mt-4" style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}>
          {fmtRelative(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function Assistant() {
  const { data: status } = useAIStatus();
  const { data: messages, isLoading, error, refetch } = useChatMessages();
  const { data: dashboard } = useDashboard();
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState(() => searchParams.get("prompt") ?? "");
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ActionResolution>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const invalidateAll = useInvalidateAll();
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages?.length, optimisticMessage, resolutions]);

  useEffect(() => {
    if (searchParams.get("prompt")) textareaRef.current?.focus();
  }, [searchParams]);

  const send = useMutation({
    mutationFn: (message: string) => api.chat(message),
    onMutate: (message) => {
      setOptimisticMessage(message);
      setInput("");
    },
    onSuccess: async () => {
      setOptimisticMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai", "messages"] }),
        invalidateAll(),
      ]);
    },
    onError: async () => {
      setOptimisticMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["ai", "messages"] });
    },
  });

  const resolveAction = useMutation({
    mutationFn: ({ actionId, approve }: { actionId: string; approve: boolean }) =>
      approve ? api.approveAction(actionId) : api.rejectAction(actionId),
    onSuccess: async (result, variables) => {
      setResolutions((current) => ({
        ...current,
        [variables.actionId]: { approved: result.approved, summary: result.summary },
      }));
      await invalidateAll();
    },
    onError: (error, variables) => {
      setResolutions((current) => ({
        ...current,
        [variables.actionId]: {
          approved: false,
          summary: "Action failed.",
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    },
  });

  const clear = useMutation({
    mutationFn: api.clearMessages,
    onSuccess: async () => {
      setResolutions({});
      await queryClient.invalidateQueries({ queryKey: ["ai", "messages"] });
    },
  });

  const sendMessage = (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || send.isPending || !status?.configured) return;
    send.mutate(message);
  };

  const messageList = messages ?? [];

  return (
    <>
      <PageHeader
        eyebrow="AI ASSISTANT / TOOL-BOUND"
        title="Academic assistant"
        description="An LLM with access to your study data through explicit tools. It cannot run shell commands. Reads execute automatically; consequential writes wait for your approval."
        actions={
          <>
            <Badge tone={status?.configured ? "success" : "danger"} dot>
              {status?.configured ? "AI LINK ONLINE" : "AI OFFLINE"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={<Eraser size={13} />}
              loading={clear.isPending}
              onClick={() => {
                if (window.confirm("Clear the entire assistant conversation?")) clear.mutate();
              }}
            >
              Clear chat
            </Button>
          </>
        }
        meta={
          <>
            <span>{status?.providerLabel ?? "provider"} · {status?.model ?? "model"}</span>
            <span>no shell access</span>
            <span>actions validated server-side</span>
          </>
        }
      />

      {!status?.configured && (
        <InlineNotice
          tone="warn"
          title="The assistant is offline"
          action={
            <Link to="/settings" className="btn btn-outline btn-sm">
              Configure AI
            </Link>
          }
        >
          Add a DeepSeek API key in Settings. The rest of Study Hub works without it; extraction and
          question generation also depend on the provider.
        </InlineNotice>
      )}

      <div className="chat-layout">
        <Panel className="chat-panel">
          <div className="chat-head">
            <div className="chat-head-left">
              <div className="chat-avatar">
                <Bot size={16} />
              </div>
              <div>
                <div className="chat-title">Study Hub Assistant</div>
                <div className="chat-sub">
                  {status?.configured
                    ? `${status.model} · tool-bound · deliberately honest`
                    : "offline · configure a provider"}
                </div>
              </div>
            </div>
            <Badge tone="neutral" dot>
              CONTEXT: RECORDED DATA
            </Badge>
          </div>

          <div className="chat-scroll" ref={scrollRef}>
            {isLoading ? (
              <Spinner label="Loading conversation…" />
            ) : error ? (
              <InlineNotice tone="danger" title="Could not load conversation">
                {error instanceof Error ? error.message : String(error)}
                <div className="mt-8">
                  <Button size="sm" variant="outline" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </div>
              </InlineNotice>
            ) : messageList.length === 0 && !optimisticMessage ? (
              <EmptyState
                icon={<Sparkles size={24} />}
                title="Ask about your actual study data"
                description="The assistant can read your syllabus, tasks, attempts, session state and mastery model through tools. It is instructed to separate recorded facts from recommendations."
              />
            ) : (
              messageList.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  resolutions={resolutions}
                  actionBusy={resolveAction.isPending}
                  onAction={(event, approve) => {
                    if (event.actionId) resolveAction.mutate({ actionId: event.actionId, approve });
                  }}
                />
              ))
            )}
            {optimisticMessage && (
              <div className="chat-message user">
                <div className="chat-message-avatar">
                  <User size={12} />
                </div>
                <div className="chat-bubble markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{optimisticMessage}</ReactMarkdown>
                </div>
              </div>
            )}
            {send.isPending && <div className="chat-typing"><Spinner label="Thinking with recorded context…" /></div>}
          </div>

          {send.error && (
            <div style={{ padding: "0 12px 10px" }}>
              <InlineNotice tone="danger" title="Assistant request failed">
                {send.error instanceof Error ? send.error.message : String(send.error)}
              </InlineNotice>
            </div>
          )}

          <div className="chat-composer">
            <div className="chat-composer-row">
              <textarea
                ref={textareaRef}
                className="textarea"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  status?.configured
                    ? "Ask about a concept, your plan, weak topics, or what to do next…"
                    : "Configure an AI provider to use the assistant."
                }
                disabled={!status?.configured || send.isPending}
              />
              <Button
                variant="primary"
                icon={<Send size={14} />}
                loading={send.isPending}
                disabled={!status?.configured || !input.trim()}
                onClick={() => sendMessage()}
              >
                Send
              </Button>
            </div>
            <div className="chat-hint">ENTER TO SEND · SHIFT+ENTER FOR NEW LINE · WRITES REQUIRE APPROVAL</div>
          </div>
        </Panel>

        <div className="chat-side">
          <Panel>
            <PanelHead eyebrow="AI LINK" title="Provider status" />
            <div className="info-list">
              <div className="info-row">
                <span>Provider</span>
                <span>{status?.providerLabel ?? "—"}</span>
              </div>
              <div className="info-row">
                <span>Model</span>
                <span>{status?.model ?? "—"}</span>
              </div>
              <div className="info-row">
                <span>API key</span>
                <span>{status?.apiKeyHint ?? "not configured"}</span>
              </div>
              <div className="info-row">
                <span>Endpoint</span>
                <span className="truncate" style={{ maxWidth: 170 }}>{status?.baseUrl ?? "—"}</span>
              </div>
            </div>
            <div className="hint-text">
              Provider settings live in Settings. The app is not locked to DeepSeek; any
              OpenAI-compatible chat-completions endpoint can be configured.
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="CONTEXT" title="What it can see" />
            <div className="info-list">
              <div className="info-row">
                <span>Weak topics measured</span>
                <span>{dashboard?.stats.measuredSubtopics ?? 0}</span>
              </div>
              <div className="info-row">
                <span>Tasks today + overdue</span>
                <span>{dashboard ? dashboard.todayTasks.length + dashboard.overdueTasks.length : 0}</span>
              </div>
              <div className="info-row">
                <span>Focus / 7d</span>
                <span>{dashboard ? fmtMinutes(dashboard.stats.focusMinutes7d) : "—"}</span>
              </div>
              <div className="info-row">
                <span>Session</span>
                <span>{dashboard?.activeSession ? `#${dashboard.activeSession.id}` : "none"}</span>
              </div>
            </div>
            <div className="hint-text">
              These are counts of recorded data, not attention estimates. The system prompt includes the
              evidence rules and current session/task context.
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="TOOL POLICY" title="Permissions" />
            <ul className="log-list" style={{ gap: 8 }}>
              <li><Badge tone="success">AUTO</Badge> read overview, syllabus, tasks, attempts</li>
              <li><Badge tone="success">AUTO</Badge> start / pause / resume timer</li>
              <li><Badge tone="warn">CONFIRM</Badge> create task, update task status</li>
              <li><Badge tone="warn">CONFIRM</Badge> generate &amp; store questions</li>
              <li><Badge tone="danger">DENIED</Badge> shell, filesystem, network admin</li>
            </ul>
            <div className="hint-text row gap-4">
              <ShieldCheck size={12} /> All tool input is validated with schemas on the server.
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="PROMPTS" title="Useful starts" />
            <div className="grid" style={{ gap: 6 }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-chip"
                  disabled={!status?.configured || send.isPending}
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="PERSONALITY" title="Understated, not theatrical" />
            <p className="small muted">
              The assistant is direct and competent, with a restrained dry streak. It will occasionally
              tease procrastination, but accuracy, honesty and your autonomy always come first. No
              catchphrases, no constant roleplay.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
