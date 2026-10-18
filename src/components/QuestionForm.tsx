import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Difficulty, Question, QuestionStatus, QuestionType } from "../../shared/types.ts";
import { DIFFICULTY_LABELS } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useSyllabus } from "../api/hooks.ts";
import {
  Button,
  Field,
  InlineNotice,
  Modal,
  Spinner,
  useFieldId,
} from "./ui.tsx";

export function QuestionFormModal({
  open,
  question,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean;
  question: Question | null;
  defaults?: { subjectId?: number; chapterId?: number; subtopicId?: number };
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { data: syllabus, isLoading } = useSyllabus();
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [subtopicId, setSubtopicId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [marks, setMarks] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [answer, setAnswer] = useState("");
  const [solution, setSolution] = useState("");
  const [status, setStatus] = useState<QuestionStatus>("approved");
  const [flags, setFlags] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const promptId = useFieldId("question-prompt");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        subjectId: Number(subjectId),
        chapterId: chapterId ? Number(chapterId) : null,
        subtopicId: subtopicId ? Number(subtopicId) : null,
        prompt,
        options: questionType === "mcq" ? options.filter((option) => option.trim().length > 0) : null,
        answer,
        solution,
        questionType,
        difficulty,
        marks: marks === "" ? null : Number(marks),
        status,
        flags: flags
          .split(",")
          .map((flag) => flag.trim())
          .filter(Boolean),
        sourceRef: sourceRef || undefined,
      };
      return question ? api.updateQuestion(question.id, payload) : api.createQuestion(payload);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    mutation.reset();
    if (question) {
      setSubjectId(String(question.subjectId));
      setChapterId(question.chapterId ? String(question.chapterId) : "");
      setSubtopicId(question.subtopicId ? String(question.subtopicId) : "");
      setPrompt(question.prompt);
      setQuestionType(question.questionType);
      setDifficulty(question.difficulty);
      setMarks(question.marks === null ? "" : String(question.marks));
      setOptions(
        question.options && question.options.length > 0
          ? [...question.options, ...Array(Math.max(0, 4 - question.options.length)).fill("")]
          : ["", "", "", ""],
      );
      setAnswer(question.answer);
      setSolution(question.solution);
      setStatus(question.status);
      setFlags(question.flags.join(", "));
      setSourceRef(question.sourceRef ?? "");
    } else if (syllabus) {
      setSubjectId(String(defaults?.subjectId ?? syllabus.subjects[0]?.id ?? ""));
      setChapterId(defaults?.chapterId ? String(defaults.chapterId) : "");
      setSubtopicId(defaults?.subtopicId ? String(defaults.subtopicId) : "");
      setPrompt("");
      setQuestionType("mcq");
      setDifficulty("medium");
      setMarks("");
      setOptions(["", "", "", ""]);
      setAnswer("");
      setSolution("");
      setStatus("approved");
      setFlags("");
      setSourceRef("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.id, syllabus?.subjects.length]);

  const subjects = syllabus?.subjects ?? [];
  const chapters = (syllabus?.chapters ?? []).filter(
    (chapter) => String(chapter.subjectId) === subjectId,
  );
  const chapter = chapters.find((item) => String(item.id) === chapterId);
  const subtopics = chapter?.subtopics ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={question ? "Edit question" : "New question"}
      eyebrow={question ? "CLASSIFICATION / CONTENT CORRECTION" : "MANUAL QUESTION"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!prompt.trim() || !subjectId}
            onClick={() => mutation.mutate()}
          >
            {question ? "Save question" : "Create question"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Spinner label="Loading syllabus…" />
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="form-grid">
            <Field label="Subject">
              <select
                className="select"
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  setChapterId("");
                  setSubtopicId("");
                }}
              >
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
                value={chapterId}
                onChange={(event) => {
                  setChapterId(event.target.value);
                  setSubtopicId("");
                }}
              >
                <option value="">Unclassified</option>
                {chapters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Subtopic"
              hint="A subtopic is required before an attempt can be recorded against this question."
            >
              <select
                className="select"
                value={subtopicId}
                onChange={(event) => setSubtopicId(event.target.value)}
              >
                <option value="">Unclassified</option>
                {subtopics.map((subtopic) => (
                  <option key={subtopic.id} value={subtopic.id}>
                    {subtopic.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className="select"
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value as QuestionType)}
              >
                <option value="mcq">Multiple choice</option>
                <option value="numeric">Numeric</option>
                <option value="short">Short answer</option>
                <option value="long">Long answer</option>
              </select>
            </Field>
            <Field label="Difficulty">
              <select
                className="select"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Difficulty)}
              >
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marks" hint="Optional.">
              <input
                className="input"
                type="number"
                min={0}
                step={0.5}
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Question" htmlFor={promptId}>
            <textarea
              id={promptId}
              className="textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder="Question text…"
            />
          </Field>

          {questionType === "mcq" && (
            <div>
              <div className="eyebrow mb-8">OPTIONS</div>
              <div className="grid" style={{ gap: 7 }}>
                {options.map((option, index) => (
                  <div className="row gap-8" key={index}>
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <input
                      className="input"
                      value={option}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                    {options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="grow"
                    onClick={() => setOptions((current) => [...current, ""])}
                  >
                    Add option
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="form-grid">
            <Field label="Answer key" hint="For MCQ use the option letter (A/B/C/D) or exact option text.">
              <input className="input" value={answer} onChange={(event) => setAnswer(event.target.value)} />
            </Field>
            <Field label="Status">
              <select
                className="select"
                value={status}
                onChange={(event) => setStatus(event.target.value as QuestionStatus)}
              >
                <option value="approved">Approved</option>
                <option value="needs_review">Needs review</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>

          <Field label="Worked solution">
            <textarea
              className="textarea"
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              rows={4}
              placeholder="Solution or marking notes…"
            />
          </Field>

          <div className="form-grid">
            <Field label="Flags" hint="Comma-separated, e.g. unclear OCR, missing diagram.">
              <input className="input" value={flags} onChange={(event) => setFlags(event.target.value)} />
            </Field>
            <Field label="Source reference">
              <input
                className="input"
                value={sourceRef}
                onChange={(event) => setSourceRef(event.target.value)}
                placeholder="Worksheet name / page"
              />
            </Field>
          </div>

          {mutation.error && (
            <InlineNotice tone="danger" title="Could not save question">
              {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
            </InlineNotice>
          )}
        </div>
      )}
    </Modal>
  );
}
