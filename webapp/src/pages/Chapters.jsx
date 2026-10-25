import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Frame from "../components/Frame";
import { Bar } from "../components/ui";
import { useChapters } from "../data/gita";
import { useProgress } from "../lib/progress";
import { devaDigits } from "../lib/script";
import { CHAPTERS, TOTAL_VERSES, VERSE_COUNTS } from "../../../src/lib/names";

export default function Chapters() {
  const progress = useProgress();
  const { data: chapters } = useChapters();
  return (
    <Frame crumbs={[{ label: "Chapters" }]}>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="t-display">Chapters</h1>
            <p>
              Eighteen chapters, {TOTAL_VERSES} verses. You have read {progress.total} ({Math.round(progress.fraction * 100)}%).
            </p>
          </div>
          <div style={{ width: 220 }}>
            <Bar value={progress.fraction} label="Whole Gita progress" />
          </div>
        </div>
        <div className="list ch-table">
          {CHAPTERS.slice(1).map((ch, i) => {
            const n = i + 1;
            const info = chapters?.[i];
            const read = progress.perChapter[n];
            return (
              <Link key={n} to={`/chapter/${n}`} className="list-row ch-table-row">
                <span className="ch-table-num">{devaDigits(n)}</span>
                <span className="grow">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="t-heading">{ch.name}</span>
                    <span className="deva accent t-small">{ch.sa}</span>
                  </span>
                  <span className="t-small muted ellipsis" style={{ display: "block" }}>
                    {ch.en}
                    {info?.summaryEn ? ` — ${info.summaryEn}` : ""}
                  </span>
                </span>
                <span className="ch-table-meta">
                  <span className="t-caption muted tnum">
                    {read ? `${read} / ${VERSE_COUNTS[n]} read` : `${VERSE_COUNTS[n]} verses`}
                  </span>
                  <Bar value={read / VERSE_COUNTS[n]} label={`Chapter ${n} progress`} />
                </span>
                <ChevronRight size={16} className="faint" />
              </Link>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}
