import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { isWeakMastery, type ExamScope, type Subtopic } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useChapter } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { ChapterHistoryChart, DifficultyChart, MistakeDonut } from "../components/charts.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  Field,
  IconButton,
  InlineNotice,
  LoadingPanel,
  MasteryBadge,
  MasteryMeter,
  MasteryRing,
  Modal,
  Panel,
  PanelHead,
  ScoreBadge,
  useFieldId,
} from "../components/ui.tsx";
import { fmtRelative, masteryTone, pct } from "../lib/format.ts";
import NotFound from "./NotFound.tsx";

const scopeLabels: Record<ExamScope, string> = {
  mains_advanced: "JEE Mains + Advanced",
  mains: "JEE Mains",
  advanced: "JEE Advanced",
};

function EditChapterModal({
  open,
  onClose,
  chapter,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  chapter: { id: number; name: string; description: string; examScope: ExamScope };
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(chapter.name);
  const [description, setDescription] = useState(chapter.description);
  const [examScope, setExamScope] = useState<ExamScope>(chapter.examScope);
  const mutation = useMutation({
    mutationFn: () => api.updateChapter(chapter.id, { name, description, examScope }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  useEffect(() => {
    if (open) {
      setName(chapter.name);
      setDescription(chapter.description);
      setExamScope(chapter.examScope);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chapter.id, chapter.name, chapter.description, chapter.examScope]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit chapter"
      eyebrow="SYLLABUS CORRECTION"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save chapter
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Chapter name" className="span-full">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Exam scope">
          <select
            className="select"
            value={examScope}
            onChange={(event) => setExamScope(event.target.value as ExamScope)}
          >
            <option value="mains_advanced">JEE Mains + Advanced</option>
            <option value="mains">JEE Mains only</option>
            <option value="advanced">JEE Advanced only</option>
          </select>
        </Field>
        <div />
        <Field
          label="Description"
          className="span-full"
          hint="Descriptions are editable so you can correct AI or syllabus mistakes."
        >
          <textarea
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>
      </div>
      {mutation.error && (
        <div className="mt-12">
          <InlineNotice tone="danger" title="Could not save chapter">
            {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </InlineNotice>
        </div>
      )}
    </Modal>
  );
}

function SubtopicModal({
  open,
  onClose,
  chapterId,
  subtopic,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  chapterId: number;
  subtopic: Subtopic | null;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(subtopic?.name ?? "");
  const [description, setDescription] = useState(subtopic?.description ?? "");
  const [weight, setWeight] = useState(String(subtopic?.weight ?? 1));
  const nameId = useFieldId("subtopic-name");
  const mutation = useMutation({
    mutationFn: () =>
      subtopic
        ? api.updateSubtopic(subtopic.id, {
            name,
            description,
            weight: Number(weight) || 1,
          })
        : api.addSubtopic(chapterId, {
            name,
            description,
            weight: Number(weight) || 1,
          }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  useEffect(() => {
    if (open) {
      setName(subtopic?.name ?? "");
      setDescription(subtopic?.description ?? "");
      setWeight(String(subtopic?.weight ?? 1));
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subtopic?.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subtopic ? "Edit subtopic" : "Add subtopic"}
      eyebrow="SYLLABUS CORRECTION"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            {subtopic ? "Save subtopic" : "Add subtopic"}
          </Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 12 }}>
        <Field label="Name" htmlFor={nameId}>
          <input
            id={nameId}
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Weight" hint="Used when aggregating chapter mastery. Default 1.">
          <input
            className="input"
            type="number"
            min={0.01}
            max={20}
            step={0.1}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </Field>
      </div>
      {mutation.error && (
        <div className="mt-12">
          <InlineNotice tone="danger" title="Could not save subtopic">
            {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </InlineNotice>
        </div>
      )}
    </Modal>
  );
}

export default function ChapterPage() {
  const params = useParams();
  const chapterId = Number(params.chapterId);
  const { data, isLoading, error, refetch } = useChapter(chapterId);
  const queryClient = useQueryClient();
  const [editingChapter, setEditingChapter] = useState(false);
  const [subtopicModal, setSubtopicModal] = useState<{ open: boolean; subtopic: Subtopic | null }>({
    open: false,
    subtopic: null,
  });

  const deleteSubtopic = useMutation({
    mutationFn: (id: number) => api.deleteSubtopic(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] }),
        queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
      ]);
    },
  });

  if (!Number.isFinite(chapterId) || chapterId <= 0) return <NotFound />;
  if (isLoading) return <LoadingPanel label="Loading chapter…" />;
  if (error || !data) return <ErrorPanel error={error} retry={() => void refetch()} />;

  const { chapter, subject, mastery, subtopics } = data;
  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["chapter", chapterId] }),
      queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
  const measured = subtopics.filter((subtopic) => subtopic.mastery.sufficient).length;
  const weakest = [...subtopics]
    .filter((subtopic) => isWeakMastery(subtopic.mastery))
    .sort((a, b) => (a.mastery.mastery ?? 100) - (b.mastery.mastery ?? 100));

  return (
    <>
      <Link to="/syllabus" className="back-link">
        <ArrowLeft size={13} /> Back to syllabus
      </Link>
      <PageHeader
        eyebrow={
          <>
            {subject.name} / Chapter {chapter.id} /{" "}
            <span className="text-accent">{scopeLabels[chapter.examScope]}</span>
          </>
        }
        title={chapter.name}
        description={chapter.description || "No chapter description recorded yet."}
        actions={
          <>
            <Button
              variant="subtle"
              icon={<Pencil size={13} />}
              onClick={() => setEditingChapter(true)}
            >
              Edit chapter
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setSubtopicModal({ open: true, subtopic: null })}
            >
              Add subtopic
            </Button>
          </>
        }
        meta={
          <>
            <span>{subtopics.length} subtopics</span>
            <span>{measured} measured</span>
            <span>{subtopics.reduce((sum, item) => sum + item.mastery.attempts, 0)} attempts recorded</span>
          </>
        }
      />

      <div className="dash-grid">
        <Panel className="span-7">
          <div className="between wrap gap-20">
            <div className="row gap-16">
              <MasteryRing value={mastery.mastery} size={110} label="chapter" />
              <div>
                <div className="eyebrow">CHAPTER MASTERY</div>
                <div className="mt-4 row gap-8 wrap">
                  <MasteryBadge mastery={mastery.mastery} sufficient={mastery.sufficient} />
                  <Badge tone="neutral">{pct(mastery.coverage)} coverage</Badge>
                </div>
                <div className="hint-text" style={{ maxWidth: 440 }}>
                  {mastery.reason ??
                    "All subtopic weight has sufficient evidence; the chapter value is the weighted subtopic average."}
                </div>
              </div>
            </div>
            <div className="detail-grid" style={{ flex: 1, minWidth: 220 }}>
              <div className="detail-cell">
                <strong>
                  {mastery.subtopicsMeasured}/{mastery.subtopicsTotal}
                </strong>
                <span>Subtopics measured</span>
              </div>
              <div className="detail-cell">
                <strong>{mastery.evidence.toFixed(2)}</strong>
                <span>Effective evidence</span>
              </div>
              <div className="detail-cell">
                <strong>{Math.round(mastery.confidence * 100)}%</strong>
                <span>Confidence</span>
              </div>
            </div>
          </div>
          <div className="hint-text mt-12">
            Chapter estimates never assign an arbitrary percentage. A chapter with less than 50% of
            its subtopic weight measured shows no mastery value.
          </div>
        </Panel>

        <Panel className="span-5">
          <PanelHead eyebrow="REVISION SIGNAL" title="Where to intervene" />
          {weakest.length === 0 ? (
            <EmptyState
              compact
              icon={<Target size={20} />}
              title="No evidence-backed weak subtopics"
              description={
                measured === 0
                  ? "Attempt at least 5 questions across 4 distinct questions in a subtopic to create a mastery estimate."
                  : "All measured subtopics are currently at 65% mastery or above."
              }
              action={
                <Link
                  to={`/questions?tab=practice&chapterId=${chapter.id}`}
                  className="btn btn-subtle btn-sm"
                >
                  Open chapter questions
                </Link>
              }
            />
          ) : (
            <div className="list">
              {weakest.slice(0, 4).map((subtopic) => (
                <div className="list-row" key={subtopic.id}>
                  <div className="list-row-main">
                    <div className="list-row-title">{subtopic.name}</div>
                    <div className="list-row-sub">
                      <span>{subtopic.mastery.attempts} attempts</span>
                      <span>{subtopic.mastery.distinctQuestions} questions</span>
                      {subtopic.mastery.mistakes[0] && (
                        <span>top mistake: {subtopic.mastery.mistakes[0].type}</span>
                      )}
                    </div>
                  </div>
                  <div className="list-row-side">
                    <span
                      className="mono small"
                      style={{ color: `var(--${masteryTone(subtopic.mastery.mastery) === "muted" ? "text-faint" : masteryTone(subtopic.mastery.mastery)})` }}
                    >
                      {subtopic.mastery.mastery}%
                    </span>
                    <Link
                      to={`/questions?tab=practice&subtopicId=${subtopic.id}`}
                      className="icon-btn"
                      title="Practice this subtopic"
                    >
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-12">
            <Link
              to={`/questions?tab=review-mistakes&chapterId=${chapter.id}`}
              className="btn btn-ghost btn-sm"
            >
              Review chapter mistakes
            </Link>
          </div>
        </Panel>

        <Panel className="span-7">
          <PanelHead
            eyebrow="HISTORY"
            title="Mastery trajectory"
            subtitle="Snapshots recorded after each attempt. The dashed line shows the share of subtopics with a mastery estimate."
          />
          <ChapterHistoryChart data={data.history} />
        </Panel>

        <Panel className="span-5">
          <PanelHead
            eyebrow="DIFFICULTY"
            title="Performance by difficulty"
            subtitle="Stacked attempt outcomes, excluding skipped attempts."
          />
          <DifficultyChart data={data.difficultyStats} />
        </Panel>

        <Panel className="span-12">
          <PanelHead
            eyebrow="SUBTOPIC REGISTER"
            title="Evidence by subtopic"
            subtitle="Each subtopic is tracked independently. Edit classifications when the AI or seed data is wrong."
            actions={
              <Badge tone={measured === subtopics.length ? "success" : "info"}>
                {measured}/{subtopics.length} MEASURED
              </Badge>
            }
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subtopic</th>
                  <th>Mastery</th>
                  <th>Attempts</th>
                  <th>Distinct Qs</th>
                  <th>Evidence</th>
                  <th>Confidence</th>
                  <th>Last attempt</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subtopics.map((subtopic) => (
                  <tr key={subtopic.id}>
                    <td>
                      <div className="table-title">{subtopic.name}</div>
                      {subtopic.description && (
                        <div className="table-sub">{subtopic.description}</div>
                      )}
                      {subtopic.mastery.reason && (
                        <div className="table-sub">{subtopic.mastery.reason}</div>
                      )}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <MasteryMeter
                        mastery={subtopic.mastery.mastery}
                        sufficient={subtopic.mastery.sufficient}
                        showReason={false}
                      />
                    </td>
                    <td className="num">{subtopic.mastery.attempts}</td>
                    <td className="num">{subtopic.mastery.distinctQuestions}</td>
                    <td className="num">{subtopic.mastery.evidence.toFixed(2)}</td>
                    <td className="num">{Math.round(subtopic.mastery.confidence * 100)}%</td>
                    <td className="num">
                      {subtopic.mastery.lastAttemptAt
                        ? fmtRelative(subtopic.mastery.lastAttemptAt)
                        : "—"}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/questions?tab=practice&subtopicId=${subtopic.id}`}
                          className="icon-btn"
                          title="Practice"
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                        <IconButton
                          label="Edit subtopic"
                          onClick={() => setSubtopicModal({ open: true, subtopic })}
                        >
                          <Pencil size={13} />
                        </IconButton>
                        <IconButton
                          label="Delete subtopic"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this subtopic? This is only allowed when it has no recorded attempts.",
                              )
                            ) {
                              deleteSubtopic.mutate(subtopic.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deleteSubtopic.error && (
            <div className="mt-12">
              <InlineNotice tone="danger" title="Could not delete subtopic">
                {deleteSubtopic.error instanceof Error
                  ? deleteSubtopic.error.message
                  : String(deleteSubtopic.error)}
              </InlineNotice>
            </div>
          )}
        </Panel>

        <Panel className="span-8">
          <PanelHead
            eyebrow="RECENT ATTEMPTS"
            title="Recorded evidence"
            actions={
              <Link
                to={`/questions?tab=practice&chapterId=${chapter.id}`}
                className="btn btn-ghost btn-sm"
              >
                Practice chapter
              </Link>
            }
          />
          {data.recentAttempts.length === 0 ? (
            <EmptyState
              compact
              icon={<BookOpen size={20} />}
              title="No attempts in this chapter"
              description="Attempts on classified questions will appear here with full evidence details."
              action={
                <Link
                  to={`/questions?tab=practice&chapterId=${chapter.id}`}
                  className="btn btn-outline btn-sm"
                >
                  Find questions
                </Link>
              }
            />
          ) : (
            <div className="timeline">
              {data.recentAttempts.slice(0, 8).map((attempt) => (
                <div
                  className={`timeline-item ${
                    attempt.correctness === "correct"
                      ? "success"
                      : attempt.correctness === "incorrect"
                        ? "danger"
                        : "accent"
                  }`}
                  key={attempt.id}
                >
                  <div className="between">
                    <div className="timeline-title">
                      {attempt.subtopicName ?? "Unclassified"}{" "}
                      <span className="faint">· {attempt.difficulty ?? "medium"}</span>
                    </div>
                    <ScoreBadge correctness={attempt.correctness} />
                  </div>
                  <div className="timeline-sub">
                    {attempt.timeSpentSeconds}s
                    {attempt.hintsUsed > 0 ? ` · ${attempt.hintsUsed} hints` : ""}
                    {attempt.solutionViewed ? " · solution viewed" : ""}
                    {attempt.mistakeType ? ` · mistake: ${attempt.mistakeType}` : ""} ·{" "}
                    {fmtRelative(attempt.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="span-4">
          <PanelHead eyebrow="MISTAKE PATTERNS" title="Recurring errors" />
          <MistakeDonut mistakes={data.mistakeSummary} />
          {data.mistakeSummary.length > 0 && (
            <div className="hint-text">
              Mistake types are self-reported at attempt time and should be interpreted as recorded
              observations, not an AI diagnosis.
            </div>
          )}
        </Panel>
      </div>

      <EditChapterModal
        open={editingChapter}
        onClose={() => setEditingChapter(false)}
        chapter={chapter}
        onSaved={reload}
      />
      <SubtopicModal
        open={subtopicModal.open}
        onClose={() => setSubtopicModal({ open: false, subtopic: null })}
        chapterId={chapter.id}
        subtopic={subtopicModal.subtopic}
        onSaved={reload}
      />
    </>
  );
}
