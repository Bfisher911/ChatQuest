import Link from "next/link";
import { Eyebrow, Btn, Icon } from "@/components/brutalist";

export default function NotFound() {
  return (
    <div className="cq-shell">
      <div className="cq-page" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Eyebrow>404 · NOT FOUND</Eyebrow>
        <h1 className="cq-title-xl" style={{ marginTop: 12 }}>WRONG TURN.</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, marginTop: 12, color: "var(--muted)" }}>
          That page doesn&apos;t exist — or it lives behind a different role.
        </p>
        <div style={{ marginTop: 24 }}>
          <Btn asChild>
            <Link href="/dashboard">
              GO HOME <Icon name="arrow" />
            </Link>
          </Btn>
        </div>
      </div>
    </div>
  );
}
