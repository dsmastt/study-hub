import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Formula, FormulaTreeData } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useFieldId } from "./ui.tsx";
import {
  Button,
  Field,
  InlineNotice,
  Modal,
  Spinner,
} from "./ui.tsx";
import { FormulaMath } from "./FormulaMath.tsx";

export function FormulaEditor({
  open,
  formula,
  tree,
  initialSubjectId,
  initialChapterId,
  initialSubtopicId,
  onClose,
  onSaved,
}: {
  open: boolean;
  formula: Formula | null;
  tree: FormulaTreeData | undefined;
  initialSubjectId?: number;
  initialChapterId?: number;
  initialSubtopicId?: number;
  onClose: () => void;
  onSaved: (formula: Formula) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [title, setTitle] = useState("");
  const [expression, setExpression] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const titleId = useFieldId("formula-title");
  const expressionId = useFieldId("formula-expression");

  const mutation = useMutation({
    mutationFn: () => {
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (formula) {
        return api.updateFormula(formula.id, {
          title,
          expression,
          notes,
          tags: tagList,
        });
      }
      return api.createFormula({
        subjectId: Number(subjectId),
        chapterId: chapterId ? Number(chapterId) : null,
        subtopicId: subtopicId ? Number(subtopicId) : null,
        title,
        expression,
        notes,
        tags: tagList,
      });
    },
    onSuccess: (saved) => {
      onSaved(saved);
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    mutation.reset();
    if (formula) {
      setSubjectId(String(formula.subjectId));
      setChapterId(formula.chapterId ? String(formula.chapterId) : "");
      setSubtopicId(formula.subtopicId ? String(formula.subtopicId) : "");
      setTitle(formula.title);
      setExpression(formula.expression);
      setNotes(formula.notes);
      setTags(formula.tags.join(", "));
      return;
    }
    const firstSubject = tree?.subjects[0]?.id;
    setSubjectId(String(initialSubjectId ?? firstSubject ?? ""));
    setChapterId(initialChapterId ? String(initialChapterId) : "");
    setSubtopicId(initialSubtopicId ? String(initialSubtopicId) : "");
    setTitle("");
    setExpression("");
    setNotes("");
    setTags("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formula?.id, tree?.subjects.length, initialSubjectId, initialChapterId, initialSubtopicId]);

  const chapters = useMemo(
    () => (tree?.chapters ?? []).filter((chapter) => String(chapter.subjectId) === subjectId),
    [tree, subjectId],
  );
  const subtopics = useMemo(
    () => (tree?.subtopics ?? []).filter((subtopic) => String(subtopic.chapterId) === chapterId),
    [tree, chapterId],
  );
  const scopeLabel = formula
    ? [formula.subjectName, formula.chapterName, formula.subtopicName].filter(Boolean).join(" / ")
    : "Choose where this formula belongs.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={formula ? "Edit formula" : "Add formula"}
      eyebrow={formula ? "FORMULA HUB / EDIT" : "FORMULA HUB / NEW"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!title.trim() || !expression.trim() || !subjectId}
            onClick={() => mutation.mutate()}
          >
            {formula ? "Save formula" : "Add formula"}
          </Button>
        </>
      }
    >
      {!tree ? (
        <Spinner label="Loading syllabus nodes…" />
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="form-grid">
            <Field label="Title" htmlFor={titleId} className="span-full">
              <input
                id={titleId}
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Projectile range"
                autoFocus
              />
            </Field>
            {!formula ? (
              <>
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
                    {tree.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Chapter (optional)">
                  <select
                    className="select"
                    value={chapterId}
                    onChange={(event) => {
                      setChapterId(event.target.value);
                      setSubtopicId("");
                    }}
                  >
                    <option value="">Subject-level formula</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subtopic (optional)" className="span-full">
                  <select
                    className="select"
                    value={subtopicId}
                    onChange={(event) => setSubtopicId(event.target.value)}
                    disabled={!chapterId}
                  >
                    <option value="">Chapter-level formula</option>
                    {subtopics.map((subtopic) => (
                      <option key={subtopic.id} value={subtopic.id}>
                        {subtopic.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <Field label="Classification" className="span-full">
                <div className="info-row" style={{ borderBottom: "none", padding: 0 }}>
                  <span>{scopeLabel}</span>
                </div>
              </Field>
            )}
          </div>

          <Field
            label="Formula"
            htmlFor={expressionId}
            hint="Use LaTeX for fractions, roots, vectors and symbols. Unicode also works."
          >
            <textarea
              id={expressionId}
              className="textarea formula-editor-input"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              rows={4}
              placeholder="e.g. R = \\frac{u^2 \\sin 2\\theta}{g}"
            />
          </Field>
          {expression.trim() && (
            <div className="formula-preview">
              <div className="eyebrow mb-8">PREVIEW</div>
              <FormulaMath expression={expression} />
            </div>
          )}

          <Field label="Notes / memory trick (optional)">
            <textarea
              className="textarea"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="When to use it, sign convention, a mnemonic…"
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              className="input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="projectile, range, kinematics"
            />
          </Field>
          {mutation.error && (
            <InlineNotice tone="danger" title="Could not save formula">
              {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
            </InlineNotice>
          )}
        </div>
      )}
    </Modal>
  );
}
