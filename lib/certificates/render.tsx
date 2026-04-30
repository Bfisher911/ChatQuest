// Brutalist certificate PDF — server-side via @react-pdf/renderer.

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";

// Use Helvetica + Courier as base fonts (registered by @react-pdf/renderer
// out of the box). The brutalist Space Grotesk + VT323 + Press Start 2P are
// not bundled here — degrades to system equivalents.

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    color: "#000",
  },
  outer: {
    borderWidth: 4,
    borderColor: "#000",
    flex: 1,
    padding: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  logoMark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#000",
  },
  logoQuest: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#000",
    color: "#fff",
    marginLeft: 4,
  },
  topMeta: {
    fontFamily: "Courier",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  eyebrow: {
    fontFamily: "Courier",
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 24,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 64,
    lineHeight: 0.95,
    marginTop: 12,
    marginBottom: 24,
    textTransform: "uppercase",
  },
  awardedTo: {
    fontFamily: "Courier",
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  recipient: {
    fontFamily: "Helvetica-Bold",
    fontSize: 32,
    marginBottom: 24,
  },
  programLine: {
    fontFamily: "Helvetica",
    fontSize: 14,
    marginBottom: 4,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
    paddingTop: 32,
    borderTopWidth: 2,
    borderTopColor: "#000",
  },
  signatureBlock: {
    fontFamily: "Helvetica",
    fontSize: 11,
    minWidth: 240,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 6,
  },
  verifyBlock: {
    fontFamily: "Courier",
    fontSize: 9,
    letterSpacing: 1,
    textAlign: "right",
  },
});

export interface CertPdfInput {
  certificateTitle: string;
  programTitle: string;
  organizationName: string;
  recipientName: string;
  signerName?: string | null;
  signerTitle?: string | null;
  awardedAt: Date;
  verificationCode: string;
  verificationUrl: string;
  bodyText?: string | null;
}

function CertificateDoc(input: CertPdfInput) {
  const date = input.awardedAt
    .toISOString()
    .slice(0, 10)
    .split("-")
    .reverse()
    .join("-");
  return (
    <Document title={`${input.certificateTitle} · ${input.recipientName}`}>
      <Page orientation="landscape" size="LETTER" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.topBar}>
            <View style={{ flexDirection: "row" }}>
              <Text style={styles.logoMark}>CHAT</Text>
              <Text style={styles.logoQuest}>QUEST</Text>
            </View>
            <Text style={styles.topMeta}>
              ISSUED · {date.toUpperCase()}{"\n"}
              {input.organizationName.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.eyebrow}>■ CERTIFICATE OF COMPLETION</Text>
          <Text style={styles.title}>{input.certificateTitle.toUpperCase()}</Text>

          <Text style={styles.awardedTo}>AWARDED TO</Text>
          <Text style={styles.recipient}>{input.recipientName}</Text>
          <Text style={styles.programLine}>
            For successfully completing the program{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{input.programTitle}</Text>{" "}
            on the ChatQuest platform.
          </Text>
          {input.bodyText ? (
            <Text style={[styles.programLine, { marginTop: 12 }]}>{input.bodyText}</Text>
          ) : null}

          <View style={styles.bottomBar}>
            <View style={styles.signatureBlock}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>
                {input.signerName ?? "Program Instructor"}
              </Text>
              {input.signerTitle ? <Text>{input.signerTitle}</Text> : null}
              <Text style={{ fontFamily: "Courier", fontSize: 9, marginTop: 2 }}>
                INSTRUCTOR · {input.organizationName.toUpperCase()}
              </Text>
            </View>
            <View style={styles.verifyBlock}>
              <Text>VERIFICATION</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 2 }}>
                {input.verificationCode}
              </Text>
              <Text style={{ marginTop: 4, color: "#444" }}>{input.verificationUrl}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(input: CertPdfInput): Promise<Buffer> {
  const stream = await pdf(<CertificateDoc {...input} />).toBuffer();
  return stream as unknown as Buffer;
}
