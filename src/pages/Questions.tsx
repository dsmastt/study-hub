import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  FileUp,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import type { Difficulty, Question, QuestionType } from "../../shared/types.ts";
import { DIFFICULTY_LABELS } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useAIStatus, useQuestions, useSyllabus } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { AttemptModal } from "../components/AttemptModal.tsx";
import { QuestionFormModal } from "../components/QuestionForm.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  Field,
  InlineNotice,
  LoadingPanel,
  Metric,
  Panel,
  PanelHead,
  ScoreBadge,
  Spinner,
  Tabs,
} from "../components/ui.tsx";
import { fmtDateTime, fmtRelative, plural } from "../lib/format.ts";

type Tab = "practice" | "review" | "upload" | "generate" | "review-mistakes";
const validTabs: Tab[] = ["practice", "review", "upload", "generate", "review-mistakes"];

function num(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function QuestionCard({
  question,
  onAttempt,
  onEdit,
  onArchive,
}: {
  question: Question;
  onAttempt: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = question.prompt.length > 260;
  return (
    <div className="question-card">
      <div className="question-card-top">
        <div style={{ minWidth: 0 }}>
          <div className={`question-prompt ${expanded ? "expanded" : ""}`}>{question.prompt}</div>
          {long && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ paddingLeft: 0 }}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Show less" : "Show full question"}
            </button>
          )}
        </div>
        <Badge tone={question.difficulty === "hard" ? "danger" : question.difficulty === "medium" ? "warn" : "success"}>
          {DIFFICULTY_LABELS[question.difficulty]}
        </Badge>
      </div>
      <div className="question-meta">
        <Badge tone="neutral">{question.questionType.toUpperCase()}</Badge>
        {question.subjectName && <Badge tone="info">{question.subjectName}</Badge>}
        {question.chapterName && <Badge tone="neutral">{question.chapterName}</Badge>}
        {question.subtopicName && <Badge tone="primary">{question.subtopicName}</Badge>}
        <Badge tone="muted">{question.sourceType}</Badge>
        {question.attemptCount !== undefined && question.attemptCount > 0 && (
          <Badge tone="warn">
            attempted {question.attemptCount}×
            {question.lastCorrectness ? ` · last ${question.lastCorrectness}` : ""}
          </Badge>
        )}
        {question.flags.map((flag) => (
          <Badge key={flag} tone="danger">
            {flag}
          </Badge>
        ))}
      </div>
      <div className="question-actions">
        <Button variant="primary" size="sm" onClick={onAttempt}>
          Attempt
        </Button>
        <Button variant="subtle" size="sm" icon={<Pencil size={12} />} onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Archive size={12} />}
          onClick={() => {
            if (window.confirm("Archive this question? Recorded attempts stay in the database.")) onArchive();
          }}
        >
          Archive
        </Button>
        {question.attemptCount && question.attemptCount > 0 ? (
          <span className="tiny faint" style={{ alignSelf: "center" }}>
            Repeats count less toward mastery
          </span>
        ) : null}
      </div>
      <div className="question-source">
        {question.sourceRef ? `${question.sourceRef} · ` : ""}created {fmtDateTime(question.createdAt)}
      </div>
    </div>
  );
}

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : "practice";
  const subjectId = num(searchParams.get("subjectId"));
  const chapterId = num(searchParams.get("chapterId"));
  const subtopicId = num(searchParams.get("subtopicId"));
  const questionId = num(searchParams.get("questionId"));
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [mistakeFilter, setMistakeFilter] = useState<"incorrect" | "partial" | "all">("incorrect");
  const [attemptQuestionId, setAttemptQuestionId] = useState<number | null>(null);
  const [formState, setFormState] = useState<{ open: boolean; question: Question | null }>({
    open: false,
    question: null,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [dragging, setDragging] = useState(false);
  const [genSubject, setGenSubject] = useState<string>("");
  const [genChapter, setGenChapter] = useState<string>("");
  const [genSubtopic, setGenSubtopic] = useState<string>("");
  const [genDifficulty, setGenDifficulty] = useState<Difficulty | "mixed">("mixed");
  const [genType, setGenType] = useState<QuestionType | "mixed">("mixed");
  const [genCount, setGenCount] = useState("5");
  const [genWeak, setGenWeak] = useState(true);
  const [genInstructions, setGenInstructions] = useState("");
  const queryClient = useQueryClient();
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus();
  const { data: aiStatus } = useAIStatus();

  const setParam = (key: string, value: string | number | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next, { replace: true });
  };
  const setTab = (value: Tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const practiceFilters = {
    status: "approved",
    subjectId,
    chapterId,
    subtopicId,
    questionId,
    difficulty: difficulty || undefined,
    search: deferredSearch || undefined,
    limit: 150,
  };
  const practiceQuery = useQuestions(practiceFilters);
  const reviewQuery = useQuestions({ status: "needs_review", limit: 200 });
  const mistakesQuery = useQuery({
    queryKey: ["attempts", "mistakes", chapterId, subtopicId],
    queryFn: () => api.attempts({ limit: 200, chapterId, subtopicId }),
  });

  const subjects = syllabus?.subjects ?? [];
  const chapters = (syllabus?.chapters ?? []).filter(
    (chapter) => !subjectId || chapter.subjectId === subjectId,
  );
  const selectedChapter = syllabus?.chapters.find((chapter) => chapter.id === chapterId);
  const subtopics = selectedChapter?.subtopics ?? [];
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["questions"] }),
      queryClient.invalidateQueries({ queryKey: ["question"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["attempts"] }),
      queryClient.invalidateQueries({ queryKey: ["chapter"] }),
      queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
      queryClient.invalidateQueries({ queryKey: ["ai"] }),
    ]);
  };

  const archiveQuestion = useMutation({
    mutationFn: (id: number) => api.updateQuestion(id, { status: "archived" }),
    onSuccess: invalidate,
  });
  const quickApprove = useMutation({
    mutationFn: (id: number) => api.updateQuestion(id, { status: "approved" }),
    onSuccess: invalidate,
  });
  const extractMutation = useMutation({
    mutationFn: () =>
      api.extract({
        file: uploadFile ?? undefined,
        text: uploadText || undefined,
        sourceName: uploadSource || undefined,
      }),
    onSuccess: invalidate,
  });
  const generateMutation = useMutation({
    mutationFn: () =>
      api.generateQuestions({
        subjectId: genSubject ? Number(genSubject) : undefined,
        chapterId: genChapter ? Number(genChapter) : undefined,
        subtopicId: genSubtopic ? Number(genSubtopic) : undefined,
        difficulty: genDifficulty,
        questionType: genType,
        count: Math.max(1, Math.min(20, Number(genCount) || 5)),
        focusWeakAreas: genWeak,
        instructions: genInstructions || undefined,
      }),
    onSuccess: invalidate,
  });

  const genChapters = (syllabus?.chapters ?? []).filter(
    (chapter) => !genSubject || chapter.subjectId === Number(genSubject),
  );
  const genSelectedChapter = syllabus?.chapters.find((chapter) => chapter.id === Number(genChapter));
  const genSubjectName = subjects.find((subject) => String(subject.id) === genSubject)?.name;

  const mistakes = useMemo(() => {
    const attempts = mistakesQuery.data ?? [];
    if (mistakeFilter === "all") return attempts.filter((a) => a.correctness === "incorrect" || a.correctness === "partial");
    return attempts.filter((a) => a.correctness === mistakeFilter);
  }, [mistakesQuery.data, mistakeFilter]);
  const allMistakes = (mistakesQuery.data ?? []).filter(
    (a) => a.correctness === "incorrect" || a.correctness === "partial",
  );
  const mistakeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const attempt of allMistakes) {
      if (attempt.mistakeType) counts.set(attempt.mistakeType, (counts.get(attempt.mistakeType) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allMistakes]);

  const openQuestionEditor = async (question: Question) => {
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["question", question.id],
        queryFn: () => api.question(question.id),
      });
      setFormState({ open: true, question: detail.question });
    } catch (error) {
      window.alert(
        `Could not load the full question: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["subjectId", "chapterId", "subtopicId", "questionId"]) next.delete(key);
    setSearchParams(next, { replace: true });
    setSearch("");
    setDifficulty("");
  };

  const totalQuestions = practiceQuery.data?.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="QUESTION SYSTEM / PRACTICE ENGINE"
        title="Questions & evidence"
        description="Practice from approved questions, review AI-extracted worksheets before they become trusted data, generate targeted practice, and revisit recorded mistakes."
        actions={
          <>
            <Button
              variant="subtle"
              icon={<Plus size={14} />}
              onClick={() => setFormState({ open: true, question: null })}
            >
              New question
            </Button>
            <Button
              variant="primary"
              icon={<Sparkles size={14} />}
              onClick={() => setTab("generate")}
            >
              Generate
            </Button>
          </>
        }
        meta={
          <>
            <span>{(practiceQuery.data?.total ?? 0)} approved questions</span>
            <span>{reviewQuery.data?.total ?? 0} awaiting review</span>
            <span>{(mistakesQuery.data ?? []).length} recent attempted records</span>
          </>
        }
      />

      <div className="between wrap mb-16">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "practice", label: "Practice", count: practiceQuery.data?.total },
            { value: "review", label: "Review queue", count: reviewQuery.data?.total },
            { value: "upload", label: "Upload worksheet" },
            { value: "generate", label: "Generate" },
            { value: "review-mistakes", label: "Mistakes", count: allMistakes.length },
          ]}
        />
        {questionId && (
          <Badge tone="primary">
            Filtered to question #{questionId}{" "}
            <button className="btn btn-ghost btn-sm" onClick={() => setParam("questionId", null)}>
              <X size={11} /> clear
            </button>
          </Badge>
        )}
      </div>

      {tab === "practice" && (
        <>
          <Panel className="mb-16">
            <div className="toolbar">
              <Field label="Subject">
                <select
                  className="select"
                  value={subjectId ?? ""}
                  onChange={(event) => {
                    const next = new URLSearchParams(searchParams);
                    if (event.target.value) next.set("subjectId", event.target.value);
                    else next.delete("subjectId");
                    next.delete("chapterId");
                    next.delete("subtopicId");
                    setSearchParams(next, { replace: true });
                  }}
                >
                  <option value="">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Chapter">
                <select
                  className="select"
                  value={chapterId ?? ""}
                  onChange={(event) => {
                    const chapter = syllabus?.chapters.find(
                      (item) => item.id === Number(event.target.value),
                    );
                    const next = new URLSearchParams(searchParams);
                    if (event.target.value) {
                      next.set("chapterId", event.target.value);
                      if (chapter) next.set("subjectId", String(chapter.subjectId));
                    } else {
                      next.delete("chapterId");
                    }
                    next.delete("subtopicId");
                    setSearchParams(next, { replace: true });
                  }}
                >
                  <option value="">All chapters</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subtopic">
                <select
                  className="select"
                  value={subtopicId ?? ""}
                  onChange={(event) => setParam("subtopicId", event.target.value || null)}
                  disabled={!chapterId}
                >
                  <option value="">All subtopics</option>
                  {subtopics.map((subtopic) => (
                    <option key={subtopic.id} value={subtopic.id}>
                      {subtopic.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select
                  className="select"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty | "")}
                >
                  <option value="">Any</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
              <Field label="Search" className="grow-field">
                <div className="search-input">
                  <Search size={14} />
                  <input
                    className="input"
                    placeholder="Search question text…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </Field>
              <div className="toolbar-actions">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="between mt-12">
              <span className="mono tiny faint">
                {totalQuestions} approved question{totalQuestions === 1 ? "" : "s"}
                {selectedSubject ? ` · ${selectedSubject.name}` : ""}
                {selectedChapter ? ` · ${selectedChapter.name}` : ""}
              </span>
              <span className="tiny faint">
                Attempts are the primary mastery evidence. Classification must be set before an attempt
                is accepted.
              </span>
            </div>
          </Panel>

          {practiceQuery.isLoading || syllabusLoading ? (
            <LoadingPanel label="Loading question bank…" />
          ) : practiceQuery.error ? (
            <ErrorPanel error={practiceQuery.error} retry={() => void practiceQuery.refetch()} />
          ) : (practiceQuery.data?.questions.length ?? 0) === 0 ? (
            <Panel>
              <EmptyState
                icon={<FileQuestion size={24} />}
                title={questionId ? "Question not found in approved questions" : "No approved questions match this filter"}
                description={
                  questionId
                    ? "It may be in the review queue or archived. Open the review queue to inspect it."
                    : "Generate questions, upload a worksheet, or create one manually. Extracted questions stay in the review queue until approved."
                }
                action={
                  <div className="row gap-8 wrap">
                    <Button variant="primary" size="sm" onClick={() => setTab("generate")}>
                      Generate questions
                    </Button>
                    <Button variant="subtle" size="sm" onClick={() => setTab("upload")}>
                      Upload worksheet
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormState({ open: true, question: null })}
                    >
                      Create manually
                    </Button>
                  </div>
                }
              />
            </Panel>
          ) : (
            <div className="question-list">
              {practiceQuery.data?.questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onAttempt={() => setAttemptQuestionId(question.id)}
                  onEdit={() => void openQuestionEditor(question)}
                  onArchive={() => archiveQuestion.mutate(question.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "review" && (
        <>
          <Panel className="mb-16">
            <div className="between wrap">
              <div>
                <div className="eyebrow">TRUST BOUNDARY</div>
                <h2 className="mt-4">Worksheet extraction stays untrusted until you approve it.</h2>
                <p className="small muted mt-4" style={{ maxWidth: 820 }}>
                  AI-extracted questions are stored with flags for unclear text, missing diagrams,
                  ambiguous answers, or unreliable keys. Review the classification, answer and marking
                  scheme before approving. Nothing in this queue counts as practice material yet.
                </p>
              </div>
              <Badge tone={reviewQuery.data?.total ? "warn" : "muted"}>
                {reviewQuery.data?.total ?? 0} PENDING
              </Badge>
            </div>
          </Panel>
          {reviewQuery.isLoading ? (
            <LoadingPanel label="Loading review queue…" />
          ) : reviewQuery.error ? (
            <ErrorPanel error={reviewQuery.error} retry={() => void reviewQuery.refetch()} />
          ) : (reviewQuery.data?.questions.length ?? 0) === 0 ? (
            <Panel>
              <EmptyState
                icon={<CheckCircle2 size={24} />}
                title="Review queue is clear"
                description="Upload a worksheet to extract new questions. Clean extracted questions can be approved here."
                action={
                  <Button variant="primary" size="sm" onClick={() => setTab("upload")}>
                    Upload worksheet
                  </Button>
                }
              />
            </Panel>
          ) : (
            <div className="question-list">
              {(reviewQuery.data?.questions ?? []).map((question) => (
                <div className="question-card" key={question.id}>
                  <div className="between wrap">
                    <div className="row gap-6 wrap">
                      <Badge tone="danger">needs review</Badge>
                      {question.sourceType === "uploaded" && <Badge tone="info">uploaded</Badge>}
                      {question.sourceType === "generated" && <Badge tone="primary">generated</Badge>}
                      {question.subjectName && <Badge tone="neutral">{question.subjectName}</Badge>}
                      {question.chapterName && <Badge tone="neutral">{question.chapterName}</Badge>}
                      {question.subtopicName && <Badge tone="primary">{question.subtopicName}</Badge>}
                    </div>
                    <span className="tiny faint">{fmtDateTime(question.createdAt)}</span>
                  </div>
                  <div className="question-prompt mt-12" style={{ maxHeight: "4.5em" }}>
                    {question.prompt}
                  </div>
                  {question.flags.length > 0 && (
                    <div className="pill-list mt-8">
                      {question.flags.map((flag) => (
                        <Badge tone="danger" key={flag}>
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="question-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Pencil size={12} />}
                      onClick={() => void openQuestionEditor(question)}
                    >
                      Review & edit
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={<CheckCircle2 size={12} />}
                      loading={quickApprove.isPending}
                      onClick={() => quickApprove.mutate(question.id)}
                    >
                      Approve as-is
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Archive size={12} />}
                      onClick={() => {
                        if (window.confirm("Archive this extracted question?")) archiveQuestion.mutate(question.id);
                      }}
                    >
                      Archive
                    </Button>
                    <span className="tiny faint" style={{ alignSelf: "center" }}>
                      {question.answer ? "answer key present" : "no answer key"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "upload" && (
        <div className="settings-stack">
          {!aiStatus?.configured && (
            <InlineNotice
              tone="warn"
              title="AI extraction needs a configured provider"
              action={
                <Link to="/settings" className="btn btn-outline btn-sm">
                  Open settings
                </Link>
              }
            >
              Add a DeepSeek API key in Settings. Extraction is performed by the configured model;
              without it you can still create questions manually.
            </InlineNotice>
          )}
          <Panel>
            <PanelHead
              eyebrow="WORKSHEET INGESTION"
              title="Upload a worksheet or paste text"
              subtitle="PDF text, TXT, Markdown, CSV and TeX are supported. Scanned image PDFs need OCR outside the app; image files are rejected rather than guessed at."
            />
            <div className="grid" style={{ gap: 14 }}>
              <label
                className={`upload-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) setUploadFile(file);
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,.csv,.tex"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
                <UploadCloud size={26} />
                <strong>{uploadFile ? uploadFile.name : "Drop a worksheet file here"}</strong>
                <span>or click to choose a file · max 20 MB</span>
              </label>
              {uploadFile && (
                <div className="between">
                  <span className="mono tiny faint">
                    {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setUploadFile(null)}>
                    Remove file
                  </Button>
                </div>
              )}
              <div className="form-grid">
                <Field label="Source name" hint="Stored with each extracted question.">
                  <input
                    className="input"
                    value={uploadSource}
                    onChange={(event) => setUploadSource(event.target.value)}
                    placeholder="e.g. Kinematics Worksheet 3"
                  />
                </Field>
                <div />
                <Field
                  label="Or paste worksheet text"
                  className="span-full"
                  hint="Pasting is useful for text from a PDF reader or online question set."
                >
                  <textarea
                    className="textarea"
                    value={uploadText}
                    onChange={(event) => setUploadText(event.target.value)}
                    rows={7}
                    placeholder="Paste the worksheet text here…"
                  />
                </Field>
              </div>
              <div className="between">
                <span className="tiny faint">
                  Extracted questions are stored as “needs review”. Answer keys are only trusted after
                  you review them.
                </span>
                <Button
                  variant="primary"
                  icon={<FileUp size={14} />}
                  loading={extractMutation.isPending}
                  disabled={!aiStatus?.configured || (!uploadFile && !uploadText.trim())}
                  onClick={() => extractMutation.mutate()}
                >
                  Extract questions
                </Button>
              </div>
            </div>
            {extractMutation.error && (
              <div className="mt-12">
                <InlineNotice tone="danger" title="Extraction failed">
                  {extractMutation.error instanceof Error
                    ? extractMutation.error.message
                    : String(extractMutation.error)}
                </InlineNotice>
              </div>
            )}
            {extractMutation.isPending && (
              <div className="mt-16">
                <Spinner label="Reading worksheet, resolving syllabus classification…" />
              </div>
            )}
          </Panel>

          {extractMutation.data && (
            <Panel>
              <PanelHead
                eyebrow="EXTRACTION RESULT"
                title={`${extractMutation.data.questions.length} question(s) extracted`}
                subtitle={`${extractMutation.data.storedQuestionIds.length} stored for review.`}
                actions={
                  <Button variant="primary" size="sm" onClick={() => setTab("review")}>
                    Open review queue
                  </Button>
                }
              />
              {extractMutation.data.warnings.length > 0 && (
                <InlineNotice tone="warn" title="Warnings">
                  <ul className="log-list mt-4">
                    {extractMutation.data.warnings.map((warning) => (
                      <li key={warning}>› {warning}</li>
                    ))}
                  </ul>
                </InlineNotice>
              )}
              <div className="extracted-list mt-12">
                {extractMutation.data.questions.map((question, index) => (
                  <div className="extracted-item" key={`${question.prompt.slice(0, 20)}-${index}`}>
                    <div className="between">
                      <span className="mono tiny faint">
                        {question.subjectName ?? "unmapped"} / {question.chapterName ?? "unmapped"} /{" "}
                        {question.subtopicName ?? "unmapped"}
                      </span>
                      <Badge tone={question.confidence >= 0.75 ? "success" : question.confidence >= 0.5 ? "warn" : "danger"}>
                        confidence {Math.round(question.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="mt-8">{question.prompt}</div>
                    {question.flags.length > 0 && (
                      <div className="extracted-flags">
                        {question.flags.map((flag) => (
                          <Badge tone="danger" key={flag}>
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {tab === "generate" && (
        <div className="settings-stack">
          {!aiStatus?.configured && (
            <InlineNotice
              tone="warn"
              title="Question generation needs a configured provider"
              action={
                <Link to="/settings" className="btn btn-outline btn-sm">
                  Open settings
                </Link>
              }
            >
              Configure a DeepSeek-compatible API key and model in Settings. Generation will align
              with the JEE syllabus stored in the app.
            </InlineNotice>
          )}
          <Panel>
            <PanelHead
              eyebrow="GENERATIVE PRACTICE"
              title="Build a targeted question set"
              subtitle="Questions are checked against the stored syllabus, validated, and saved with source metadata."
            />
            <div className="form-grid">
              <Field label="Subject">
                <select
                  className="select"
                  value={genSubject}
                  onChange={(event) => {
                    setGenSubject(event.target.value);
                    setGenChapter("");
                    setGenSubtopic("");
                  }}
                >
                  <option value="">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Chapter">
                <select
                  className="select"
                  value={genChapter}
                  onChange={(event) => {
                    setGenChapter(event.target.value);
                    setGenSubtopic("");
                  }}
                >
                  <option value="">Any applicable chapter</option>
                  {genChapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subtopic">
                <select
                  className="select"
                  value={genSubtopic}
                  onChange={(event) => setGenSubtopic(event.target.value)}
                  disabled={!genSelectedChapter}
                >
                  <option value="">Any subtopic in chapter</option>
                  {(genSelectedChapter?.subtopics ?? []).map((subtopic) => (
                    <option key={subtopic.id} value={subtopic.id}>
                      {subtopic.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Count">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  value={genCount}
                  onChange={(event) => setGenCount(event.target.value)}
                />
              </Field>
              <Field label="Difficulty">
                <select
                  className="select"
                  value={genDifficulty}
                  onChange={(event) => setGenDifficulty(event.target.value as Difficulty | "mixed")}
                >
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
              <Field label="Format">
                <select
                  className="select"
                  value={genType}
                  onChange={(event) => setGenType(event.target.value as QuestionType | "mixed")}
                >
                  <option value="mixed">Mixed</option>
                  <option value="mcq">MCQ</option>
                  <option value="numeric">Numeric</option>
                  <option value="short">Short answer</option>
                  <option value="long">Long answer</option>
                </select>
              </Field>
              <Field label="Instructions" className="span-full" hint="Optional extra constraints, e.g. multi-step JEE Advanced style.">
                <textarea
                  className="textarea"
                  value={genInstructions}
                  onChange={(event) => setGenInstructions(event.target.value)}
                  rows={3}
                  placeholder="Focus on multi-step problems involving…"
                />
              </Field>
            </div>
            <label className="checkline mt-12">
              <input
                type="checkbox"
                checked={genWeak}
                onChange={(event) => setGenWeak(event.target.checked)}
              />
              Prioritise evidence-backed weak subtopics when relevant.
            </label>
            <div className="between mt-16">
              <span className="tiny faint">
                {genSubjectName ? `${genSubjectName} · ` : ""}
                generation uses the configured extraction model.
              </span>
              <Button
                variant="primary"
                icon={<Sparkles size={14} />}
                loading={generateMutation.isPending}
                disabled={!aiStatus?.configured}
                onClick={() => generateMutation.mutate()}
              >
                Generate {genCount || 5} questions
              </Button>
            </div>
            {generateMutation.error && (
              <div className="mt-12">
                <InlineNotice tone="danger" title="Generation failed">
                  {generateMutation.error instanceof Error
                    ? generateMutation.error.message
                    : String(generateMutation.error)}
                </InlineNotice>
              </div>
            )}
            {generateMutation.isPending && (
              <div className="mt-16">
                <Spinner label="Building syllabus-aligned questions…" />
              </div>
            )}
          </Panel>

          {generateMutation.data && (
            <Panel>
              <PanelHead
                eyebrow="GENERATION RESULT"
                title={`${generateMutation.data.questions.length} question(s) stored`}
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      clearFilters();
                      setTab("practice");
                    }}
                  >
                    Practice now
                  </Button>
                }
              />
              {generateMutation.data.warnings.length > 0 && (
                <InlineNotice tone="warn" title="Warnings">
                  <ul className="log-list mt-4">
                    {generateMutation.data.warnings.map((warning) => (
                      <li key={warning}>› {warning}</li>
                    ))}
                  </ul>
                </InlineNotice>
              )}
              <div className="question-list mt-12">
                {generateMutation.data.questions.map((question) => (
                  <div className="extracted-item" key={question.id}>
                    <div className="between wrap">
                      <div className="row gap-6 wrap">
                        <Badge tone="primary">{question.subtopicName ?? "unmapped"}</Badge>
                        <Badge tone="neutral">{question.difficulty}</Badge>
                        <Badge tone={question.status === "approved" ? "success" : "warn"}>
                          {question.status}
                        </Badge>
                      </div>
                      <span className="mono tiny faint">#{question.id}</span>
                    </div>
                    <div className="mt-8">{question.prompt}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {tab === "review-mistakes" && (
        <>
          <div className="grid cols-4 mb-16">
            <Metric
              label="Incorrect attempts"
              value={allMistakes.filter((attempt) => attempt.correctness === "incorrect").length}
              sub="Recorded questions with an incorrect result"
              tone="danger"
              icon={<X size={15} />}
            />
            <Metric
              label="Partial attempts"
              value={allMistakes.filter((attempt) => attempt.correctness === "partial").length}
              sub="Partial credit recorded"
              tone="warn"
              icon={<RotateCcw size={15} />}
            />
            <Metric
              label="Most common mistake"
              value={mistakeCounts[0]?.[1] ?? "—"}
              sub={mistakeCounts[0] ? mistakeCounts[0][0] : "No mistake types recorded"}
              tone="info"
            />
            <Metric
              label="Filtered attempts"
              value={mistakes.length}
              sub={chapterId ? "Chapter filter active" : "Recent attempts"}
              tone="neutral"
            />
          </div>

          <Panel className="mb-16">
            <div className="between wrap">
              <Tabs
                value={mistakeFilter}
                onChange={(value) => setMistakeFilter(value)}
                tabs={[
                  { value: "incorrect", label: "Incorrect" },
                  { value: "partial", label: "Partial" },
                  { value: "all", label: "All mistakes" },
                ]}
              />
              <div className="row gap-8">
                {(chapterId || subtopicId) && (
                  <Badge tone="primary">
                    Filtered
                    <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                      <X size={11} /> clear
                    </button>
                  </Badge>
                )}
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => mistakesQuery.refetch()}
                  loading={mistakesQuery.isFetching}
                >
                  Refresh
                </Button>
              </div>
            </div>
            <div className="hint-text">
              These are recorded attempts, not inferred attention. Re-attempting a question adds new
              evidence but repeats are damped; mastery may move slowly on purpose.
            </div>
          </Panel>

          {mistakesQuery.isLoading ? (
            <LoadingPanel label="Loading recorded mistakes…" />
          ) : mistakes.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<CheckCircle2 size={24} />}
                title="No recorded mistakes in this filter"
                description="Incorrect and partial attempts will appear here after you practise. This view never invents mistakes."
                action={
                  <Button variant="primary" size="sm" onClick={() => setTab("practice")}>
                    Practice questions
                  </Button>
                }
              />
            </Panel>
          ) : (
            <div className="question-list">
              {mistakes.map((attempt) => (
                <div className="question-card" key={attempt.id}>
                  <div className="between wrap">
                    <div className="row gap-6 wrap">
                      <ScoreBadge correctness={attempt.correctness} />
                      <Badge tone="neutral">{attempt.difficulty ?? "medium"}</Badge>
                      {attempt.mistakeType && <Badge tone="warn">{attempt.mistakeType}</Badge>}
                      {attempt.hintsUsed > 0 && <Badge tone="info">{attempt.hintsUsed} hints</Badge>}
                      {attempt.solutionViewed && <Badge tone="info">solution viewed</Badge>}
                    </div>
                    <span className="mono tiny faint">{fmtRelative(attempt.createdAt)}</span>
                  </div>
                  <div className="question-prompt mt-8">{attempt.questionPrompt}</div>
                  <div className="question-meta">
                    {attempt.subjectName && <Badge tone="info">{attempt.subjectName}</Badge>}
                    {attempt.chapterName && <Badge tone="neutral">{attempt.chapterName}</Badge>}
                    {attempt.subtopicName && <Badge tone="primary">{attempt.subtopicName}</Badge>}
                    <Badge tone="muted">{attempt.timeSpentSeconds}s</Badge>
                    <Badge tone="muted">{fmtDateTime(attempt.createdAt)}</Badge>
                  </div>
                  <div className="question-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<RotateCcw size={12} />}
                      onClick={() => setAttemptQuestionId(attempt.questionId)}
                    >
                      Re-attempt
                    </Button>
                    <Link
                      to={`/questions?tab=practice&questionId=${attempt.questionId}`}
                      className="btn btn-subtle btn-sm"
                    >
                      <ArrowUpRight size={12} /> Open question
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {attemptQuestionId !== null && (
        <AttemptModal
          questionId={attemptQuestionId}
          onClose={() => setAttemptQuestionId(null)}
          onSaved={invalidate}
        />
      )}
      <QuestionFormModal
        open={formState.open}
        question={formState.question}
        defaults={{ subjectId, chapterId, subtopicId }}
        onClose={() => setFormState({ open: false, question: null })}
        onSaved={invalidate}
      />
    </>
  );
}
