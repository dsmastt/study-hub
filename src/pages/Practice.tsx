import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Flag, LogOut, Play, Timer, X } from "lucide-react";
import type { Correctness, MasteryBreakdown, Question } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { difficultyTone, optionLetter, suggestedResult } from "../lib/attempt.ts";
import { fmtClock } from "../lib/format.ts";
import {
  Badge,
  Button,
  EmptyState,
  InlineNotice,
  LoadingPanel,
  MasteryMeter,
  Panel,
  ScoreBadge,
  Spinner,
} from "../components/ui.tsx";

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default function Practice() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const questionId = numberParam(searchParams.get("questionId"));
  const subjectId = numberParam(searchParams.get("subjectId"));
  const chapterId = numberParam(searchParams.get("chapterId"));
  const subtopicId = numberParam(searchParams.get("subtopicId"));
  const difficulty = searchParams.get("difficulty") ?? undefined;

  const [current, setCurrent] = useState<Question | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [answer, setAnswer] = useState("");
  const [correctness, setCorrectness] = useState<Correctness | "">("");
  const [resultTouched, setResultTouched] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionViewed, setSolutionViewed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [mastery, setMastery] = useState<MasteryBreakdown | null>(null);
  const [recording, setRecording] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const applyQuestion = useCallback((question: Question) => {
    setCurrent(question);
    setSeen((previous) => (previous.includes(question.id) ? previous : [...previous, question.id]));
    setAnswer("");
    setCorrectness("");
    setResultTouched(false);
    setShowSolution(false);
    setSolutionViewed(false);
    setRecorded(false);
    setMastery(null);
    setActionError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    setComplete(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setComplete(false);
      setSeen([]);
      try {
        if (questionId) {
          const detail = await api.question(questionId);
          if (cancelled) return;
          if (detail.question.status !== "approved") {
            throw new Error(
              "This question is not approved. Review it in the question bank before using Focus mode.",
            );
          }
          if (!detail.question.subtopicId) {
            throw new Error(
              "This question has no subtopic classification. Assign one in the question bank to enable same-topic practice.",
            );
          }
          applyQuestion(detail.question);
          const next = await api.nextQuestion({
            subtopicId: detail.question.subtopicId,
            currentId: detail.question.id,
            excludeIds: [detail.question.id],
          });
          if (!cancelled) setRemaining(next.remaining);
        } else {
          const result = await api.nextQuestion({
            subjectId,
            chapterId,
            subtopicId,
            difficulty,
          });
          if (cancelled) return;
          if (!result.question) {
            setComplete(true);
            setCurrent(null);
            setRemaining(0);
          } else {
            applyQuestion(result.question);
            setRemaining(result.remaining);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyQuestion, questionId, subjectId, chapterId, subtopicId, difficulty]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const suggestion = useMemo(
    () => (current ? suggestedResult(current, answer) : null),
    [current, answer],
  );

  useEffect(() => {
    if (!resultTouched && suggestion) setCorrectness(suggestion);
  }, [suggestion, resultTouched]);

  const backParams = new URLSearchParams({ tab: "practice" });
  if (subjectId) backParams.set("subjectId", String(subjectId));
  if (chapterId) backParams.set("chapterId", String(chapterId));
  if (subtopicId) backParams.set("subtopicId", String(subtopicId));
  if (difficulty) backParams.set("difficulty", difficulty);
  const exitHref = `/questions?${backParams.toString()}`;
  const generateHref = `/questions?${new URLSearchParams({
    tab: "generate",
    ...(subjectId ? { subjectId: String(subjectId) } : {}),
    ...(chapterId ? { chapterId: String(chapterId) } : {}),
    ...(subtopicId ? { subtopicId: String(subtopicId) } : {}),
  }).toString()}`;

  const recordAttempt = async () => {
    if (!current || !correctness || recording) return;
    setRecording(true);
    setActionError(null);
    try {
      const result = await api.createAttempt({
        questionId: current.id,
        answer,
        correctness,
        confidence: "medium",
        hintsUsed: 0,
        solutionViewed,
        timeSpentSeconds: elapsed,
      });
      setMastery(result.mastery);
      setRecorded(true);
      setShowSolution(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["questions"] }),
        queryClient.invalidateQueries({ queryKey: ["question"] }),
        queryClient.invalidateQueries({ queryKey: ["attempts"] }),
        queryClient.invalidateQueries({ queryKey: ["chapter"] }),
        queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRecording(false);
    }
  };

  const goNext = async () => {
    if (!current || nextLoading) return;
    setNextLoading(true);
    setActionError(null);
    try {
      const result = await api.nextQuestion({
        ...(current.subtopicId
          ? { subtopicId: current.subtopicId }
          : { chapterId: current.chapterId ?? undefined }),
        currentId: current.id,
        excludeIds: [...seen, current.id],
      });
      if (result.question) {
        setRemaining(result.remaining);
        applyQuestion(result.question);
      } else {
        setRemaining(0);
        setCurrent(null);
        setComplete(true);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setNextLoading(false);
    }
  };

  const topicLabel = current
    ? [current.subjectName, current.chapterName, current.subtopicName].filter(Boolean).join(" / ")
    : "Focus practice";

  return (
    <div className="practice-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="practice-topbar">
        <Link to="/" className="practice-brand">
          <span className="brand-mark">
            <Play size={16} />
          </span>
          <span>
            <strong>STUDY//HUB</strong>
            <small>FOCUS PRACTICE</small>
          </span>
        </Link>
        <div className="practice-topbar-topic">
          <div className="eyebrow">{current ? `QUESTION ${seen.length}` : "FOCUS MODE"}</div>
          <div className="practice-topic-label">{topicLabel}</div>
        </div>
        <div className="practice-topbar-actions">
          <span className="practice-timer">
            <Timer size={14} /> {fmtClock(elapsed)}
          </span>
          <Link to={exitHref} className="btn btn-ghost btn-sm">
            <LogOut size={13} /> Exit
          </Link>
        </div>
      </header>

      <main className="practice-main">
        {loading ? (
          <LoadingPanel label="Selecting an approved question…" />
        ) : loadError ? (
          <Panel>
            <EmptyState
              icon={<X size={22} />}
              title="Could not start focus practice"
              description={loadError}
              action={
                <div className="row gap-8 wrap">
                  <Link to={exitHref} className="btn btn-primary btn-sm">
                    Back to questions
                  </Link>
                  <Link to="/questions?tab=generate" className="btn btn-subtle btn-sm">
                    Generate questions
                  </Link>
                </div>
              }
            />
          </Panel>
        ) : complete || !current ? (
          <Panel>
            <EmptyState
              icon={<CheckCircle2 size={24} />}
              title={seen.length > 0 ? "Topic complete" : "No approved questions found"}
              description={
                seen.length > 0
                  ? `You attempted ${seen.length} question${seen.length === 1 ? "" : "s"} in this topic. There are no more unseen approved questions in it.`
                  : "There are no approved questions matching this topic yet. Generate or review questions first."
              }
              action={
                <div className="row gap-8 wrap">
                  <Link to={generateHref} className="btn btn-primary btn-sm">
                    Generate more
                  </Link>
                  <Link to={exitHref} className="btn btn-subtle btn-sm">
                    Back to questions
                  </Link>
                </div>
              }
            />
          </Panel>
        ) : (
          <Panel className="practice-card">
            <div className="between wrap gap-12">
              <div className="row gap-6 wrap">
                <Badge tone="primary" dot>
                  {current.subtopicName ?? "Topic"}
                </Badge>
                <Badge tone="neutral">{current.chapterName ?? "Unclassified chapter"}</Badge>
                {current.subjectName && <Badge tone="info">{current.subjectName}</Badge>}
              </div>
              <div className="row gap-6 wrap">
                <Badge tone={difficultyTone(current.difficulty)}>{current.difficulty}</Badge>
                <Badge tone="neutral">{current.questionType.toUpperCase()}</Badge>
                {current.attemptCount !== undefined && current.attemptCount > 0 && (
                  <Badge tone="warn">attempted {current.attemptCount}×</Badge>
                )}
              </div>
            </div>

            <div className="practice-prompt">{current.prompt}</div>

            {current.questionType === "mcq" && current.options && current.options.length > 0 ? (
              <div className="option-list practice-options">
                {current.options.map((option, index) => {
                  const letter = optionLetter(index);
                  return (
                    <button
                      key={`${letter}-${option.slice(0, 20)}`}
                      className={`option-item ${answer === letter ? "selected" : ""}`}
                      onClick={() => {
                        if (!recorded) setAnswer(letter);
                      }}
                      disabled={recorded}
                    >
                      <span className="option-letter">{letter}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="textarea practice-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={4}
                placeholder="Your answer…"
                disabled={recorded}
              />
            )}

            {!recorded && (
            <div className="practice-utility-row">
              <Button
                variant={showSolution ? "outline" : "subtle"}
                size="sm"
                icon={<Eye size={13} />}
                onClick={() => {
                  setShowSolution((value) => !value);
                  setSolutionViewed(true);
                }}
              >
                {showSolution ? "Hide solution" : "Reveal answer & solution"}
              </Button>
              {suggestion && !recorded && (
                <Badge tone={suggestion === "correct" ? "success" : "danger"}>
                  <Flag size={11} /> Key suggests {suggestion}
                </Badge>
              )}
              <span className="tiny faint">Answer key suggestions are not auto-recorded.</span>
            </div>
            )}

            {showSolution && !recorded && (
              <div className="solution-box">
                <div className="mb-8">
                  <strong>Answer key:</strong> {current.answer || "No answer key recorded."}
                </div>
                {current.solution || "No worked solution recorded."}
                <div className="evidence-note" style={{ borderTopColor: "var(--border)" }}>
                  Viewing the solution is recorded and reduces this attempt's mastery evidence.
                </div>
              </div>
            )}

            {!recorded ? (
              <div className="practice-footer">
                <div>
                  <div className="eyebrow mb-8">HOW DID IT GO?</div>
                  <div className="result-grid">
                    {(["correct", "partial", "incorrect", "skipped"] as Correctness[]).map((value) => (
                      <button
                        key={value}
                        className={`result-btn ${value} ${correctness === value ? "selected" : ""}`}
                        onClick={() => {
                          setCorrectness(value);
                          setResultTouched(true);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<CheckCircle2 size={14} />}
                  loading={recording}
                  disabled={!correctness}
                  onClick={() => void recordAttempt()}
                >
                  Record attempt
                </Button>
              </div>
            ) : (
              <div className="practice-feedback">
                <div className="row gap-8 wrap mb-12">
                  <ScoreBadge correctness={correctness || "skipped"} />
                  <span className="mono tiny faint">{elapsed}s recorded</span>
                  {solutionViewed && <Badge tone="info">solution viewed</Badge>}
                </div>
                {mastery && (
                  <MasteryMeter
                    mastery={mastery.mastery}
                    sufficient={mastery.sufficient}
                    reason={mastery.reason}
                  />
                )}
                <div className="solution-box mt-12">
                  <div className="mb-8">
                    <strong>Answer key:</strong> {current.answer || "No answer key recorded."}
                  </div>
                  {current.solution || "No worked solution recorded."}
                </div>
                <div className="practice-footer-row">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<Play size={14} />}
                    loading={nextLoading}
                    onClick={() => void goNext()}
                  >
                    Next question
                  </Button>
                  <Link to={exitHref} className="btn btn-ghost btn-sm">
                    Finish for now
                  </Link>
                  <span className="tiny faint">
                    Next picks another approved question from{" "}
                    {current.subtopicName ?? current.chapterName ?? "the same topic"}.
                    {remaining > 0 ? ` ${remaining} remaining.` : ""}
                  </span>
                </div>
              </div>
            )}

            {actionError && (
              <div className="mt-12">
                <InlineNotice tone="danger" title="Attempt action failed">
                  {actionError}
                </InlineNotice>
              </div>
            )}
          </Panel>
        )}

        {!loading && !loadError && current && !recorded && (
          <div className="practice-progress">
            <div className="progress-track">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(2, (seen.length / Math.max(1, seen.length + remaining)) * 100),
                  )}%`,
                }}
              />
            </div>
            <span className="tiny faint">
              {remaining} more approved question{remaining === 1 ? "" : "s"} in this topic after this one
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
