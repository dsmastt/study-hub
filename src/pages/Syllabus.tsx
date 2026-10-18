import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, Search, Sparkles } from "lucide-react";
import type { ChapterWithMastery } from "../../shared/types.ts";
import { useSyllabus } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import {
  Badge,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  MasteryRing,
  Metric,
  Panel,
  PanelHead,
  ProgressBar,
} from "../components/ui.tsx";
import { pct } from "../lib/format.ts";

const scopeLabels: Record<string, string> = {
  mains_advanced: "Mains + Advanced",
  mains: "Mains",
  advanced: "Advanced",
};

function ChapterCard({ chapter }: { chapter: ChapterWithMastery }) {
  const mastery = chapter.mastery;
  return (
    <Link to={`/syllabus/${chapter.id}`} className="chapter-card">
      <div className="chapter-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="chapter-card-name">{chapter.name}</div>
          <div className="chapter-card-sub">
            {chapter.subjectName} · {chapter.subtopicCount ?? 0} subtopics
          </div>
        </div>
        <MasteryRing value={mastery.mastery} size={54} />
      </div>
      <div>
        <div className="chapter-card-meter">
          <ProgressBar
            value={mastery.coverage * 100}
            tone={mastery.mastery === null ? "info" : "primary"}
            className="grow"
          />
          <span className="mono tiny faint">{pct(mastery.coverage)}</span>
        </div>
        <div className="chapter-card-foot mt-8">
          <span>{mastery.subtopicsMeasured}/{mastery.subtopicsTotal} measured</span>
          <Badge tone={chapter.examScope === "advanced" ? "warn" : "neutral"}>
            {scopeLabels[chapter.examScope]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

export default function Syllabus() {
  const { data, isLoading, error, refetch } = useSyllabus();
  const [subjectId, setSubjectId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  if (isLoading) return <LoadingPanel label="Loading JEE syllabus…" />;
  if (error || !data) return <ErrorPanel error={error} retry={() => void refetch()} />;

  const query = deferredSearch.trim().toLowerCase();
  const chapters = data.chapters.filter((chapter) => {
    if (subjectId !== "all" && chapter.subjectId !== subjectId) return false;
    if (query && !`${chapter.name} ${chapter.subjectName ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const grouped = data.subjects
    .filter((subject) => subjectId === "all" || subject.id === subjectId)
    .map((subject) => ({
      subject,
      chapters: chapters.filter((chapter) => chapter.subjectId === subject.id),
    }))
    .filter((group) => group.chapters.length > 0);
  const measured = data.coverage.measuredSubtopics;
  const total = data.coverage.totalSubtopics;
  const coverage = total > 0 ? measured / total : 0;

  return (
    <>
      <PageHeader
        eyebrow="SYLLABUS / JEE MAIN + ADVANCED"
        title="Academic map"
        description="Physics, Chemistry and Mathematics, organised by chapter and subtopic. Mastery is calculated per subtopic from recorded attempts, never assigned to a chapter wholesale."
        actions={
          <Link to="/questions?tab=generate" className="btn btn-primary">
            <Sparkles size={14} /> Generate practice
          </Link>
        }
        meta={
          <>
            <span>{data.subjects.length} subjects</span>
            <span>{data.chapters.length} chapters</span>
            <span>{total} subtopics</span>
          </>
        }
      />

      <div className="grid cols-4 mb-16">
        <Metric
          label="Subtopic coverage"
          value={pct(coverage)}
          sub={`${measured} of ${total} subtopics with sufficient evidence`}
          tone="success"
          icon={<GraduationCap size={15} />}
        />
        <Metric
          label="Recorded attempts"
          value={data.coverage.evidenceAttempts}
          sub="Primary mastery evidence"
          tone="info"
          icon={<BookOpen size={15} />}
        />
        <Metric
          label="Chapters"
          value={data.chapters.length}
          sub="Each chapter has a dedicated page"
          tone="primary"
        />
        <Metric
          label="Mastery estimates"
          value={measured}
          sub="Topics meeting the evidence threshold"
          tone={measured > 0 ? "success" : "neutral"}
        />
      </div>

      <Panel className="mb-16">
        <div className="between wrap">
          <div className="subject-tabs">
            <button
              className={`subject-tab ${subjectId === "all" ? "active" : ""}`}
              onClick={() => setSubjectId("all")}
            >
              All subjects <small>{data.chapters.length}</small>
            </button>
            {data.subjects.map((subject) => (
              <button
                key={subject.id}
                className={`subject-tab ${subjectId === subject.id ? "active" : ""}`}
                onClick={() => setSubjectId(subject.id)}
              >
                {subject.name} <small>{subject.chapterCount}</small>
              </button>
            ))}
          </div>
          <div className="search-input" style={{ maxWidth: 300 }}>
            <Search size={14} />
            <input
              className="input"
              placeholder="Search chapters…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search chapters"
            />
          </div>
        </div>
        <div className="hint-text">
          Chapter mastery is withheld until at least 50% of its subtopic weight has sufficient
          evidence. Partial coverage is shown explicitly instead of inventing a chapter percentage.
        </div>
      </Panel>

      {grouped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Search size={22} />}
            title="No chapters match this filter"
            description="Clear the search or select another subject."
          />
        </Panel>
      ) : (
        <div className="settings-stack">
          {grouped.map(({ subject, chapters: subjectChapters }) => (
            <section key={subject.id}>
              <div className="between mb-12">
                <div>
                  <div className="eyebrow">{subject.code}</div>
                  <h2 className="mt-4">{subject.name}</h2>
                </div>
                <div className="stat-strip">
                  <span>
                    MASTERY{" "}
                    <strong>
                      {subject.mastery === null ? "NO ESTIMATE" : `${subject.mastery}%`}
                    </strong>
                  </span>
                  <span>
                    COVERAGE <strong>{pct(subject.coverage)}</strong>
                  </span>
                  <span>
                    <strong>{subject.chapterCount}</strong> CHAPTERS
                  </span>
                </div>
              </div>
              <div className="chapter-grid">
                {subjectChapters.map((chapter) => (
                  <ChapterCard chapter={chapter} key={chapter.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Panel className="mt-16">
        <PanelHead
          eyebrow="METHOD"
          title="How the syllabus tracks mastery"
          subtitle="Every number is traceable to recorded attempts."
        />
        <div className="grid cols-3">
          <div>
            <Badge tone="primary">01 / EVIDENCE</Badge>
            <p className="small muted mt-8">
              An attempt contributes its correctness (correct, partial or incorrect), weighted by
              question difficulty, recency, hint/solution use, and repetition.
            </p>
          </div>
          <div>
            <Badge tone="primary">02 / THRESHOLD</Badge>
            <p className="small muted mt-8">
              A subtopic needs at least 5 attempts across 4 distinct questions, 3.5 effective
              evidence, and at least 1.5 challenging evidence from medium/hard questions. Until then
              the app reports “insufficient evidence”.
            </p>
          </div>
          <div>
            <Badge tone="primary">03 / AGGREGATION</Badge>
            <p className="small muted mt-8">
              Chapter and subject values aggregate only measured subtopics. Below 50% subtopic
              coverage, the estimate is withheld rather than guessed.
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
