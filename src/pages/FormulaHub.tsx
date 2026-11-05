import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Brain,
  Pencil,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react";
import type { Formula } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useFormulaTree, useFormulas } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { FormulaEditor } from "../components/FormulaEditor.tsx";
import { FormulaGraph, type FormulaGraphSelection } from "../components/FormulaGraph.tsx";
import { FormulaMath } from "../components/FormulaMath.tsx";
import { FlashcardDrill } from "../components/FlashcardDrill.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  InlineNotice,
  LoadingPanel,
  Panel,
  PanelHead,
  Tabs,
} from "../components/ui.tsx";
import { fmtRelative } from "../lib/format.ts";

type FormulaTab = "graph" | "flashcards";

interface EditorState {
  open: boolean;
  formula: Formula | null;
  subjectId?: number;
  chapterId?: number;
  subtopicId?: number;
}

export default function FormulaHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: FormulaTab = searchParams.get("tab") === "flashcards" ? "flashcards" : "graph";
  const setTab = (value: FormulaTab) => {
    const next = new URLSearchParams(searchParams);
    if (value === "graph") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const treeQuery = useFormulaTree();
  const tree = treeQuery.data;
  const [selected, setSelected] = useState<FormulaGraphSelection | null>(null);
  const [selectedFormulaId, setSelectedFormulaId] = useState<number | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<number[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [editor, setEditor] = useState<EditorState>({ open: false, formula: null });
  const queryClient = useQueryClient();

  const selectedSubject = selected?.kind === "subject"
    ? tree?.subjects.find((subject) => subject.id === selected.id)
    : undefined;
  const selectedChapter = selected?.kind === "chapter"
    ? tree?.chapters.find((chapter) => chapter.id === selected.id)
    : undefined;
  const selectedSubtopic = selected?.kind === "subtopic"
    ? tree?.subtopics.find((subtopic) => subtopic.id === selected.id)
    : undefined;
  const parentChapter = selectedSubtopic
    ? tree?.chapters.find((chapter) => chapter.id === selectedSubtopic.chapterId)
    : undefined;
  const parentSubject = selectedSubject ?? {
    id: selectedChapter?.subjectId ?? parentChapter?.subjectId,
  };
  const nodeLabel =
    selectedSubject?.name ??
    selectedChapter?.name ??
    selectedSubtopic?.name ??
    "Formula Hub";
  const nodeSubLabel =
    selectedChapter
      ? tree?.subjects.find((subject) => subject.id === selectedChapter.subjectId)?.name
      : selectedSubtopic
        ? `${
            tree?.subjects.find((subject) => subject.id === parentChapter?.subjectId)?.name ?? ""
          } / ${parentChapter?.name ?? ""}`
        : selectedSubject
          ? "Subject"
          : null;

  const formulaFilters = selected
    ? selected.kind === "subject"
      ? { subjectId: selected.id, limit: 500 }
      : selected.kind === "chapter"
        ? { chapterId: selected.id, limit: 500 }
        : { subtopicId: selected.id, limit: 500 }
    : {};
  const formulasQuery = useFormulas(formulaFilters, Boolean(selected));
  const formulas = formulasQuery.data ?? [];
  const selectedFormula = selectedFormulaId
    ? formulas.find((formula) => formula.id === selectedFormulaId) ?? null
    : null;

  const groupedFormulas = useMemo(() => {
    const groups = new Map<string, Formula[]>();
    for (const formula of formulas) {
      const key =
        selected?.kind === "subject"
          ? formula.chapterName ?? "General"
          : selected?.kind === "chapter"
            ? formula.subtopicName ?? "Chapter-wide"
            : "Formulas";
      const list = groups.get(key) ?? [];
      list.push(formula);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [formulas, selected]);

  const openAdd = () => {
    if (selectedFormula) {
      setEditor({
        open: true,
        formula: null,
        subjectId: selectedFormula.subjectId,
        chapterId: selectedFormula.chapterId ?? undefined,
        subtopicId: selectedFormula.subtopicId ?? undefined,
      });
      return;
    }
    setEditor({
      open: true,
      formula: null,
      subjectId: parentSubject?.id,
      chapterId: selectedChapter?.id ?? parentChapter?.id,
      subtopicId: selectedSubtopic?.id,
    });
  };

  const openEdit = (formula: Formula) => {
    setEditor({ open: true, formula });
  };

  const handleNodeClick = (selection: FormulaGraphSelection) => {
    setSelectedFormulaId(null);
    setSelected(selection);
    if (selection.kind === "subject") {
      setExpandedSubjects((current) =>
        current.includes(selection.id)
          ? current.filter((id) => id !== selection.id)
          : [...current, selection.id],
      );
    } else if (selection.kind === "chapter") {
      const chapter = tree?.chapters.find((item) => item.id === selection.id);
      if (chapter) {
        setExpandedSubjects((current) =>
          current.includes(chapter.subjectId) ? current : [...current, chapter.subjectId],
        );
      }
      setExpandedChapters((current) =>
        current.includes(selection.id)
          ? current.filter((id) => id !== selection.id)
          : [...current, selection.id],
      );
    }
  };

  const refreshFormulas = async () => {
    await queryClient.invalidateQueries({ queryKey: ["formulas"] });
  };

  const deleteFormula = async (formula: Formula) => {
    if (!window.confirm(`Delete “${formula.title}”? This removes it from the formula bank and flashcards.`)) return;
    try {
      await api.deleteFormula(formula.id);
      setSelectedFormulaId(null);
      await refreshFormulas();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  if (treeQuery.isLoading) return <LoadingPanel label="Loading formula universe…" />;
  if (treeQuery.error || !tree) {
    return <ErrorPanel error={treeQuery.error} retry={() => void treeQuery.refetch()} />;
  }

  const topicsWithFormulas = tree.subtopics.filter((subtopic) => subtopic.formulaCount > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="FORMULA HUB / MEMORY SYSTEM"
        title="Formula Hub"
        description="A navigable map of formulas, constants and shortcuts. Start at a subject, reveal a chapter, then a topic; drill the same bank as self-graded flashcards."
        actions={
          <>
            <Button
              variant="subtle"
              icon={<Brain size={14} />}
              onClick={() => setTab(tab === "flashcards" ? "graph" : "flashcards")}
            >
              {tab === "flashcards" ? "Open graph" : "Open flashcards"}
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={openAdd}>
              Add formula
            </Button>
          </>
        }
        meta={
          <>
            <span>{tree.totalFormulas} formulas</span>
            <span>{topicsWithFormulas} topics with formulas</span>
            <span>{tree.subjects.length} subjects</span>
          </>
        }
      />

      <div className="between wrap mb-16">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "graph", label: "Formula graph", count: tree.totalFormulas },
            { value: "flashcards", label: "Flashcards" },
          ]}
        />
        <span className="tiny faint">
          <Sigma size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          Formulas use LaTeX/Unicode rendering
        </span>
      </div>

      {tab === "graph" ? (
        <div className="formula-layout">
          <Panel className="formula-graph-panel">
            <PanelHead
              eyebrow="TOPIC GRAPH"
              title="Formula universe"
              subtitle="Click a subject, then a chapter, then a topic to narrow the bank. Drag to pan; use the controls to zoom."
              actions={
                <div className="row gap-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpandedSubjects(tree.subjects.map((subject) => subject.id));
                      setExpandedChapters([]);
                    }}
                  >
                    All chapters
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpandedSubjects([]);
                      setExpandedChapters([]);
                    }}
                  >
                    Collapse
                  </Button>
                </div>
              }
            />
            <FormulaGraph
              tree={tree}
              expandedSubjects={expandedSubjects}
              expandedChapters={expandedChapters}
              selected={selected}
              onNodeClick={handleNodeClick}
            />
          </Panel>

          <Panel className="formula-side-panel">
            {selectedFormulaId && selectedFormula ? (
              <div className="formula-detail">
                <button
                  className="back-link"
                  onClick={() => setSelectedFormulaId(null)}
                  type="button"
                >
                  <ArrowLeft size={13} /> Back to {nodeLabel}
                </button>
                <div className="between wrap gap-8">
                  <div>
                    <div className="eyebrow">
                      {[selectedFormula.subjectName, selectedFormula.chapterName, selectedFormula.subtopicName]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                    <h2 className="mt-4">{selectedFormula.title}</h2>
                  </div>
                  <div className="row gap-6">
                    <Badge tone={selectedFormula.source === "seed" ? "neutral" : "primary"}>
                      {selectedFormula.source === "seed" ? "CORE" : "MY FORMULA"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={12} />}
                      onClick={() => openEdit(selectedFormula)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={12} />}
                      onClick={() => void deleteFormula(selectedFormula)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="formula-detail-expression">
                  <FormulaMath expression={selectedFormula.expression} />
                </div>
                {selectedFormula.notes && <p className="small muted formula-notes">{selectedFormula.notes}</p>}
                <div className="flashcard-tags">
                  {selectedFormula.tags.map((tag) => (
                    <Badge tone="neutral" key={tag}>{tag}</Badge>
                  ))}
                </div>
                <div className="formula-review-stats">
                  <span><strong>{selectedFormula.reviewCount}</strong> reviews</span>
                  <span><strong>{selectedFormula.gotItCount}</strong> got it</span>
                  <span><strong>{selectedFormula.missedCount}</strong> missed</span>
                  <span>
                    {selectedFormula.lastReviewedAt
                      ? `last ${fmtRelative(selectedFormula.lastReviewedAt)}`
                      : "not reviewed yet"}
                  </span>
                </div>
                <div className="hint-text">
                  Flashcards are self-reported recall checks. They do not modify the question mastery model.
                </div>
              </div>
            ) : (
              <>
                <PanelHead
                  eyebrow={selected ? `${selected.kind.toUpperCase()} / FORMULAS` : "SELECT A NODE"}
                  title={selected ? nodeLabel : "Explore the formula map"}
                  subtitle={
                    selected
                      ? nodeSubLabel ?? undefined
                      : `${tree.totalFormulas} formulas across ${tree.subjects.length} subjects. Start with Physics, Chemistry or Mathematics.`
                  }
                  actions={
                    <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={openAdd}>
                      Add formula
                    </Button>
                  }
                />
                {!selected ? (
                  <div className="formula-intro">
                    <div className="formula-intro-graphic">
                      <Sigma size={30} />
                    </div>
                    <h3>Click a subject to reveal chapters.</h3>
                    <p className="small muted">
                      Keep clicking down to topics to see the exact formulas, constants and shortcuts
                      attached to that part of the syllabus. Add your own formula at any level.
                    </p>
                    <div className="formula-intro-steps">
                      <span>01 / subject</span>
                      <span>02 / chapter</span>
                      <span>03 / topic</span>
                      <span>04 / formulas</span>
                    </div>
                  </div>
                ) : formulasQuery.isLoading ? (
                  <LoadingPanel label="Loading formulas…" />
                ) : formulasQuery.error ? (
                  <ErrorPanel error={formulasQuery.error} retry={() => void formulasQuery.refetch()} />
                ) : formulas.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Sigma size={22} />}
                    title="No formulas attached here yet"
                    description={
                      selected.kind === "subtopic"
                        ? "Add the first formula for this topic."
                        : "This node has no formulas directly or in its children yet."
                    }
                    action={
                      <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={openAdd}>
                        Add a formula
                      </Button>
                    }
                  />
                ) : (
                  <div className="formula-panel-list">
                    <div className="between mb-8">
                      <span className="mono tiny faint">
                        {formulas.length} formula{formulas.length === 1 ? "" : "s"}
                      </span>
                      <span className="tiny faint">Click a card to open it</span>
                    </div>
                    {groupedFormulas.map(([group, groupFormulas]) => (
                      <section key={group} className="formula-group">
                        <div className="eyebrow formula-group-title">{group}</div>
                        <div className="formula-cards">
                          {groupFormulas.map((formula) => (
                            <button
                              key={formula.id}
                              type="button"
                              className="formula-card"
                              onClick={() => setSelectedFormulaId(formula.id)}
                            >
                              <div className="between gap-8">
                                <strong>{formula.title}</strong>
                                {formula.missedCount > 0 && (
                                  <Badge tone="warn">{formula.missedCount} missed</Badge>
                                )}
                              </div>
                              <div className="formula-card-expression">
                                <FormulaMath expression={formula.expression} block={false} />
                              </div>
                              <div className="formula-card-footer">
                                <span>{formula.tags.slice(0, 3).join(" · ") || "formula"}</span>
                                <span>{formula.reviewCount > 0 ? `${formula.gotItCount}/${formula.reviewCount} recall` : "new"}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      ) : (
        <FlashcardDrill tree={tree} />
      )}

      <FormulaEditor
        open={editor.open}
        formula={editor.formula}
        tree={tree}
        initialSubjectId={editor.subjectId}
        initialChapterId={editor.chapterId}
        initialSubtopicId={editor.subtopicId}
        onClose={() => setEditor({ open: false, formula: null })}
        onSaved={async (saved) => {
          const nextSelection: FormulaGraphSelection = saved.subtopicId
            ? { kind: "subtopic", id: saved.subtopicId }
            : saved.chapterId
              ? { kind: "chapter", id: saved.chapterId }
              : { kind: "subject", id: saved.subjectId };
          setSelected(nextSelection);
          setExpandedSubjects((current) =>
            current.includes(saved.subjectId) ? current : [...current, saved.subjectId],
          );
          if (saved.chapterId) {
            setExpandedChapters((current) =>
              current.includes(saved.chapterId!) ? current : [...current, saved.chapterId!],
            );
          }
          await refreshFormulas();
          setSelectedFormulaId(saved.id);
        }}
      />
    </>
  );
}
