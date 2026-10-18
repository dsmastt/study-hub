import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Lightbulb, Minus, Plus } from "lucide-react";
import type { Correctness, Difficulty, MistakeType, Question } from "../../shared/types.ts";
import { MISTAKE_TYPES } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useQuestion } from "../api/hooks.ts";
import { fmtClock } from "../lib/format.ts";
import {
  Badge,
  Button,
  Field,
  InlineNotice,
  MasteryMeter,
  Modal,
  Panel,
  ScoreBadge,
  Spinner,
} from "./ui.tsx";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function suggestedResult(question: Question, selected: string): Correctness | null {
  if (!selected || !question.answer.trim()) return null;
  if (question.questionType === "mcq") {
    const keyLetter = question.answer.trim().match(/^\(?([a-d])\)?$/i)?.[1]?.toUpperCase();
    if (keyLetter) {
      return selected.toUpperCase() === keyLetter ? "correct" : "incorrect";
    }
    const normalizedKey = normalize(question.answer);
    const options = question.options ?? [];
    const keyIndex = options.findIndex(
      (option) => normalize(option) === normalizedKey || normalize(option).replace(/^[a-d][).]\s*/, "") === normalizedKey,
    );
    if (keyIndex >= 0) {
      return selected.toUpperCase() === optionLetter(keyIndex) ? "correct" : "incorrect";
    }
    return null;
  }
  return normalize(selected) === normalize(question.answer) ? "correct" : null;
}

function difficultyTone(difficulty: Difficulty): "success" | "warn" | "danger" {
  return difficulty === "easy" ? "success" : difficulty === "medium" ? "warn" : "danger";
}

