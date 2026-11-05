import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Check, Eye, RotateCcw, X } from "lucide-react";
import type { Formula, FormulaTreeData } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { FormulaMath } from "./FormulaMath.tsx";
import {
  Badge,
  Button,
  EmptyState,
  InlineNotice,
  LoadingPanel,
  Panel,
  ProgressBar,
} from "./ui.tsx";

export function FlashcardDrill({ tree }: { tree: FormulaTreeData | undefined }) {
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [deck, setDeck] = useState<Formula[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState({ got: 0, missed: 0 });
  const queryClient = useQueryClient();

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRevealed(false);
    setFinished(false);
    setSession({ got: 0, missed: 0 });
    setIndex(0);
    try {
      const cards = await api.formulaFlashcards({
        subjectId: subjectId ? Number(subjectId) : undefined,
        chapterId: chapterId ? Number(chapterId) : undefined,
        limit: 300,
      });
      setDeck(cards);
      setFinished(cards.length === 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setDeck([]);
      setFinished(true);
    } finally {
      setLoading(false);
    }
  }, [subjectId, chapterId]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const chapters = (tree?.chapters ?? []).filter(
    (chapter) => !subjectId || chapter.subjectId === Number(subjectId),
  );
  const card = deck[index];
  const answered = session.got + session.missed;
  const accuracy = answered > 0 ? Math.round((session.got / answered) * 100) : null;

  const review = async (result: "got_it" | "missed") => {
    if (!card || reviewing || !revealed) return;
    setReviewing(true);
    setError(null);
    try {
      await api.reviewFormula(card.id, result);
      setSession((current) => ({
        got: current.got + (result === "got_it" ? 1 : 0),
        missed: current.missed + (result === "missed" ? 1 : 0),
      }));
      if (index + 1 >= deck.length) {
        setFinished(true);
      } else {
        setIndex((current) => current + 1);
        setRevealed(false);
      }
      await queryClient.invalidateQueries({ queryKey: ["formulas"] });
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : String(reviewError));
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="flashcard-layout">
      <Panel>
        <div className="flashcard-toolbar">
          <div>
            <div className="eyebrow">FORMULA RECALL DRILL</div>
            <h2 className="mt-4">Got it, or didn’t?</h2>
            <p className="small muted mt-4">
              Recall the formula before revealing it. There is no multiple choice here — only your
              honest recall signal.
            </p>
          </div>
          <div className="row gap-8 wrap">
            <select
              className="select"
              style={{ width: 150 }}
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setChapterId("");
              }}
            >
              <option value="">All subjects</option>
              {(tree?.subjects ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 170 }}
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              disabled={!subjectId}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={() => void loadDeck()}>
              Reset drill
            </Button>
          </div>
        </div>

        <div className="flashcard-stats">
          <span><strong>{deck.length}</strong> cards in queue</span>
          <span><strong>{session.got}</strong> got it</span>
          <span><strong>{session.missed}</strong> missed</span>
          <span><strong>{accuracy === null ? "—" : `${accuracy}%`}</strong> session recall</span>
          <span className="tiny faint">self-reported</span>
        </div>

        {error && (
          <div className="mt-12">
            <InlineNotice tone="danger" title="Formula drill error">
              {error}
            </InlineNotice>
          </div>
        )}

        {loading ? (
          <LoadingPanel label="Shuffling formula cards by weak recall…" />
        ) : deck.length === 0 ? (
          <EmptyState
            icon={<Brain size={24} />}
            title="No formulas in this filter yet"
            description="Add formulas from the graph view, then return here to drill them."
          />
        ) : finished ? (
          <div className="flashcard-complete">
            <div className="flashcard-complete-icon"><Check size={24} /></div>
            <h3>Round complete</h3>
            <p className="small muted">
              {session.got} got it · {session.missed} didn’t get it
              {accuracy !== null ? ` · ${accuracy}% recall this round` : ""}
            </p>
            <p className="tiny faint">
              Missed cards are prioritised in the next round. This is self-reported recall, not a
              graded test.
            </p>
            <Button variant="primary" icon={<RotateCcw size={14} />} onClick={() => void loadDeck()}>
              Start another round
            </Button>
          </div>
        ) : card ? (
          <div className="flashcard-stage">
            <div className="flashcard-progress">
              <span className="mono tiny faint">
                CARD {index + 1} / {deck.length}
              </span>
              <ProgressBar value={((index + 1) / deck.length) * 100} tone="primary" />
            </div>

            <div className={`flashcard ${revealed ? "revealed" : ""}`}>
              <div className="flashcard-top">
                <div>
                  <div className="eyebrow">
                    {[card.subjectName, card.chapterName, card.subtopicName].filter(Boolean).join(" / ")}
                  </div>
                  <h2 className="flashcard-title">{card.title}</h2>
                </div>
                <div className="row gap-6">
                  {card.source === "seed" ? (
                    <Badge tone="neutral">CORE</Badge>
                  ) : (
                    <Badge tone="primary">MY FORMULA</Badge>
                  )}
                  {card.missedCount > 0 && <Badge tone="warn">{card.missedCount} missed</Badge>}
                </div>
              </div>

              {!revealed ? (
                <div className="flashcard-front">
                  <p className="flashcard-instruction">Recall the formula, then reveal it.</p>
                  <div className="flashcard-tags">
                    {card.tags.map((tag) => (
                      <Badge tone="neutral" key={tag}>{tag}</Badge>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<Eye size={15} />}
                    onClick={() => setRevealed(true)}
                  >
                    Reveal formula
                  </Button>
                </div>
              ) : (
                <div className="flashcard-back">
                  <div className="flashcard-expression">
                    <FormulaMath expression={card.expression} />
                  </div>
                  {card.notes && <p className="flashcard-notes">{card.notes}</p>}
                  <div className="flashcard-tags">
                    {card.tags.map((tag) => (
                      <Badge tone="neutral" key={tag}>{tag}</Badge>
                    ))}
                  </div>
                  <div className="flashcard-answer-row">
                    <Button
                      variant="primary"
                      size="lg"
                      icon={<Check size={15} />}
                      loading={reviewing}
                      onClick={() => void review("got_it")}
                    >
                      Got it
                    </Button>
                    <Button
                      variant="danger"
                      size="lg"
                      icon={<X size={15} />}
                      loading={reviewing}
                      onClick={() => void review("missed")}
                    >
                      Didn’t Get It
                    </Button>
                  </div>
                  <div className="tiny faint">
                    Self-report only. Missed cards are weighted higher in the next drill.
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
