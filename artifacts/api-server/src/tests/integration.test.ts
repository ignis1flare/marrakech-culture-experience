import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { io as ClientSocket, type Socket } from "socket.io-client";

// Set environment for in-memory test database and test secrets
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "memory://";
process.env.SESSION_SECRET = "test-marrakech-super-secret-key-32chars!";
process.env.ADMIN_PASSWORD = "MarrakechAdmin2026!";
process.env.ADMIN_USERNAME = "presenter";
process.env.PORT = "0";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { setTestDb, type AppDatabase } from "@workspace/db";
import * as schema from "@workspace/db/schema";

// Import app after env vars are established
import app from "../app";
import { attachMarrakechRealtime, closeRealtimeServer } from "../lib/marrakech-realtime";
import { seedMarrakechContent } from "../lib/marrakech-seed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let baseUrl = "";
let server: ReturnType<typeof createServer>;

function getCookie(res: Response, name: string): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
}

before(async () => {
  const client = new PGlite();
  const migrationPath = path.resolve(__dirname, "../../../../lib/db/migrations/0000_elite_phantom_reporter.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const clean = stmt.trim();
    if (clean) await client.exec(clean);
  }
  const testDb = drizzlePglite({ client, schema }) as unknown as AppDatabase;
  setTestDb(testDb, client as any);

  await seedMarrakechContent();
  server = createServer(app);
  attachMarrakechRealtime(server);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await closeRealtimeServer();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Marrakech Culture Experience - Complete Verification Suite", () => {
  let adminCookie = "";
  let sessionCode = "";
  let participant1Cookie = "";
  let participant2Cookie = "";
  let quizQuestionIds: string[] = [];
  let pollId = "";

  it("1. Public culture content does not expose presenter notes", async () => {
    const res = await fetch(`${baseUrl}/api/slides`);
    assert.equal(res.status, 200);
    const slides = await res.json();
    assert.ok(Array.isArray(slides));
    assert.ok(slides.length >= 10);
    for (const slide of slides) {
      assert.equal(slide.presenterNotes, undefined, "Public slides must never expose presenter notes");
    }
  });

  it("2. Presenter Authentication: rejects invalid credentials and accepts valid ones", async () => {
    // Check initial unauthenticated state
    const authCheck = await fetch(`${baseUrl}/api/admin/auth`);
    const initialAuth = await authCheck.json();
    assert.equal(initialAuth.authenticated, false);

    // Bad password
    const badLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "presenter", password: "wrong-password" }),
    });
    assert.equal(badLogin.status, 401);

    // Correct password
    const goodLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "presenter", password: "MarrakechAdmin2026!" }),
    });
    assert.equal(goodLogin.status, 200);
    const cookie = getCookie(goodLogin, "marrakech_admin");
    assert.ok(cookie, "Must return signed marrakech_admin cookie");
    adminCookie = cookie;

    // Verify authenticated state
    const authVerified = await fetch(`${baseUrl}/api/admin/auth`, {
      headers: { Cookie: adminCookie },
    });
    const authData = await authVerified.json();
    assert.equal(authData.authenticated, true);
    assert.equal(authData.username, "presenter");

    // Admin can see slides with private notes
    const adminSlidesRes = await fetch(`${baseUrl}/api/admin/slides`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(adminSlidesRes.status, 200);
    const adminSlides = await adminSlidesRes.json();
    assert.ok(adminSlides[0].notes !== undefined, "Admin should see presenter notes");
  });

  it("3. Start Presentation: generates a live session code", async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 201);
    const state = await res.json();
    assert.ok(/^MARRAKECH-\d+$/.test(state.sessionCode));
    assert.equal(state.status, "live");
    assert.equal(state.currentSlide, 0);
    assert.equal(state.currentActivity, null);
    sessionCode = state.sessionCode;
  });

  it("4. Projector Screen: reads state without administrative rights", async () => {
    const res = await fetch(`${baseUrl}/api/sessions/${sessionCode}/state`);
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.sessionCode, sessionCode);
    assert.equal(state.status, "live");
    assert.equal(state.currentSlide, 0);
  });

  it("5. Audience Interface: joining, unique nicknames, and reconnection", async () => {
    // Participant 1 joins
    const join1 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Amira" }),
    });
    assert.equal(join1.status, 200);
    const p1 = await join1.json();
    assert.equal(p1.participant.nickname, "Amira");
    participant1Cookie = getCookie(join1, "marrakech_participant")!;
    assert.ok(participant1Cookie);

    // Duplicate nickname from new user is rejected
    const joinDup = await fetch(`${baseUrl}/api/sessions/${sessionCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "amira" }),
    });
    assert.equal(joinDup.status, 409, "Duplicate display name must be rejected with 409 Conflict");

    // Reconnection of same user with cookie succeeds
    const joinRecon = await fetch(`${baseUrl}/api/sessions/${sessionCode}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ nickname: "Amira" }),
    });
    assert.equal(joinRecon.status, 200);

    // Participant 2 joins
    const join2 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Youssef" }),
    });
    assert.equal(join2.status, 200);
    participant2Cookie = getCookie(join2, "marrakech_participant")!;
    assert.ok(participant2Cookie);

    // Admin verifies participants list
    const participantsRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/participants`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(participantsRes.status, 200);
    const participants = await participantsRes.json();
    assert.equal(participants.length, 2);
  });

  it("6. Slide Navigation: bounded slide switching synced in real-time", async () => {
    // Advance to slide 2
    const changeRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/slide`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ currentSlide: 2 }),
    });
    assert.equal(changeRes.status, 200);
    const state = await changeRes.json();
    assert.equal(state.currentSlide, 2);

    // Audience / Projector sees updated slide
    const checkState = await fetch(`${baseUrl}/api/sessions/${sessionCode}/state`);
    const read = await checkState.json();
    assert.equal(read.currentSlide, 2);

    // Out-of-bounds slide rejected
    const invalidSlide = await fetch(`${baseUrl}/api/sessions/${sessionCode}/slide`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ currentSlide: 9999 }),
    });
    assert.equal(invalidSlide.status, 400);
  });

  it("7. Poll Lifecycle: open -> vote -> duplicate prevention -> close -> results -> return", async () => {
    // Presenter opens poll
    const openRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        question: "What is your favorite Moroccan aroma?",
        options: ["Orange blossom", "Cedar wood", "Fresh mint", "Warm cumin"],
      }),
    });
    assert.equal(openRes.status, 201);
    const pollData = await openRes.json();
    assert.equal(pollData.status, "open");
    assert.equal(pollData.options.length, 4);
    pollId = pollData.id;

    // Verify session activity is now "poll"
    const stateCheck = await fetch(`${baseUrl}/api/sessions/${sessionCode}/state`);
    const s = await stateCheck.json();
    assert.equal(s.currentActivity, "poll");

    // Participant 1 votes for Fresh mint (index 2)
    const vote1 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/polls/${pollId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ optionIndex: 2 }),
    });
    assert.equal(vote1.status, 200);

    // Participant 1 tries to vote again -> 409 Conflict
    const voteDup = await fetch(`${baseUrl}/api/sessions/${sessionCode}/polls/${pollId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ optionIndex: 0 }),
    });
    assert.equal(voteDup.status, 409, "Duplicate vote must be rejected");

    // Participant 2 votes for Fresh mint (index 2)
    const vote2 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/polls/${pollId}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant2Cookie,
      },
      body: JSON.stringify({ optionIndex: 2 }),
    });
    assert.equal(vote2.status, 200);

    // Presenter closes poll and retrieves results
    const closeRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/polls/${pollId}/close`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(closeRes.status, 200);
    const results = await closeRes.json();
    assert.equal(results.status, "closed");
    assert.equal(results.voteCount, 2);
    const mintOption = results.results.find((r: { option: string }) => r.option === "Fresh mint");
    assert.equal(mintOption.count, 2);
    assert.equal(mintOption.percentage, 100);

    // Return to presentation
    const returnRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ activity: "presentation" }),
    });
    assert.equal(returnRes.status, 200);
    const returnedState = await returnRes.json();
    assert.equal(returnedState.currentActivity, null);
  });

  it("8. Quiz Lifecycle: select questions -> start -> protect answer -> validate -> reveal -> calculate results", async () => {
    // Retrieve question bank
    const bankRes = await fetch(`${baseUrl}/api/admin/quiz/questions`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(bankRes.status, 200);
    const questions = await bankRes.json();
    assert.ok(questions.length >= 5);
    quizQuestionIds = questions.slice(0, 2).map((q: { id: string }) => q.id);

    // Start quiz
    const startQuizRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/quiz/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        questionIds: quizQuestionIds,
        timeLimitSeconds: 30,
        activity: "quiz",
      }),
    });
    assert.equal(startQuizRes.status, 200);

    // Verify current quiz from audience view: answer must NOT be exposed!
    const curRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/quiz/current`);
    assert.equal(curRes.status, 200);
    const currentQuiz = await curRes.json();
    assert.equal(currentQuiz.status, "live");
    assert.equal(currentQuiz.revealed, false);
    assert.equal(currentQuiz.correctIndex, null, "Correct answer index must be hidden before reveal!");
    assert.equal(currentQuiz.explanation, null, "Explanation must be hidden before reveal!");

    const q1 = currentQuiz.currentQuestion;
    assert.ok(q1);

    // Find the correct answer for q1 from admin bank
    const q1Admin = questions.find((item: { id: string }) => item.id === q1.id);
    const correctIdx = q1Admin.correctIndex;
    const wrongIdx = (correctIdx + 1) % q1.options.length;

    // Participant 1 submits correct answer
    const ans1 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ questionId: q1.id, answerIndex: correctIdx }),
    });
    assert.equal(ans1.status, 200);
    const ans1Data = await ans1.json();
    assert.equal(ans1Data.accepted, true);

    // Participant 1 tries to answer again -> locked
    const ansDup = await fetch(`${baseUrl}/api/sessions/${sessionCode}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ questionId: q1.id, answerIndex: wrongIdx }),
    });
    assert.equal(ansDup.status, 200);
    const ansDupData = await ansDup.json();
    assert.equal(ansDupData.accepted, false);
    assert.equal(ansDupData.locked, true);

    // Participant 2 submits wrong answer
    const ans2 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant2Cookie,
      },
      body: JSON.stringify({ questionId: q1.id, answerIndex: wrongIdx }),
    });
    assert.equal(ans2.status, 200);

    // Presenter reveals answer
    const revealRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/quiz/reveal`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(revealRes.status, 200);
    const revealedQuiz = await revealRes.json();
    assert.equal(revealedQuiz.revealed, true);
    assert.equal(revealedQuiz.correctIndex, correctIdx);
    assert.ok(revealedQuiz.explanation);

    // Presenter advances to next question
    const nextRes = await fetch(`${baseUrl}/api/admin/sessions/:sessionCode/quiz/next`.replace(":sessionCode", sessionCode), {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(nextRes.status, 200);
    const nextQuiz = await nextRes.json();
    assert.equal(nextQuiz.currentQuestion.questionNumber, 2);

    // Presenter ends quiz
    const endQuizRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/quiz/end`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(endQuizRes.status, 200);

    // Presenter reveals leaderboard
    const leadRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/quiz/leaderboard/reveal`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(leadRes.status, 200);

    // Fetch quiz results analysis
    const resultsRes = await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/results`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(resultsRes.status, 200);
    const quizReport = await resultsRes.json();
    assert.equal(quizReport.summary.participantCount, 2);
    // Participant 1 got it right -> higher score
    const p1Result = quizReport.participants.find((p: { nickname: string }) => p.nickname === "Amira");
    const p2Result = quizReport.participants.find((p: { nickname: string }) => p.nickname === "Youssef");
    assert.ok(p1Result.score > p2Result.score, "Correct participant must score higher than incorrect");
    assert.equal(p1Result.correctCount, 1);
    assert.equal(p2Result.correctCount, 0);
  });

  it("9. Audience Contributions: word cloud, reactions, and private Q&A", async () => {
    // Open word-cloud activity
    await fetch(`${baseUrl}/api/admin/sessions/${sessionCode}/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ activity: "word-cloud" }),
    });

    // Submit words
    const wordRes1 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ kind: "word", content: "Spices" }),
    });
    assert.equal(wordRes1.status, 201);

    const wordRes2 = await fetch(`${baseUrl}/api/sessions/${sessionCode}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant2Cookie,
      },
      body: JSON.stringify({ kind: "word", content: "Spices" }),
    });
    assert.equal(wordRes2.status, 201);

    // Fetch word cloud
    const cloudRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/word-cloud`);
    assert.equal(cloudRes.status, 200);
    const cloud = await cloudRes.json();
    const spicesWord = cloud.find((item: { word: string }) => item.word.toLowerCase() === "spices");
    assert.ok(spicesWord);
    assert.equal(spicesWord.count, 2);

    // Submit reaction
    const reactRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ kind: "reaction", content: "applause" }),
    });
    assert.equal(reactRes.status, 201);

    // Submit private question
    const qRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: participant1Cookie,
      },
      body: JSON.stringify({ kind: "question", content: "When was the Koutoubia minaret built?" }),
    });
    assert.equal(qRes.status, 201);
    const questionSubmission = await qRes.json();
    assert.equal(questionSubmission.status, "pending");

    // Presenter moderates the question
    const modRes = await fetch(
      `${baseUrl}/api/admin/sessions/${sessionCode}/submissions/${questionSubmission.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ status: "answered" }),
      },
    );
    assert.equal(modRes.status, 200);
    const moderated = await modRes.json();
    assert.equal(moderated.status, "answered");
  });

  it("10. Realtime Socket.IO: verifies handshake and room subscription", async () => {
    const socket: Socket = ClientSocket(baseUrl, {
      path: "/socket.io",
      auth: { sessionCode, role: "projector" },
      transports: ["websocket", "polling"],
      reconnection: false,
    });

    const receivedState = await new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Socket connection timed out"));
      }, 5000);

      socket.on("connect", () => {
        // Connected successfully
      });

      socket.on("presentation:state", (state) => {
        clearTimeout(timeout);
        assert.equal(state.sessionCode, sessionCode);
        socket.disconnect();
        resolve(true);
      });

      socket.on("connect_error", (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(err);
      });
    });

    assert.ok(receivedState);
  });

  it("11. End Presentation: session terminates and locks activities", async () => {
    const endRes = await fetch(`${baseUrl}/api/sessions/${sessionCode}/end`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    assert.equal(endRes.status, 200);
    const finalState = await endRes.json();
    assert.equal(finalState.status, "ended");

    // Joining ended session fails
    const joinEnded = await fetch(`${baseUrl}/api/sessions/${sessionCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Latecomer" }),
    });
    assert.equal(joinEnded.status, 404, "Joining ended session must return 404");
  });
});