export function AttemptModal({
  questionId,
  onClose,
  onSaved,
}: {
  questionId: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { data, isLoading, error } = useQuestion(questionId);
  const [selected, setSelected] = useState("");
  const [correctness, setCorrectness] = useState<Correctness | "">("");
  const [resultTouched, setResultTouched] = useState(false);
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("medium");
  const [mistakeType, setMistakeType] = useState<MistakeType | "">("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [solutionViewed, setSolutionViewed] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [submitted, setSubmitted] = useState<{
    mastery: Awaited<ReturnType<typeof api.createAttempt>>["mastery"];
  } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const question = data?.question;
  const suggestion = useMemo(
    () => (question ? suggestedResult(question, selected) : null),
    [question, selected],
  );

  useEffect(() => {
    if (!resultTouched && suggestion) setCorrectness(suggestion);
  }, [suggestion, resultTouched]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!question) throw new Error("Question not loaded.");
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      return api.createAttempt({
        questionId: question.id,
        answer: selected,
        correctness,
        confidence,
        mistakeType: correctness === "correct" || correctness === "skipped" ? null : mistakeType || null,
        hintsUsed,
        solutionViewed,
        timeSpentSeconds: elapsed,
      });
    },
    onSuccess: async (result) => {
      setSubmitted({ mastery: result.mastery });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["questions"] }),
        queryClient.invalidateQueries({ queryKey: ["question", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["chapter"] }),
        queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
        queryClient.invalidateQueries({ queryKey: ["attempts"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
      await onSaved();
    },
  });

  const elapsed = Math.round((now - startedAt) / 1000);
  const attempts = data?.attempts ?? [];

  return (
    <Modal
      open
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={submitted ? "Attempt recorded" : "Attempt question"}
      eyebrow={question ? `${question.subjectName ?? "—"} / ${question.chapterName ?? "Unclassified"} / ${question.subtopicName ?? "No subtopic"}` : "QUESTION"}
      size="lg"
      footer={
        submitted ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Check size={14} />}
              loading={mutation.isPending}
              disabled={!question || correctness === ""}
              onClick={() => mutation.mutate()}
            >
              Record attempt
            </Button>
          </>
        )
      }
    >
      {isLoading ? (
        <Spinner label="Loading question…" />
      ) : error || !question ? (
        <InlineNotice tone="danger" title="Could not load question">
          {error instanceof Error ? error.message : "Unknown error"}
        </InlineNotice>
      ) : submitted ? (
        <div>
          <div className="row gap-8 mb-12">
            <ScoreBadge correctness={correctness || "skipped"} />
            <Badge tone="neutral">{elapsed}s</Badge>
            {hintsUsed > 0 && <Badge tone="warn">{hintsUsed} hints</Badge>}
            {solutionViewed && <Badge tone="info">solution viewed</Badge>}
          </div>
          <MasteryMeter
            mastery={submitted.mastery.mastery}
            sufficient={submitted.mastery.sufficient}
            reason={submitted.mastery.reason}
          />
          <div className="detail-grid mt-12">
            <div className="detail-cell">
              <strong>{submitted.mastery.attempts}</strong>
              <span>Attempts in subtopic</span>
            </div>
            <div className="detail-cell">
              <strong>{submitted.mastery.distinctQuestions}</strong>
              <span>Distinct questions</span>
            </div>
            <div className="detail-cell">
              <strong>{submitted.mastery.evidence.toFixed(2)}</strong>
              <span>Effective evidence</span>
            </div>
            <div className="detail-cell">
              <strong>{Math.round(submitted.mastery.confidence * 100)}%</strong>
              <span>Confidence</span>
            </div>
          </div>
          <div className="evidence-note">
            Recorded attempt reached the deterministic mastery engine. Repeated attempts on the same
            question are damped, and hints or viewed solutions reduce the evidence weight.
          </div>
          {question.solution && (
            <div className="mt-16">
              <div className="eyebrow mb-8">WORKED SOLUTION</div>
              <div className="solution-box">
                {question.answer && (
                  <div className="mb-8">
                    <strong>Answer:</strong> {question.answer}
                  </div>
                )}
                {question.solution}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          <Panel className="panel-pad-sm">
            <div className="row gap-8 wrap mb-12">
              <Badge tone={difficultyTone(question.difficulty)}>{question.difficulty}</Badge>
              <Badge tone="neutral">{question.questionType.toUpperCase()}</Badge>
              {question.marks !== null && <Badge tone="neutral">{question.marks} marks</Badge>}
              <Badge tone="neutral">timer {fmtClock(elapsed)}</Badge>
              {question.attemptCount !== undefined && question.attemptCount > 0 && (
                <Badge tone="warn">Previously attempted {question.attemptCount}×</Badge>
              )}
              {question.status === "needs_review" && <Badge tone="danger">Needs review</Badge>}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{question.prompt}</div>
            {question.flags.length > 0 && (
              <div className="pill-list mt-12">
                {question.flags.map((flag) => (
                  <Badge tone="danger" key={flag}>
                    {flag}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>

          {question.questionType === "mcq" && question.options && question.options.length > 0 ? (
            <div className="option-list">
              {question.options.map((option, index) => {
                const letter = optionLetter(index);
                const isSelected = selected === letter;
                return (
                  <button
                    key={`${letter}-${option.slice(0, 20)}`}
                    className={`option-item ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelected(letter)}
                  >
                    <span className="option-letter">{letter}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Field label="Your answer" hint="For numeric answers, enter the final value. For written answers, keep it concise.">
              <textarea
                className="textarea"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                rows={4}
                placeholder="Type your answer…"
              />
            </Field>
          )}

          <div className="between wrap">
            <div className="row gap-8 wrap">
              <Button
                size="sm"
                variant={showSolution ? "outline" : "subtle"}
                icon={<Eye size={13} />}
                onClick={() => {
                  setShowSolution((value) => !value);
                  setSolutionViewed(true);
                }}
              >
                {showSolution ? "Hide solution" : "Reveal answer & solution"}
              </Button>
              <div className="row gap-4">
                <span className="eyebrow">HINTS</span>
                <button
                  className="icon-btn"
                  onClick={() => setHintsUsed((value) => Math.max(0, value - 1))}
                  aria-label="Decrease hints used"
                >
                  <Minus size={13} />
                </button>
                <span className="mono small">{hintsUsed}</span>
                <button
                  className="icon-btn"
                  onClick={() => setHintsUsed((value) => Math.min(20, value + 1))}
                  aria-label="Increase hints used"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            {suggestion && (
              <span className={`badge ${suggestion === "correct" ? "badge-success" : "badge-danger"}`}>
                <Lightbulb size={11} /> Key suggests {suggestion}
              </span>
            )}
          </div>

          {showSolution && (
            <div className="solution-box">
              <div className="mb-8">
                <strong>Answer key:</strong> {question.answer || "No answer key recorded."}
              </div>
              {question.solution || "No worked solution recorded."}
              <div className="evidence-note" style={{ borderTopColor: "var(--border)" }}>
                Viewing the solution is recorded and reduces this attempt's mastery evidence.
              </div>
            </div>
          )}

          <div>
            <div className="eyebrow mb-8">SELF-EVALUATION</div>
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
            <div className="hint-text">
              The answer key only suggests a result. You remain responsible for the recorded
              correctness, especially for written answers.
            </div>
          </div>

          <div className="form-grid">
            <Field label="Confidence">
              <select
                className="select"
                value={confidence}
                onChange={(event) => setConfidence(event.target.value as typeof confidence)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Mistake type" hint="Recorded when the result is partial or incorrect.">
              <select
                className="select"
                value={mistakeType}
                onChange={(event) => setMistakeType(event.target.value as MistakeType | "")}
                disabled={correctness === "correct" || correctness === "skipped" || correctness === ""}
              >
                <option value="">Not recorded</option>
                {MISTAKE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {attempts.length > 0 && (
            <InlineNotice tone="info" title="This question has prior attempts">
              {attempts.length} previous attempt{attempts.length === 1 ? "" : "s"} recorded. Repeated
              attempts on the same question are counted with progressively less weight toward
              mastery.
            </InlineNotice>
          )}
          {mutation.error && (
            <InlineNotice tone="danger" title="Attempt could not be recorded">
              {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
            </InlineNotice>
          )}
          {solutionViewed && (
            <div className="tiny faint">
              Solution was viewed in this attempt. Mastery evidence for this attempt is reduced by up to
              75%, and hints reduce it further.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
