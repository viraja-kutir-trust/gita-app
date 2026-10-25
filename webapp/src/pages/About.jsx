import { ExternalLink } from "lucide-react";
import Frame from "../components/Frame";
import { Skeleton } from "../components/ui";
import { useAuthors, useSources } from "../data/gita";
import { authorName, langLabel } from "../../../src/lib/names";

function Row({ title, sub, url }) {
  const body = (
    <>
      <span className="grow">
        <span className="t-strong">{title}</span>
        <span className="t-small muted" style={{ display: "block" }}>
          {sub}
        </span>
      </span>
      {url ? <ExternalLink size={14} className="faint" /> : null}
    </>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="list-row">
      {body}
    </a>
  ) : (
    <div className="list-row">{body}</div>
  );
}

export default function About() {
  const { data: authors } = useAuthors();
  const { data: sources } = useSources();
  return (
    <Frame crumbs={[{ label: "Sources & credits" }]}>
      <div className="page narrow">
        <div className="page-head">
          <div>
            <h1 className="t-display">Sources & credits</h1>
            <p>Gita All-In-One is free, has no ads and exists for learning. Every text is credited to its author and source.</p>
          </div>
        </div>
        <div className="section-title">
          <h2>Translations and commentaries</h2>
        </div>
        <div className="list" style={{ marginBottom: 32 }}>
          {authors
            ? authors.map((a) => <Row key={a.id} title={authorName(a.id, a.name)} sub={[a.work, langLabel(a.lang), a.tradition, a.license].filter(Boolean).join(" · ")} url={a.sourceUrl} />)
            : <div className="list-row"><Skeleton /></div>}
        </div>
        <div className="section-title">
          <h2>Texts and data</h2>
        </div>
        <div className="list">
          {(sources || [])
            .filter((s) => s.id !== "andhra-intro")
            .map((s) => (
              <Row key={s.id} title={s.name} sub={[s.license, s.attribution].filter(Boolean).join(" · ")} url={s.url} />
            ))}
        </div>
        <p className="t-caption faint" style={{ marginTop: 24 }}>
          Word grammar: Digital Corpus of Sanskrit (Oliver Hellwig), CC BY 4.0. Fonts: Inter, Source Serif 4, Tiro Devanagari Sanskrit and Noto Serif (SIL Open Font License).
        </p>
      </div>
    </Frame>
  );
}
